---
name: xhs-tweet-cards
description: 把 Markdown/HTML 原文确定性分页为带 Twitter 壳（头像+昵称+蓝V+@handle）的小红书 3:4 卡片，固定使用 864×1152 逻辑画布、34px 正文和 2.5× 高清导出；内容不经 LLM 改写。仅在用户明确要求“推文壳”“tweet 卡片”“原文保真”“逐字保留”“不改写”或旧 document 模式时使用；普通“小红书图文/轮播/文章转多图”应使用 xhs-carousel，不要触发本 skill。
---

# xhs-tweet-cards：文章 → 推文壳小红书多图 + 发帖文案

这是原文保真兼容模式。没有明确要求推文壳或逐字保留时，改用 `xhs-carousel` 做传播型语义重排。

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

配置优先级固定为：命令行参数 > 进程环境变量 > skill 根目录 `.env` > `config.json`。若身份仍为占位值，提醒用户配置。推荐复制 `.env.example` 为 `.env`：

```dotenv
XHS_TWEET_CARDS_DISPLAY_NAME=昵称
XHS_TWEET_CARDS_HANDLE=your_handle
XHS_TWEET_CARDS_AVATAR=/absolute/path/to/avatar.jpg
XHS_TWEET_CARDS_VERIFIED=true
XHS_TWEET_CARDS_FOOTER_NOTE=
XHS_TWEET_CARDS_HTML_FONT_SCALE=2.125
```

头像支持 png/jpg/webp，handle 可写 `mev15_eth` 或 `@mev15_eth`，渲染时统一显示为 `@mev15_eth`。缺省头像时用昵称首字的蓝底圆形占位。可用 `--env-file <路径>` 指定其他 env 文件。

### 2. 确定统一预览目录（强制）

`<WORKSPACE_ROOT>` 指当前文章项目或 Git 仓库根目录，不是 skill 安装目录。默认把产物写到：

```text
<WORKSPACE_ROOT>/output/preview/{文章标识}/{版本}/
```

- `{文章标识}` 默认取原稿文件名的稳定短名称；同一篇 Markdown 与 HTML 必须使用同一个标识。
- `{版本}` 使用 `markdown`、`html` 或其他能明确区分来源的短名称。
- `preview/` 下每篇文章只有一个顶层目录；公众号 HTML 与小红书各版本都收在该文章目录内。不得创建 `output/xhs-preview/` 或 `output/preview/xhs/`；只有用户明确指定 `--out` 时才走独立目录模式。
- 统一入口中的小红书区域只展示最近处理文章的最新 Markdown 版与最新 HTML 版，各来源最多一套；公众号预览不受影响。旧测试变体不会继续堆在入口中。

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

- 可选覆盖：`--name`、`--handle`、`--avatar`、`--no-verified`、`--footer-note`、`--env-file`、`--title`、`--source-label`。
- 输入 `.md` 经 marked（gfm + breaks）确定性转换。
- Markdown 的 `**粗体**` 与 `==高亮==` 都必须保留为视觉重点；`==...==` 渲染为荧光笔效果，不能把等号原样露出。HTML 输入保留原有 `strong`、`mark` 与等价强调样式。
- 固定设计令牌：逻辑画布 `864×1152`、正文 `34px`、行高 `1.65`、左右边距 `42px`；以 `2.5×` 导出 `2160×2880`。保持正文视觉大小，通过紧凑页眉页脚、块间距和分页利用率把常规长文控制在 15 张以内。
- 输入 `.html/.htm` 时保留颜色、强调、章节标题、代码和媒体；移除造成分页浪费的公众号白色卡片外壳，把长列表拆回可分页的条目，并统一数字序号的网格、字号和首行对齐。默认把内联 `16px` 正文归一到 `34px`。
- **分页规则**：按可读块边界自动分页；标题与下一块保持同页，图片与图注保持同页；Markdown 中单独一行 `---` 为强制分页符；单个真正超高的代码块或图片才允许独占页并等比缩放。
- 文中本地图片引用会自动内联；远程图片需网络可达
- 渲染完成会自动生成本组 `index.html`，并重建 `<WORKSPACE_ROOT>/output/preview/index.html`；索引同时扫描公众号排版和 XHS 画廊，不得手工拼接链接。
- 页数由原文内容自然产生，不先指定固定张数。内容目标为不超过 15 张；16–18 张视为分页质量不达标，优先检查原子容器、列表拆分和异常留白，不缩小 34px 正文。平台硬上限仍为 18 张。

### 4. 出图质量自检（必做）

查看整组画廊的全部缩略图，并打开第一张、所有图片页、列表页、低利用率页和最后一张原图，确认：尺寸为 2160×2880、身份信息正确、页码完整、粗体/高亮正常、图注居中、无截断、无异常大片留白。读取 `manifest.json` 的 `fillRatios`：除纯媒体页和末页外，低于 60% 的页面必须复查。HTML 输入还要确认正文为统一 34px，数字序号与首行对齐，列表没有因整块缩放而变小。

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
- 样式基调：Twitter 官方配色（#0f1419 / #536471 / #1d9bf0）；正文视觉比例对齐 write-then-publish（MIT）的 864px 画布 / 34px 正文基准
- 本模式只复现原文，不主动搜索或添加工具图标、不重组同主题段落；需要提炼、合并和统一工具卡时使用 `xhs-carousel`
- 修改卡片样式改 `assets/template.html`；**改内容排版样式必须用 `.prose` 前缀选择器**，否则分页测量失准
- `assets/gallery.html` 是整组卡片画廊模板；统一索引由 `render.mjs` 扫描 `output/preview/` 后确定性重建
