# 📖 Storybook - AI 儿童绘本生成系统

基于 AI 的儿童绘本自动生成系统。从故事主题出发，自动完成角色设计、分镜脚本、Prompt 编写、角色参考图生成、逐页插画生成，输出一本完整的绘本。


👉 实现效果可以看：**如何用 NanoBanana2 给小孩定制绘本**
![]()

## 🚀 安装

```bash
git clone git@github.com:ForrestSu/storybook-skills.git
cd storybook
npm install
```

## ⚙️ 配置

无需配置

## 🎨 使用

本项目包含两个 Skill，在 CodeBuddy Code 中通过斜杠命令调用。

### `/storybook` - 生成绘本 ✨

```
/storybook 我儿子最近不爱刷牙，结合 @prototype/pip-and-posy 里的角色图和故事模式帮我设计一个绘本，让他可以对刷牙感兴趣
```

**📂 生成结果：**

```
storybook/{slug}-{timestamp}/
├── characters/
│   ├── characters.md       # 角色定义
│   └── characters.jpeg     # 角色参考图
├── storyboard.md           # 分镜脚本
├── prompts/
│   ├── 00-cover.md         # 封面 Prompt
│   └── 01-page.md ~ ...    # 各页 Prompt
├── 00-cover.jpeg ~ ...     # 页面插画
└── all-pages.jpeg           # 长图预览
```

### `/refine` - 精调页面 🔧

对已生成的页面做局部修改，无需重新生成整本书：

```
/refine storybook/fox-story-0315/03-page.jpeg 小兔子表情应该更开心，嘴角上扬
```

系统会自动找到角色参考图和原始 Prompt，基于原图 + 修改指令重新生成。不满意可以继续迭代，满意后覆盖原图。
