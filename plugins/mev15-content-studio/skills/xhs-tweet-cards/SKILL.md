---
name: xhs-tweet-cards
description: 把 Markdown/HTML 文章渲染成带 Twitter 壳（头像+昵称+蓝V+@handle）的小红书 3:4 多图卡片，生成配套发帖文案、整组 HTML 画廊，并登记到 output/preview/index.html 统一入口。原文保真：内容不经 LLM 改写，只做确定性排版分页。触发词："小红书多图"、"tweet 卡片"、"推文卡片"、"文章转卡片"、"xhs cards"。
---

# xhs-tweet-cards：文章 → 推文壳小红书多图 + 发帖文案

## 一、这个 skill 做什么

- **输入**：一篇 Markdown 或 HTML 文章（文件路径，或对话中的内容先写入临时 .md 文件）
- **输出**：
  1. `card-NN.png` 序列 —— 2160×2880（3:4，小红书规格）推文样式卡片，内容一字不改
  2. `caption.txt` —— 小红书发帖文案（标题 + 正文 + 话题标签），这部分由你（Claude）撰写
  3. `manifest.json` —— 页数与每页摘要
  4. `index.html` —— 一页汇总本组全部卡片，可点开 2160×2880 原图并查看文案
  5. `<WORKSPACE_ROOT>/output/preview/index.html` —— 与 gzh-design 共用的统一预览入口

## 二、执行流程

### 1. 配置检查（首次使用必做）

读取 `config.json`（本 skill 根目录）。若 `displayName` 仍为占位值「你的昵称」，提醒用户配置：

```json
{
  "displayName": "昵称",
  "handle": "@X: your_handle",
  "verified": true,
  "avatar": "/path/to/avatar.png",
  "footerNote": "",
  "htmlFontScale": 1.75
}
```

头像支持 png/jpg/webp，缺省时用昵称首字的蓝底圆形占位。用户临时覆盖用命令行参数即可，不必改文件。

### 2. 确定统一预览目录（强制）

`<WORKSPACE_ROOT>` 指当前文章项目或 Git 仓库根目录，不是 skill 安装目录。默认把产物写到：

```text
<WORKSPACE_ROOT>/output/preview/xhs/{文章标识}/{版本}/
```

- `{文章标识}` 默认取原稿文件名的稳定短名称；同一篇 Markdown 与 HTML 必须使用同一个标识。
- `{版本}` 使用 `markdown`、`html` 或其他能明确区分来源的短名称。
- 不再把面向用户的预览默认写到 `output/xhs-preview/`；只有用户明确指定 `--out` 时才走独立目录模式。

### 3. 渲染

```bash
node <skill根目录>/scripts/render.mjs <input.md> \
  --preview-root <WORKSPACE_ROOT>/output/preview \
  --article-id <文章标识> \
  --variant markdown

node <skill根目录>/scripts/render.mjs <input.html> \
  --preview-root <WORKSPACE_ROOT>/output/preview \
  --article-id <同一文章标识> \
  --variant html

# 独立目录模式（不登记统一入口）
node <skill根目录>/scripts/render.mjs <input.md> --out <输出目录>
```

- 可选覆盖：`--name`、`--handle`、`--avatar`、`--no-verified`、`--footer-note`、`--title`、`--source-label`。
- 输入 `.md` 经 marked（gfm + breaks）确定性转换。
- 输入 `.html/.htm` 保留主题、颜色、内容块和字号层级；自动展开包裹全文的单一顶层容器，并默认把内联 px 字号放大 `1.75` 倍以适配 1080px 卡片（公众号正文 `16px` → 卡片 `28px`，图注 `12px` → `21px`）。需要微调时传 `--html-font-scale <倍率>`；不要直接保留公众号 16px，否则卡片正文会明显过小。
- **分页规则**：按块级元素边界自动分页；Markdown 中单独一行 `---` 为强制分页符（作者控制切点）；单个超高元素（长代码块/大图）独占一页并等比缩放
- 文中本地图片引用会自动内联；远程图片需网络可达
- 渲染完成会自动生成本组 `index.html`，并重建 `<WORKSPACE_ROOT>/output/preview/index.html`；索引同时扫描公众号排版和 XHS 画廊，不得手工拼接链接。
- 小红书单帖最多 18 张图，超出时建议用户精简或拆帖

### 4. 出图质量自检（必做）

用 Read 查看第一张与最后一张 PNG，确认：每页头像/昵称页眉完整、页码完整、无文字溢出或截断、页尾无异常大片空白、中文与 emoji 渲染正常。HTML 输入还要确认正文大小接近 Markdown 版，而不是公众号原始 16px 的微缩效果。发现溢出通常是模板样式与测量不同步导致——检查 `assets/template.html` 中内容样式是否都挂在 `.prose` 选择器下（测量容器依赖它）。

### 5. 撰写小红书文案（写入 `<输出目录>/caption.txt`）

基于原文提炼，**这一步是创作，不受"原文保真"约束**，但观点必须忠于原文：

- **第 1 行：标题**，≤20 个字（平台硬限制），有钩子但不标题党
- **第 2 行：空行**
- **正文**：≤1000 字（平台硬限制）。口语化、短段落、适度 emoji；**不要用任何 Markdown 语法**（小红书不渲染）；结构建议：一句共鸣开场 → 3-5 个要点（可用 ① ② ③ 或 emoji 列表）→ 一句行动建议或提问引导互动
- **结尾**：3-6 个相关话题，格式 `#话题名` 空格分隔
- 画廊页会在浏览器中读取同目录 `caption.txt`；保存文案后刷新画廊即可，无需重新渲染卡片。

### 6. 汇报

告知：统一入口 `<WORKSPACE_ROOT>/output/preview/index.html`、本组画廊路径、卡片张数、每页内容分布（读 manifest.json 的 summaries）、caption 全文。若用户通过 HTTP 预览服务访问，优先给统一入口对应的 HTTP 地址。提醒用户：图片和文案就绪后可交给 `xhs-draft-publish` skill 存入小红书草稿箱。

## 三、技术边界

- 渲染引擎：Playwright chromium headless（`--no-sandbox`），依赖已在 skill 目录 `npm install`
- 字体：Noto Sans CJK SC + Noto Color Emoji（系统级，已安装）
- 样式基调：Twitter 官方配色（#0f1419 / #536471 / #1d9bf0），观感对齐 write-then-publish（MIT）的推文壳
- 修改卡片样式改 `assets/template.html`；**改内容排版样式必须用 `.prose` 前缀选择器**，否则分页测量失准
- `assets/gallery.html` 是整组卡片画廊模板；统一索引由 `render.mjs` 扫描 `output/preview/` 后确定性重建
