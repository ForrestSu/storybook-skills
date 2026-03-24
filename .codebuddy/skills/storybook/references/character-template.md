# 角色定义模板

## 角色文档格式

创建 `characters/characters.md`，格式如下：

```markdown
# 角色定义 - [绘本标题]

**画风**: [选定的画风]
**色调**: [整体色调方向]

---

## 角色 1: [名字]

**角色定位**: [主角 / 配角 / 导师 / 伙伴]
**年龄**: [大致年龄或年龄段]
**性格关键词**: [3-4 个词，如: 好奇、勇敢、善良]

**外貌特征**:
- 脸型: [圆脸/椭圆/方脸]
- 头发: [颜色、长短、发型]
- 眼睛: [颜色、大小、特征]
- 体型: [身高比例、胖瘦]
- 识别特征: [最显眼的特征，如：戴红帽子、有雀斑、缺一颗门牙]

**服装**:
- 主要服装: [详细描述]
- 主色调: [使用的颜色]
- 配件: [帽子、书包、围巾等]

**表情范围**:
- 日常/开心: [描述]
- 好奇/疑惑: [描述]
- 害怕/紧张: [描述]
- 得意/自豪: [描述]

**视觉备注**: [任何额外的美术方向说明]

---

## 角色 2: [名字]
...
```

## 角色参考图 Prompt 模板

角色定义写完后，需要生成一张角色参考图（character sheet），用作后续每一页生成的 `--ref` 参考图。

```markdown
## 角色参考图 Prompt

Character reference sheet, [画风] style, clean presentation:

[第一行 - 角色名]:
- Front view: [完整的外貌描述]
- 3/4 view: [侧面角度描述]
- Expression sheet: [开心] | [好奇] | [害怕] | [得意]

[第二行 - 角色名]:
- Front view: [完整的外貌描述]
- 3/4 view: [侧面角度描述]
- Expression sheet: [表情1] | [表情2] | [表情3] | [表情4]

COLOR PALETTE:
- [角色1]: [主要颜色 + hex]
- [角色2]: [主要颜色 + hex]

White background, labeled character names, consistent proportions across all views.
```

## 示例：小狐狸冒险记

```markdown
# 角色定义 - 小狐狸冒险记

**画风**: 水彩风 (Watercolor illustration)
**色调**: 暖色调为主，森林绿 + 秋日橙

---

## 角色 1: 小枫（Fox Kit）

**角色定位**: 主角
**年龄**: 幼年小狐狸（等同人类 5-6 岁）
**性格关键词**: 好奇、勇敢、有点冒失

**外貌特征**:
- 脸型: 圆润的狐狸脸，大眼睛
- 毛色: 橙红色主体，胸前和脸颊是奶白色
- 眼睛: 琥珀色，大而明亮
- 体型: 小巧，尾巴蓬松且比身体还大
- 识别特征: 左耳尖有一撮深棕色毛，尾巴尖是白色

**服装**:
- 主要服装: 天蓝色的小围巾
- 主色调: 天蓝色 #87CEEB
- 配件: 无

**表情范围**:
- 日常/开心: 眼睛弯成月牙，嘴角上扬
- 好奇/疑惑: 头微微歪向一侧，耳朵竖起
- 害怕/紧张: 耳朵向后压平，尾巴卷紧
- 得意/自豪: 昂着头，尾巴高高翘起

---

## 角色 2: 猫头鹰爷爷

**角色定位**: 导师
**年龄**: 老年猫头鹰
**性格关键词**: 睿智、慈祥、有点啰嗦

**外貌特征**:
- 脸型: 典型猫头鹰扁平圆脸
- 羽毛: 灰褐色，胸前是浅米色条纹
- 眼睛: 金黄色大圆眼，戴一副小圆框眼镜
- 体型: 圆胖，比小枫大三倍
- 识别特征: 戴小圆框眼镜，头顶有两簇像眉毛的翘羽毛

**服装**:
- 主要服装: 无衣服（毛色即外观）
- 配件: 小圆框眼镜（金色边框）

---

## 角色参考图 Prompt

Character reference sheet, soft watercolor illustration style, warm tones:

TOP ROW - 小枫 (Fox Kit):
- Front view: Small orange-red fox kit with cream-white chest and cheeks, large amber eyes, fluffy tail bigger than body with white tip, dark brown tuft on left ear tip, wearing sky-blue scarf
- 3/4 view: Same fox kit from side angle, showing fluffy tail and scarf
- Expression sheet: Happy (crescent eyes, smile) | Curious (head tilted, ears up) | Scared (ears flat back, tail curled) | Proud (chin up, tail raised)

BOTTOM ROW - 猫头鹰爷爷 (Grandpa Owl):
- Front view: Round chubby old owl, grey-brown feathers with cream striped chest, large golden eyes, small round gold-framed glasses, two tufted feathers on top like eyebrows
- 3/4 view: Same owl perched on branch, looking wise
- Expression sheet: Wise (calm gaze) | Amused (eyes squinted) | Worried (eyebrows furrowed) | Teaching (wing raised like pointing)

COLOR PALETTE:
- 小枫: Orange-red (#E8763A), Cream white (#FFF5E6), Sky blue scarf (#87CEEB), Amber eyes (#FFBF00)
- 猫头鹰爷爷: Grey-brown (#8B7D6B), Cream stripes (#F5F0E0), Gold glasses (#DAA520), Golden eyes (#FFD700)

White background, labeled character names in both Chinese and English, consistent proportions.
```

## 最佳实践

| 实践 | 说明 |
|------|------|
| 特征要具体 | "橙红色毛色，胸前奶白色" 而不只是"一只红色狐狸" |
| 设定识别标志 | 每个角色至少一个独特的视觉标志（围巾、眼镜、耳朵特征） |
| 给出色彩代码 | 用具体颜色名+hex值，避免 AI 每次随机配色 |
| 覆盖核心表情 | 至少定义 4 种表情，对应故事中会出现的情绪 |
| 体型比例关系 | 明确角色之间的大小比例关系 |

## 为什么角色参考图至关重要

AI 生成图片时，每次调用都是独立的——没有"记忆"。如果不提供参考图：
- 同一角色在不同页的外貌会完全不同
- 颜色、比例、服饰细节会随机变化
- 整本绘本看起来像是不同画师画的

通过生成一张统一的角色参考图并在每一页生成时通过 `--ref` 传入，可以显著提升跨页面的角色一致性。
