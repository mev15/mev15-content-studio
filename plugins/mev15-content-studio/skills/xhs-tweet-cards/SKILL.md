---
name: xhs-tweet-cards
description: 把 Markdown/HTML 文章渲染成带 Twitter 壳（头像+昵称+蓝V+@handle）的小红书 3:4 多图卡片，并生成配套的小红书发帖文案。原文保真：内容不经 LLM 改写，只做确定性排版分页。触发词："小红书多图"、"tweet 卡片"、"推文卡片"、"文章转卡片"、"xhs cards"。
---

# xhs-tweet-cards：文章 → 推文壳小红书多图 + 发帖文案

## 一、这个 skill 做什么

- **输入**：一篇 Markdown 或 HTML 文章（文件路径，或对话中的内容先写入临时 .md 文件）
- **输出**：
  1. `card-NN.png` 序列 —— 2160×2880（3:4，小红书规格）推文样式卡片，内容一字不改
  2. `caption.txt` —— 小红书发帖文案（标题 + 正文 + 话题标签），这部分由你（Claude）撰写
  3. `manifest.json` —— 页数与每页摘要

## 二、执行流程

### 1. 配置检查（首次使用必做）

读取 `config.json`（本 skill 根目录）。若 `displayName` 仍为占位值「你的昵称」，提醒用户配置：

```json
{
  "displayName": "昵称",
  "handle": "@X: your_handle",
  "verified": true,
  "avatar": "/path/to/avatar.png",
  "footerNote": ""
}
```

头像支持 png/jpg/webp，缺省时用昵称首字的蓝底圆形占位。用户临时覆盖用命令行参数即可，不必改文件。

### 2. 渲染

```bash
node <skill根目录>/scripts/render.mjs <input.md> --out <输出目录>
# 可选覆盖: --name 昵称 --handle @xx --avatar 头像路径 --no-verified --footer-note 文字
```

- 输入 `.html/.htm` 走原样渲染，`.md` 经 marked（gfm + breaks）确定性转换
- **分页规则**：按块级元素边界自动分页；Markdown 中单独一行 `---` 为强制分页符（作者控制切点）；单个超高元素（长代码块/大图）独占一页并等比缩放
- 文中本地图片引用会自动内联；远程图片需网络可达
- 小红书单帖最多 18 张图，超出时建议用户精简或拆帖

### 3. 出图质量自检（必做）

用 Read 查看第一张与最后一张 PNG，确认：无文字溢出/截断、页尾无异常大片空白、中文与 emoji 渲染正常。发现溢出通常是模板样式与测量不同步导致——检查 `assets/template.html` 中内容样式是否都挂在 `.prose` 选择器下（测量容器依赖它）。

### 4. 撰写小红书文案（写入 `<输出目录>/caption.txt`）

基于原文提炼，**这一步是创作，不受"原文保真"约束**，但观点必须忠于原文：

- **第 1 行：标题**，≤20 个字（平台硬限制），有钩子但不标题党
- **第 2 行：空行**
- **正文**：≤1000 字（平台硬限制）。口语化、短段落、适度 emoji；**不要用任何 Markdown 语法**（小红书不渲染）；结构建议：一句共鸣开场 → 3-5 个要点（可用 ① ② ③ 或 emoji 列表）→ 一句行动建议或提问引导互动
- **结尾**：3-6 个相关话题，格式 `#话题名` 空格分隔

### 5. 汇报

告知：输出目录、卡片张数、每页内容分布（读 manifest.json 的 summaries）、caption 全文。提醒用户：图片和文案就绪后可交给 `xhs-draft-publish` skill 存入小红书草稿箱。

## 三、技术边界

- 渲染引擎：Playwright chromium headless（`--no-sandbox`），依赖已在 skill 目录 `npm install`
- 字体：Noto Sans CJK SC + Noto Color Emoji（系统级，已安装）
- 样式基调：Twitter 官方配色（#0f1419 / #536471 / #1d9bf0），观感对齐 write-then-publish（MIT）的推文壳
- 修改卡片样式改 `assets/template.html`；**改内容排版样式必须用 `.prose` 前缀选择器**，否则分页测量失准
