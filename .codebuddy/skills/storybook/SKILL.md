---
name: storybook
description: 儿童绘本生成器。根据故事主题生成完整的儿童绘本：角色设计 → 分镜脚本 → 逐页生成 16:9 高清插图。通过角色参考图保持跨页面视觉一致性。使用 codebuddy 内置的文生图模型 Gemini-3.1-Flash-Image 生成图片。
---

# 儿童绘本生成器 (Children's Storybook Creator)

根据用户提供的故事主题或梗概，生成一本完整的儿童绘本：统一画风的角色设计、分镜脚本、以及多张 16:9 横版 2K 高清插图。

## 用法

```
/storybook 小狐狸找妈妈的故事
/storybook 一只害怕水的小鸭子学游泳
/storybook 太空探险：小兔子去月球
/storybook --pages 12 一个关于分享的故事
```

## 选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--pages` | 10 | 绘本页数（不含封面，推荐 8-16） |
| `--style` | 用户选择 | 画风（见画风列表） |
| `--age` | 用户选择 | 目标年龄段 |
| `--lang` | zh | 故事文字语言 |
| `--regenerate N` | - | 重新生成指定页（如 `3` 或 `2,5,8`） |
| `--images-only` | - | 跳过分镜，直接从已有 prompts 生成图片 |
| `--storyboard-only` | - | 只生成分镜脚本，不生成图片 |
| `--text2mage-model` | - | 文生图模型，默认使用 `Gemini-3.1-Flash-Image` |

## 脚本目录

所有脚本位于此 SKILL.md 同级的 `scripts/` 目录下。

**运行时解析**：
1. 确定此 SKILL.md 所在目录为 `{baseDir}`
2. 脚本目录 = `{baseDir}/scripts/`
3. 解析 `${BUN_X}`：如果 `bun` 已安装 → `bun`；否则 → `npx -y bun`

**生成图片**：
采用模型直接生成

**拼接长图命令**（所有页面图片生成完成后自动执行）：
```bash
${BUN_X} {baseDir}/scripts/stitch-pages.ts <book-dir> --no-open
```

## 输出目录结构

每本绘本创建独立目录：`storybook/{slug}-{timestamp}/`

命名规则：`{slug}-{timestamp}`
- `{slug}`：从主题提取 2-4 个词的 kebab-case（如 `fox-finds-mom`）
- `{timestamp}`：当前时间，格式 `MMDD-HHmmss`（如 `0314-152035`）
- 示例：`fox-finds-mom-0314-152035`、`sparkly-teeth-0315-093012`

```
storybook/{slug}-{timestamp}/
├── characters/
│   ├── characters.md          # 角色定义文档
│   └── characters.jpeg        # 角色参考图
├── storyboard.md              # 分镜脚本
├── prompts/
│   ├── 00-cover.md            # 封面 prompt
│   ├── 01-page.md             # 第 1 页 prompt
│   ├── 02-page.md             # 第 2 页 prompt
│   └── ...
├── 00-cover.jpeg              # 封面图片
├── 01-page.jpeg               # 第 1 页图片
├── 02-page.jpeg               # 第 2 页图片
├── ...
└── all-pages.jpeg             # 全页拼接长图（自动生成）
```

## 参考文档

以下参考文档由 **Sub-Agent 按需读取**，主 Agent 不需要全部加载：

| 文档 | 内容 | 由谁读取 |
|------|------|----------|
| [what-is-storybook.md](references/what-is-storybook.md) | 儿童绘本设计原则、页数建议、画风推荐 | 主 Agent（Step 1，~73 行） |
| [character-template.md](references/character-template.md) | 角色定义模板、角色参考图 prompt 模板 | Sub-Agent: 角色设计师（Step 3） |
| [storyboard-template.md](references/storyboard-template.md) | 分镜脚本模板、镜头语言、翻页节奏设计 | Sub-Agent: 分镜编剧（Step 4） |
| [prompt-guide.md](references/prompt-guide.md) | 图片 prompt 编写指南、一致性策略、模板 | Sub-Agent: Prompt 工程师（Step 5） |

## 架构：编排器 + Sub-Agent

本 Skill 使用 **Sub-Agent 委派模式**来避免上下文爆炸：

- **主 Agent（编排器）**：负责用户交互、进度协调、轻量分析（Step 1, 2, 6, 7.2, 9）
- **Sub-Agent**：通过 `Task` 工具启动，各自读取所需的参考文档，完成重活后返回摘要

```
用户输入 → Step 1 (编排器: 分析主题 + 流程规划，读 what-is-storybook.md)
  → Step 2 (编排器: 用户确认方案) ⛔ 必须 AskUserQuestion 确认
  │         ├─ 完整确认模式（素材少，展示完整方案 + 故事梗概）
  │         ├─ 快速确认模式（素材多，只确认画风/页数/目录）
  │         └─ ⚠️ 用户未确认前禁止进入 Step 3
  → Step 3 (角色定义) → characters/characters.md
  │         ├─ 跳过：用户素材完整 → 编排器直接写入
  │         └─ 执行：🤖 Sub-Agent 角色设计师
  → Step 4 (分镜脚本) → storyboard.md
  │         ├─ 跳过：用户素材完整 → 编排器直接写入
  │         └─ 执行：🤖 Sub-Agent 分镜编剧
  → Step 5 (生成 Prompt) → prompts/*.md
  │         ├─ 跳过：用户已提供完整 Prompt → 编排器直接写入
  │         └─ 执行：🤖 Sub-Agent Prompt 工程师
  → Step 6 (编排器: 用户审阅，可选)
  → Step 7 (角色参考图) → characters/characters.jpeg
  │         ├─ 跳过：用户已提供角色参考图 → 编排器直接复制
  │         └─ 执行：7.1 🤖 Sub-Agent 生成 → 7.2 编排器用户确认 ⚠️ ← 循环
  → Step 8 (🤖 Sub-Agent: 逐页生成内页图片) → *.jpeg
  → Step 8.5 (编排器: 拼接长图，不查看结果) → all-pages.jpeg
  → Step 9 (编排器: 完成报告)
```

**规则**：
- Sub-Agent 不能与用户交互，所有用户沟通由主 Agent 负责
- 每个 Sub-Agent 只读取自己需要的 reference 文件
- 步骤之间通过**磁盘文件**传递产出，通过 **Task 返回值**传递简短摘要
- Steps 3→4→5 必须串行执行（后续步骤依赖前序产出）
- **用户素材透传**：当用户提供了角色设计/分镜脚本/Prompt 等素材时，必须通过 `{confirmed_plan}` 原文传递给对应的 Sub-Agent，Sub-Agent 在用户素材基础上补充完善，而非从零重写
- **⛔ 确认关卡（Step 2）**：Step 2 是硬性关卡，必须通过 `AskUserQuestion` 工具获取用户明确确认后才能进入 Step 3。禁止在用户确认前启动任何 Sub-Agent 或创建输出文件（目录创建除外）

## 工作流

### 进度清单

```
绘本生成进度:
- [ ] Step 1: 理解需求 + 流程规划（编排器）
- [ ] Step 2: 确认方案 ⚠️ 必须用 AskUserQuestion 获取用户明确确认（编排器）[完整确认/快速确认]
- [ ] Step 3: 角色定义 [🤖 Sub-Agent / ✍️ 直接写入 / ⏭️ 跳过]
- [ ] Step 4: 分镜脚本 [🤖 Sub-Agent / ✍️ 直接写入 / ⏭️ 跳过]
- [ ] Step 5: 生成图片 Prompt [🤖 Sub-Agent / ✍️ 直接写入 / ⏭️ 跳过]
- [ ] Step 6: 用户审阅（编排器，可选）
- [ ] Step 7: 角色参考图 [🤖 生成+确认 / 📎 用户已提供 / ⏭️ 跳过]
  - [ ] 7.1 生成角色参考图（🤖 Sub-Agent）
  - [ ] 7.2 用户确认角色参考图（编排器）⚠️ 不满意可重新生成
- [ ] Step 8: 生成内页图片（🤖 Sub-Agent）
  - [ ] 逐页生成图片（每页带 --ref 角色参考图 + 前一页图片）
- [ ] Step 8.5: 拼接长图（编排器，自动执行，不查看结果）
- [ ] Step 9: 完成报告（编排器）

注：根据 Step 1 的执行计划，标记为 ⏭️ 的步骤将跳过，标记为 ✍️ 的步骤由编排器直接处理（不启动 Sub-Agent）。
实际进度清单中，跳过的步骤标记为 [跳过]，直接写入的步骤标记为 [直接写入]。
```

### Step 1: 理解需求（编排器）

1. 读取 [what-is-storybook.md](references/what-is-storybook.md)（~73 行，可直接读取）
2. 分析用户提供的故事主题/梗概
3. 确定：
   - 故事核心冲突/主题
   - 主要角色（几个？什么类型？）
   - 故事情绪基调
   - 目标年龄段（如果用户指定了）
4. **生成输出目录名**：
   - 从主题提取 2-4 个词的 kebab-case slug
   - 用 Bash 工具执行 `date +%m%d-%H%M%S` 获取当前时间戳
   - 拼接为 `{slug}-{timestamp}`（如 `sparkly-teeth-0314-152035`）
   - 确定最终的 `{outputDir}` = `storybook/{slug}-{timestamp}/`
5. 检测用户提供的素材级别（重要！用户可能已提供详细的角色设计、分镜脚本、甚至生成 Prompt，必须识别并保留）：
   - **角色设计**：[完整/部分/无] — 用户是否提供了角色外貌、配色、性格等详细描述
   - **分镜脚本**：[完整/部分/无] — 用户是否提供了每页的故事文字和画面描述
   - **生成 Prompt**：[有/无] — 用户是否已编写英文图片生成 prompt
   
   判断标准：
   - **完整**：覆盖 >=80% 的页面，且每页有具体的文字/画面描述
   - **部分**：有故事大纲 + 部分页面的详细描述，或只有文字没有画面描述
   - **无**：仅提供主题/简要梗概

6. **生成执行计划**（基于素材级别，决定哪些步骤需要执行、哪些可以跳过）：

   ```
   ## 执行计划
   - Step 3 角色定义: [需要/跳过] — 原因
   - Step 4 分镜脚本: [需要/跳过] — 原因
   - Step 5 生成 Prompt: [需要/跳过] — 原因
   - Step 7 角色参考图: [需要生成/跳过] — 原因
   - Step 2 确认模式: [完整确认/快速确认] — 原因
   ```

   **跳过规则**：
   - **角色定义（Step 3）**：如果用户提供了完整的角色定义文档（含外貌、配色、表情等），标记为「跳过」，由编排器直接写入 `characters.md`
   - **分镜脚本（Step 4）**：如果用户提供了完整的分镜（每页都有故事文字和画面描述），标记为「跳过」，由编排器直接写入 `storyboard.md`
   - **Prompt 生成（Step 5）**：如果用户已提供完整的图片 prompt，标记为「跳过」，由编排器直接写入 `prompts/` 目录
   - **角色参考图（Step 7）**：如果用户提供了角色参考图文件，标记为「跳过」，由编排器直接复制到 `characters/characters.jpeg`
   - **Step 2 确认模式**：当角色设计 + 分镜脚本都为「完整」级别时，使用「快速确认」模式；否则使用「完整确认」模式

   > ⚠️ 素材为「部分」级别时不跳过，仍启动 Sub-Agent 在用户素材基础上补充完善。只有「完整」级别才跳过 Sub-Agent。

### Step 2: 确认方案 ⚠️ 需用户确认（编排器）

根据 Step 1 执行计划中的确认模式，选择对应的确认流程。

**⛔ 硬性规则：必须使用 `AskUserQuestion` 工具获取用户明确确认后才能进入 Step 3。绝对不允许跳过确认、自动确认、或假设用户同意。**

#### 完整确认模式（用户素材少，角色或分镜非「完整」级别）

向用户展示方案概要：

- **故事梗概**：用 3-5 句话描述故事走向（包含核心冲突和结局方向）
- **角色列表**：主角和配角的名字、简要描述
- **推荐画风**：根据故事内容推荐画风，说明理由
- **页数**：推荐的页数
- **色调方向**：整体色彩倾向
- **执行计划**：展示哪些步骤需要执行

展示完上述方案后，**必须使用 `AskUserQuestion` 工具**询问用户是否满意：

```
AskUserQuestion(
  questions = [{
    question: "以上故事方案是否满意？如需调整剧情走向、角色设定或画风等，请选择修改。",
    header: "方案确认",
    options: [
      { label: "满意，开始", description: "确认当前方案，开始角色设计和分镜创作" },
      { label: "需要修改", description: "对故事梗概、角色、画风或页数等有调整意见" }
    ]
  }]
)
```

- **如果用户选择「需要修改」或提供了修改意见** → 根据反馈调整方案，然后**再次展示并再次使用 `AskUserQuestion` 确认**，循环直到用户满意
- **如果用户选择「满意，开始」** → 进入后续流程

#### 快速确认模式（用户素材丰富，角色 + 分镜都为「完整」级别）

用户已提供详细素材，只确认关键决策项：

- **画风**：确认或选择画风
- **页数**：确认页数
- **输出目录**：确认目录名
- **执行计划**：展示哪些步骤将跳过（让用户知悉流程简化）

不需要重新展示用户已提供的故事梗概和角色列表。

展示完后，同样**必须使用 `AskUserQuestion` 工具**确认：

```
AskUserQuestion(
  questions = [{
    question: "以上配置是否确认？",
    header: "快速确认",
    options: [
      { label: "确认开始", description: "使用当前画风、页数等配置开始生成" },
      { label: "需要修改", description: "调整画风、页数或其他配置" }
    ]
  }]
)
```

**不要跳过此步骤**。用户可能会调整画风或页数。

**用户确认后**，将以下信息整理为 `{confirmed_plan}` 文本，供后续 Sub-Agent 使用：
```
故事主题: ...
故事梗概: ...（3-5 句）
角色列表: ...（名字 + 简要描述）
画风: ...
页数: N
色调方向: ...
目标年龄段: ...
语言: ...

## 用户素材级别
角色设计: [完整/部分/无]
分镜脚本: [完整/部分/无]
生成 Prompt: [有/无]

## 用户提供的角色详情（仅当角色设计为「完整」或「部分」时）
[原文保留用户的角色描述，不做删减、不做改写]

## 用户提供的分镜详情（仅当分镜脚本为「完整」或「部分」时）
[原文保留用户的每页分镜描述，包括故事文字、画面描述、生成 Prompt 等一切信息]
```

⚠️ **关键原则**：用户提供的素材是核心约束，不是参考建议。后续 Sub-Agent 必须在用户素材基础上补充完善，而不是另起炉灶。

### Step 3: 角色定义

**⏭️ 跳过条件**：如果执行计划标记 Step 3 为「跳过」（用户素材为「完整」级别），编排器直接处理：
1. 将用户提供的角色描述整理后，用 Write 工具写入 `{outputDir}/characters/characters.md`
2. 从角色描述中提取每个角色的名字 + 3 个最显著视觉特征，作为 `{character_summary}`
3. 跳过 Sub-Agent，直接进入 Step 4

**🤖 执行条件**：如果执行计划标记 Step 3 为「需要」（素材为「部分」或「无」），启动 Sub-Agent：

使用 Task 工具启动 Sub-Agent：

```
Task(
  subagent_type = "general-purpose",
  description = "设计绘本角色",
  prompt = """
你是一位儿童绘本角色设计师。请根据以下故事方案设计角色。

## 故事方案
{confirmed_plan}

## 用户素材级别
角色设计: {角色素材级别}

## 工作指令

1. 用 Read 工具读取角色模板: {baseDir}/references/character-template.md

**然后根据用户素材级别选择对应路径：**

### 路径 A：角色设计为「完整」
用户已提供详细的角色外貌、配色等描述（见上方故事方案中的「用户提供的角色详情」）。
- 以用户描述为核心约束，按模板格式整理输出
- 仅补充模板要求但用户未提供的字段（如 hex 色值、表情列表、大小比例等）
- **不修改**用户描述的核心外貌特征、配色、性格
- 在文档末尾编写角色参考图的生成 prompt

### 路径 B：角色设计为「部分」
用户提供了部分角色信息（如名字+简要外貌，但缺少配色/表情/比例等）。
- 保留用户描述的所有特征作为约束
- 在用户描述基础上扩展缺失部分，使其符合模板的完整要求
- 在文档末尾编写角色参考图的生成 prompt

### 路径 C：角色设计为「无」
用户未提供角色详情，从零设计：
- 严格按照模板格式，为每个角色定义：
  - 完整的外貌特征（具体到颜色、发型、特征）
  - 至少 4 种表情
  - 服装和配件
  - 色彩代码（hex 值）
  - 角色之间的大小比例关系
- 在文档末尾编写角色参考图的生成 prompt

**所有路径最后都执行：**
用 Write 工具将结果写入: {outputDir}/characters/characters.md

## 输出要求
- 文件: {outputDir}/characters/characters.md
- 返回: 每个角色的名字 + 3 个最显著的视觉特征（简短摘要）
"""
)
```

**主 Agent 收到返回后**：记录角色摘要 `{character_summary}`，进入 Step 4。

### Step 4: 分镜脚本

**⏭️ 跳过条件**：如果执行计划标记 Step 4 为「跳过」（用户素材为「完整」级别），编排器直接处理：
1. 将用户提供的分镜内容整理后，用 Write 工具写入 `{outputDir}/storyboard.md`
2. 从分镜中提取每页的一句话概要，作为 `{storyboard_summary}`
3. 跳过 Sub-Agent，直接进入 Step 5

**🤖 执行条件**：如果执行计划标记 Step 4 为「需要」（素材为「部分」或「无」），启动 Sub-Agent：

使用 Task 工具启动 Sub-Agent：

```
Task(
  subagent_type = "general-purpose",
  description = "编写分镜脚本",
  prompt = """
你是一位专业的儿童绘本分镜编剧，擅长创作有情感张力和角色成长弧线的故事。你深谙经典绘本的叙事规律：好故事从不说教，而是用行动和体验打动读者。请根据故事方案和角色定义编写分镜脚本。

## 故事方案
{confirmed_plan}

## 角色摘要
{character_summary}

## 素材级别
分镜脚本: {分镜素材级别}
生成 Prompt: {是否有 Prompt}

## 工作指令

1. 用 Read 工具读取分镜模板: {baseDir}/references/storyboard-template.md
2. 用 Read 工具读取角色定义: {outputDir}/characters/characters.md

根据素材级别选择路径：

- **「完整」**：以用户分镜为核心约束，按模板格式整理，保留用户的故事文字/画面描述/场景设计，仅补充模板要求但用户未提供的技术字段（镜头类型、翻页钩子、情绪标注、色调等），不修改用户的故事内容
- **「部分」**：保留用户已写的页面内容，为缺失页面补写分镜，保持风格/节奏一致，确保情绪弧线连贯
- **「无」**：从零创作。先设计核心冲突和角色弧线，再分配到具体页面。铁律：不说教、不怪罪、自然后果、情绪真实、一个核心冲突逐步升级、每页文字 1-3 句用画面讲故事

技术要求：严格按模板格式，每页含故事文字（中文）、画面描述（镜头/构图/角色动作/环境）、情绪标注、翻页钩子。镜头类型要变化，情绪弧线清晰。

## ⚠️ 关键：分批写入（防止单次输出过大导致超时）

**禁止一次性写入整个 storyboard.md！** 必须分批写入：

**第一步**：用 Write 工具写入文件头部 + 封面 + 前 {半数} 页（如 10 页绘本写封面+第1-5页）
**第二步**：用 Edit 工具在文件末尾追加剩余页面（第6-10页）

每次 Write/Edit 只输出 5-6 页的内容，这样每次 LLM 响应不会过大。

具体操作：
1. 先在脑中规划好所有页面的故事走向和情绪弧线（简短思考即可）
2. Write 写入: 文件头部（yaml frontmatter + 标题）→ 封面 → 第 1 页到第 {N/2} 页
3. Edit 追加: 第 {N/2+1} 页到第 {N} 页（old_string 用上一步最后写入的 `---` 分隔线，new_string 为该分隔线 + 剩余所有页面）

## 输出要求
- 文件: {outputDir}/storyboard.md
- 返回: 每页的一句话概要（页码 + 场景描述）
"""
)
```

**主 Agent 收到返回后**：记录分镜摘要 `{storyboard_summary}`，进入 Step 5。

### Step 5: 生成图片 Prompt

**⏭️ 跳过条件**：如果执行计划标记 Step 5 为「跳过」（用户已提供完整的图片 prompt），编排器直接处理：
1. 将用户提供的 prompt 按页拆分，用 Write 工具逐个写入 `{outputDir}/prompts/` 目录（00-cover.md, 01-page.md, ...）
2. 记录文件列表作为 `{prompt_files}`
3. 跳过 Sub-Agent，直接进入 Step 6

**🤖 执行条件**：如果执行计划标记 Step 5 为「需要」，启动 Sub-Agent：

使用 Task 工具启动 Sub-Agent：

```
Task(
  subagent_type = "general-purpose",
  description = "生成图片 Prompt",
  prompt = """
你是一位 AI 图片生成 Prompt 工程师，专精儿童绘本插画。

## 故事方案
{confirmed_plan}

## 工作指令

1. 用 Read 工具读取 prompt 编写指南: {baseDir}/references/prompt-guide.md
2. 用 Read 工具读取角色定义: {outputDir}/characters/characters.md
3. 用 Read 工具读取分镜脚本: {outputDir}/storyboard.md

## ⚠️ 关键：逐页写入（防止单次输出过大导致超时）

**禁止一次性构思所有 prompt 再写入！** 必须逐页生成、逐页写入：

读完参考文件后，按以下顺序逐页处理：
- 每次只构思 1 页的 prompt，然后立即用 Write 写入对应文件
- 写完一页后再构思下一页
- 顺序: 00-cover.md → 01-page.md → 02-page.md → ...

每个 prompt 文件必须包含：
- **画风指令**：统一的风格锚定词（画风: {style}）
- **场景描述**：具体的场景和构图
- **角色描述**：从 characters.md 摘取的关键外貌特征（每页都要重复！）
- **一致性锚点**：强调保持角色外貌和画风一致
- **故事文字**：指定故事正文的内容、位置、字体风格和颜色，让模型直接在画面中渲染

**Prompt 用中文编写**（中文 prompt 能有效避免模型在画面中生成英文文字）

**封面标题文字策略**：封面 prompt 必须让模型直接在画面中渲染中文标题。要求：
- 明确写出标题的中文文字内容（如"写着'小狐狸找妈妈'六个中文大字"）
- 指定字体风格（如"圆润可爱的卡通字体"、"手写体"）
- 指定文字在画面中的位置（如"画面顶部"、"画面上方居中"）
- 指定文字颜色，使其与画面协调

**内页文字策略**：
- 故事正文区域：让模型直接在画面中渲染故事文字。在 prompt 中写明故事正文内容（1-3 句）、文字在画面中的位置（如「画面底部」）、字体风格（如「柔和的手写体」）和字体颜色
- 场景自然文字（招牌、书本标题等）：必须在 prompt 中明确写出具体的中文文字内容
- 除专有名词外，画面中出现的所有文字都必须是中文

写入 {outputDir}/prompts/ 目录：00-cover.md（封面）、01-page.md 到 {NN}-page.md（每一页）

## 输出要求
- 文件: {outputDir}/prompts/00-cover.md, 01-page.md, ..., {NN}-page.md
- 返回: 所有创建的 prompt 文件列表（文件名）
"""
)
```

**主 Agent 收到返回后**：记录文件列表 `{prompt_files}`，进入 Step 6。

### Step 6: 用户审阅（编排器，可选）

如果用户在 Step 2 中要求审阅分镜，此时展示：
- 每页的缩略描述（故事文字 + 画面概要）
- 用户可以要求调整某些页面
- 如需调整，重新委派对应的 Sub-Agent

### Step 7: 角色参考图（编排器 + Sub-Agent）

**⏭️ 跳过条件**：如果执行计划标记 Step 7 为「跳过」（用户已提供角色参考图文件），编排器直接处理：
1. 将用户提供的角色参考图复制到 `{outputDir}/characters/characters.jpeg`（使用 Bash 的 `cp` 命令）
2. 跳过生成和确认环节，直接进入 Step 8

**🤖 执行条件**：如果执行计划标记 Step 7 为「需要生成」，进入生成 + 确认流程：

角色参考图是整本绘本视觉一致性的基础，**必须在用户确认满意后才能继续生成内页**。

#### Step 7.1: 生成角色参考图（🤖 Sub-Agent 委派）

使用 Task 工具启动 Sub-Agent：

```
Task(
  subagent_type = "general-purpose",
  description = "生成角色参考图",
  prompt = """
你是一位绘本图片生成执行者。请生成角色参考图。

## 上下文
- 输入角色描述文件: {outputDir}/characters/characters.md
- 输出角色参考图： {outputDir}/characters/characters.jpeg

## 生成图片

基于`角色描述文件`，使用默认的文生图模型，生成`角色参考图`。

⚠️ 角色参考图使用 4:3 比例（不是 16:9）。
⚠️ 如果失败，再重试一次。如果重试后仍然失败，返回错误信息。

## 输出要求
- 返回: 生成结果（成功/失败 + 文件路径）
"""
)
```

#### Step 7.2: 用户确认角色参考图（编排器）⚠️

**主 Agent 收到返回后**：

1. **先压缩图片再阅读**（生成的原图可能有数 MB，直接 Read 会导致错误）：
   ```bash
   sips -Z 1024 {outputDir}/characters/characters.jpeg --out /tmp/characters-preview.jpeg
   ```
2. 用 Read 工具展示压缩后的预览图 `/tmp/characters-preview.jpeg` 给用户
3. 询问用户是否满意角色参考图

**如果用户满意** → 进入 Step 8。

**如果用户不满意** → 进入修改循环：
1. 询问用户具体哪里不满意（如角色外貌、颜色、比例、表情等）
2. 用 Read 工具读取 `{outputDir}/characters/characters.md`
3. 根据用户反馈修改 characters.md 中 **「角色参考图 Prompt」** 部分（文件末尾的英文 prompt）
4. 如果用户的反馈涉及角色设定本身（如要改颜色、加配件等），同步更新 characters.md 中对应角色的定义
5. 重新启动 Step 7.1 的 Sub-Agent 生成新的角色参考图
6. 再次展示给用户确认
7. 重复此循环，直到用户满意

**注意**：修改 Prompt 时，优先做精准调整（如强调某个特征、调整措辞），避免大幅重写导致已满意的部分也发生变化。

### Step 8: 生成内页图片（🤖 Sub-Agent 委派）

使用 Task 工具启动 Sub-Agent：

```
Task(
  subagent_type = "general-purpose",
  description = "生成绘本内页图片",
  prompt = """
你是一位绘本图片生成执行者。请按顺序逐页生成绘本图片。

## 上下文
- 输出目录: {outputDir}
- 总页数: {N}
- Prompt 文件列表: {prompt_files}
- 角色参考图（已确认）: {outputDir}/characters/characters.jpeg

## 工作指令

按顺序对每个 prompt 文件执行（从封面开始）。每页传入两个参考图：角色参考图（保持角色一致）+ 前一页的生成图片（保持场景风格延续）。

**封面（00-cover）— 无前一页，只带角色参考图：**
  使用默认的文生图模型，生成封面文件 {outputDir}/00-cover.jpeg
  要求：
  1 prompt：{outputDir}/prompts/00-cover.md
  2 参考角色参考图: {outputDir}/characters/characters.jpeg
  3 尺寸 16:9 的 2K 图片

**后续每页（01-page 起）— 带角色参考图 + 前一页图片：**

  使用默认的文生图模型，生成文件： {outputDir}/{NN}-page.jpeg
  要求：
  1 prompt：{outputDir}/prompts/{NN}-page.md
  2 参考角色参考图: {outputDir}/characters/characters.jpeg
  3 参考前一页： {outputDir}/{前一页文件名}.jpeg \
  4 尺寸 16:9 的 2K 图片

生成顺序: 00-cover, 01-page, 02-page, ...

### 关键要求
- 每一页都必须传入 --ref characters/characters.jpeg
- 从 01-page 开始，额外传入前一页的 .jpeg 作为第二个 --ref
- 封面（00-cover）只带角色参考图，不带前一页（因为没有前一页）
- 01-page 的前一页是 00-cover.jpeg
- 按页码顺序生成，不要跳页（顺序生成才能让每页引用前一页）
- 如果某页失败，自动重试一次后继续下一页

## 输出要求
- 返回: 每页的生成结果报告（文件名 + 成功/失败）
"""
)
```

**主 Agent 收到返回后**：检查生成报告，告知用户哪些页面成功/失败。

### Step 8.5: 拼接长图（编排器直接执行）

所有内页图片生成完毕后，自动执行拼接脚本，将封面和所有内页垂直拼接为一张长图：

```bash
${BUN_X} {baseDir}/scripts/stitch-pages.ts {outputDir} --no-open
```

生成文件: `{outputDir}/all-pages.jpeg`

⚠️ **不要阅读或展示 `all-pages.jpeg`**。该文件通常 >5MB、分辨率极高（如 2752x16896px），用 Read 工具加载会非常慢且浪费大量 token。用户可以自行在 Finder 中打开查看。只需在 Step 9 完成报告中列出文件路径即可。

### Step 9: 完成报告（编排器）

⚠️ **不要读取任何图片文件**。直接根据 Step 8 的生成报告输出文件列表即可。读取图片文件非常慢且浪费大量 token，用户可以自行在 Finder 中打开查看。

生成完成后输出报告：

```
绘本生成完成！

标题: [绘本标题]
页数: [封面 + N 页]
画风: [使用的画风]
输出目录: storybook/{slug}-{timestamp}/

文件列表:
  ✓ characters/characters.md  - 角色定义
  ✓ characters/characters.jpeg - 角色参考图
  ✓ storyboard.md             - 分镜脚本
  ✓ prompts/*.md              - 图片 prompt（共 N+1 个）
  ✓ 00-cover.jpeg             - 封面
  ✓ 01-page.jpeg ~ NN-page.jpeg - 内页（共 N 页）
  ✓ all-pages.jpeg             - 全页拼接长图

用户可在 Finder 中打开输出目录查看所有图片，或直接打开 all-pages.jpeg 预览完整绘本。

如需对某页图片做细节调整（边距、文字、表情等），使用：
/refine storybook/{slug}-{timestamp}/03-page.jpeg 你的修改指令
```

## 重新生成单页

如果某一页效果不满意，可以单独重新生成：

1. 先修改对应的 prompt 文件 (`prompts/NN-page.md`)
2. 执行重新生成：

  使用默认的文生图模型，生成文件 {outputDir}/{NN}-page.jpeg
  要求：
  1 prompt：{outputDir}/prompts/{NN}-page.md
  2 参考角色参考图: {outputDir}/characters/characters.jpeg
  3 参考前一页： {outputDir}/{前一页文件名}.jpeg \
  4 尺寸 16:9 的 2K 图片

注意：参考 角色参考图，还要带上前一页的图片以保持风格延续。

## 画风列表

| 画风关键词 | 描述 | 适合内容 |
|-----------|------|---------|
| `watercolor` | 柔和水彩风，温暖有手绘质感 | 自然、情感、温馨故事 |
| `flat-illustration` | 扁平插画，色块分明，现代感 | 科普、认知、日常生活 |
| `digital-painting` | 数字绘画，精致细腻 | 冒险、幻想、宏大场景 |
| `crayon` | 蜡笔风，童趣粗犷 | 低龄、手工感、亲切 |
| `line-art` | 线条插画，干净简约 | 教育、概念、对话 |
| `japanese-picture-book` | 日系绘本风，清新留白 | 哲理、安静、诗意 |
| `cartoon` | 明快卡通风，夸张可爱 | 搞笑、冒险、动物故事 |
| `paper-cut` | 剪纸拼贴风，层次分明 | 传统文化、民间故事 |
| `soft-3d` | 柔和 3D 渲染，圆润可爱 | 现代儿童 IP、玩具感 |


## 注意事项

- **⚠️ 读取图片前必须先压缩**：生成的原图通常有数 MB，直接用 Read 工具阅读会导致错误。**任何时候需要阅读/展示 .jpeg 图片，必须先用 `sips -Z 1024 <原图> --out /tmp/<预览名>.jpeg` 压缩到 1024px 以内，再 Read 压缩后的文件**。这包括：角色参考图确认、内页生成结果检查、用户要求查看某页等所有场景。
- 图片生成每页约 10-30 秒，请耐心等待
- 失败自动重试一次
- **角色参考图必须经用户确认后才能开始生成内页**（Step 7 的确认环节）
- 每一页都必须带 `--ref` 角色参考图以保持角色一致性
- 从第 01-page 起，额外传入前一页的 .jpeg 作为第二个 `--ref`，保持场景风格延续
- Prompt 用中文编写，图片中的文字除专有名词外应使用中文
