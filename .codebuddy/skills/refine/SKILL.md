---
name: refine
description: 绘本页面精调工具。对已生成的绘本页面图片做细节调整：修改文字、调整边距、改变角色表情、调整构图等。自动感知绘本上下文（角色参考图、原始 Prompt、前后页关系），通过 AI 重新生成实现精准微调。使用 /refine 命令触发。
---

# 绘本页面精调工具 (Storybook Page Refiner)

对已生成的绘本页面做细节调整。将原图作为参考传入 AI 模型，结合自然语言修改指令重新生成，实现"从有到好"的精调。

## 用法

```
/refine <页面图片路径> <修改指令>
/refine storybook/fox-finds-mom-0314/03-page.jpeg 文字往上移一些，底部留更多空白
/refine storybook/fox-finds-mom-0314/00-cover.jpeg 标题字体改大，颜色换成深蓝
/refine storybook/fox-finds-mom-0314/05-page.jpeg 小狐狸的表情改成开心的
/refine storybook/fox-finds-mom-0314/02-page.jpeg 背景颜色改暖一些，增加夕阳光感
```

## 脚本依赖

本 Skill **复用** Storybook skill 的图片生成脚本，不引入新脚本。

**运行时解析**：
1. 找到 Storybook skill 的 SKILL.md 所在目录：搜索 `.codebuddy/skills/storybook/SKILL.md`，其所在目录为 `{storybookBaseDir}`
2. 脚本路径 = `{storybookBaseDir}/scripts/generate-image.ts`
3. 解析 `${BUN_X}`：如果 `bun` 已安装 → `bun`；否则 → `npx -y bun`

## 绘本上下文自动发现

给定一张页面图片路径，自动推导以下上下文：

| 上下文 | 推导规则 | 示例 |
|--------|----------|------|
| 绘本目录 `{bookDir}` | 图片所在目录 | `storybook/fox-finds-mom-0314/` |
| 页面编号 | 从文件名解析 `{NN}` | `03-page.jpeg` → `03` |
| 页面类型 | `00-cover` 为封面，其余为内页 | `00-cover.jpeg` → 封面 |
| 原始 Prompt | `{bookDir}/prompts/{filename}.md` | `prompts/03-page.md` |
| 角色参考图 | `{bookDir}/characters/characters.jpeg` | 固定路径 |
| 角色定义 | `{bookDir}/characters/characters.md` | 固定路径 |
| 前一页图片 | 编号 -1 对应的 jpeg | `02-page.jpeg`（03 的前一页） |

**文件名解析规则**：
- 封面：`00-cover.jpeg` → prompt 文件为 `prompts/00-cover.md`
- 内页：`{NN}-page.jpeg` → prompt 文件为 `prompts/{NN}-page.md`
- 前一页：`01-page` 的前一页是 `00-cover`，`03-page` 的前一页是 `02-page`

## 工作流程

### 进度清单

```
精调进度:
- [ ] Step 1: 分析上下文 + 展示原图（编排器）
- [ ] Step 2: 构建 Prompt + 生成调整后图片（编排器）
- [ ] Step 3: 用户确认 ⚠️（编排器）[满意→覆盖 / 继续调整→循环 / 放弃→清理]
```

### Step 1: 分析上下文（编排器）

1. **解析输入参数**：
   - 从用户输入中提取：图片路径、修改指令
   - 如果用户只给了文件名没给完整路径，尝试在 `storybook/` 目录下查找匹配的文件

2. **验证文件存在**：
   - 确认图片文件存在
   - 确认绘本目录结构完整（有 `prompts/`、`characters/` 目录）

3. **自动发现上下文**（按上表推导）：
   - 确定 `{bookDir}`、页面编号、页面类型
   - 定位原始 Prompt 文件
   - 定位角色参考图
   - 定位前一页图片（如果存在）

4. **展示原图**：
   - 压缩原图用于预览：`sips -Z 1024 {原图路径} --out /tmp/refine-original-preview.jpeg`
   - 用 Read 工具展示压缩后的预览图
   - 告知用户即将调整的内容

5. **读取原始 Prompt**：
   - 用 Read 工具读取对应的 Prompt 文件内容
   - 记为 `{original_prompt}`

6. **确定宽高比**：
   - 优先用 `sips -g pixelWidth -g pixelHeight {原图路径}` 检测原图实际宽高比，取最接近的标准比例（`16:9`、`4:3`、`1:1`、`3:2`）
   - 检测失败时回退：封面和内页默认 `16:9`，角色参考图默认 `4:3`
   - 角色参考图（`characters/characters.jpeg`）通常不需要 refine；如果用户确实要调整，使用检测到的比例（通常是 `4:3`）

### Step 2: 构建 Prompt + 生成图片（编排器直接执行）

#### Prompt 构建策略

基于原始 Prompt + 修改指令，构建新的 Prompt 文件：

```markdown
{original_prompt 内容，完整保留}

---

⚠️ 重要修改指令（以下指令优先级高于上述所有描述，必须严格执行）：

参考图说明：第一张参考图（--ref）是这一页当前的效果图。请以该图为基础进行微调，保持整体构图、角色位置、场景布局尽量与参考图一致。

需要修改的内容：
{用户的修改指令}

除上述明确要求修改的部分外，其他所有元素（构图、角色外貌、场景、色调、画风）必须与参考图保持一致。
```

将构建好的 Prompt 写入临时文件：`/tmp/refine-prompt-{timestamp}.md`

#### 执行生成

```bash
${BUN_X} {storybookBaseDir}/scripts/generate-image.ts \
  --promptfiles /tmp/refine-prompt-{timestamp}.md \
  --image /tmp/refine-preview-{timestamp}.jpeg \
  --ar {aspect_ratio} \
  --quality 2K \
  --ref {原图路径} \
  --ref {角色参考图路径} \
  --no-open
```

**ref 顺序很重要**：
1. 第一个 `--ref`：原图（让 AI 保持原图构图）
2. 第二个 `--ref`：角色参考图（保持角色一致性）

⚠️ 如果生成失败，自动重试一次。如果重试仍然失败，告知用户错误信息。

#### 展示预览

生成成功后：
1. 压缩预览图：`sips -Z 1024 /tmp/refine-preview-{timestamp}.jpeg --out /tmp/refine-compare-preview.jpeg`
2. 用 Read 工具展示压缩后的预览图

### Step 3: 用户确认（编排器）⚠️

**必须使用 `AskUserQuestion` 工具**确认：

```
AskUserQuestion(
  questions = [{
    question: "调整后的效果是否满意？",
    header: "精调确认",
    options: [
      { label: "满意，替换", description: "用调整后的图片替换原图，并更新 Prompt 文件" },
      { label: "继续调整", description: "在当前结果基础上继续修改（请在下一条消息中描述新的修改指令）" },
      { label: "放弃", description: "放弃本次调整，保留原图不变" }
    ]
  }]
)
```

#### 满意 → 执行替换

1. **备份原图**（可选但推荐）：
   ```bash
   cp {原图路径} {原图路径}.bak
   ```

2. **覆盖原图**：
   ```bash
   cp /tmp/refine-preview-{timestamp}.jpeg {原图路径}
   ```

3. **更新 Prompt 文件**：
   用 Write 工具将修改后的 Prompt 写入 `{bookDir}/prompts/{NN}-page.md`，覆盖原始 Prompt。
   
   在文件末尾追加修改记录：
   ```markdown
   
   <!-- Refined: {修改指令简述} -->
   ```

4. **重新拼接长图**：
   ```bash
   ${BUN_X} {storybookBaseDir}/scripts/stitch-pages.ts {bookDir} --no-open
   ```

5. **清理临时文件**：
   ```bash
   rm -f /tmp/refine-prompt-*.md /tmp/refine-preview-*.jpeg /tmp/refine-compare-preview.jpeg /tmp/refine-original-preview.jpeg
   ```

6. **输出结果报告**：
   ```
   ✅ 精调完成！
   
   修改内容: {修改指令}
   替换文件: {原图路径}
   Prompt 更新: {Prompt 文件路径}
   长图已重新拼接: {bookDir}/all-pages.jpeg
   
   原图备份: {原图路径}.bak（如需恢复可手动替换回来）
   ```

#### 继续调整 → 回到 Step 2

1. 等待用户输入新的修改指令
2. **修改指令累积**：新一轮的 Prompt = 原始 Prompt + 所有历史修改指令 + 本轮新指令
3. **ref 始终用原图**（不用上一轮临时结果），避免多轮迭代质量劣化
4. 清理上一轮的临时预览图，生成新的
5. 回到 Step 3 让用户确认

累积指令格式：
```markdown
{original_prompt}

---

⚠️ 重要修改指令（以下指令优先级高于上述所有描述，必须严格执行）：

参考图说明：第一张参考图（--ref）是这一页当前的效果图。请以该图为基础进行微调，保持整体构图、角色位置、场景布局尽量与参考图一致。

需要修改的内容：
1. {第 1 轮修改指令}
2. {第 2 轮修改指令}
...

除上述明确要求修改的部分外，其他所有元素（构图、角色外貌、场景、色调、画风）必须与参考图保持一致。
```

#### 放弃 → 清理退出

1. 清理所有临时文件
2. 告知用户原图未被修改

## 边界情况处理

### 找不到原始 Prompt 文件

如果 `{bookDir}/prompts/{NN}-page.md` 不存在：
1. 提示用户 Prompt 文件缺失
2. 询问用户是否要手动描述这一页的内容，然后以用户描述 + 修改指令作为 Prompt
3. 或者直接用修改指令作为 Prompt（效果可能不如有原始 Prompt 的情况）

### 找不到角色参考图

如果 `{bookDir}/characters/characters.jpeg` 不存在：
- 只传原图作为 ref，不传角色参考图
- 提示用户角色一致性可能受影响

### 非绘本目录的图片

如果图片路径不在标准绘本目录结构中（没有 `prompts/`、`characters/` 目录）：
1. 提示用户这不像是一个绘本目录
2. 降级为"简单模式"：只用原图作为 ref + 用户修改指令作为 Prompt
3. 不执行 Prompt 更新和长图拼接

## 注意事项

- **⚠️ 读取图片前必须先压缩**：所有 `.jpeg` 图片在用 Read 工具展示前，必须先用 `sips -Z 1024 <原图> --out /tmp/<预览名>.jpeg` 压缩
- **ref 顺序**: 原图在前（保持构图），角色参考图在后（保持角色一致）
- **迭代中 ref 不变**: 多轮调整时 ref 始终用原图，不用临时结果，避免质量劣化
- **修改指令累积**: 多轮调整时指令累积叠加，不丢弃历史指令
- **Prompt 用中文**: 与 Storybook skill 一致，Prompt 用中文编写避免画面生成英文文字
