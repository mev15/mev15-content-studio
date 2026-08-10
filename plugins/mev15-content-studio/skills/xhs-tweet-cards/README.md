# xhs-tweet-cards

把 Markdown / HTML 文章渲染成带 Twitter 壳（圆头像 + 昵称 + 蓝V + `@handle` + 页码）的小红书 3:4 图文卡片，附带小红书发帖文案。

**原文保真**：内容只经 marked 确定性转换与 DOM 分页，不经任何 LLM 改写。文案（`caption.txt`）是另写的，属创作。

## 安装

```bash
cd <此目录> && npm install
npx playwright install chromium          # 若 ~/.cache/ms-playwright 尚无匹配 build
```

系统需有中文字体，Debian/Ubuntu：

```bash
apt-get install -y fonts-noto-cjk fonts-noto-color-emoji
```

## 配置

编辑 `config.json`：

```json
{
  "displayName": "昵称",
  "handle": "@X: your_handle",
  "verified": true,
  "avatar": "/path/to/avatar.png",
  "footerNote": ""
}
```

`avatar` 留空时用昵称首字的蓝底圆形占位。命令行参数可临时覆盖，不必改文件。

也可复制 `.env.example` 为 `.env`。优先级为命令行 > 进程环境变量 > `.env` > `config.json`，支持 `XHS_TWEET_CARDS_DISPLAY_NAME`、`XHS_TWEET_CARDS_HANDLE`、`XHS_TWEET_CARDS_AVATAR`、`XHS_TWEET_CARDS_VERIFIED`、`XHS_TWEET_CARDS_FOOTER_NOTE` 和 `XHS_TWEET_CARDS_HTML_FONT_SCALE`。

## 用法

```bash
node scripts/render.mjs article.md \
  --preview-root <工作区>/output/preview \
  --article-id article \
  --variant markdown

node scripts/render.mjs article.html \
  --preview-root <工作区>/output/preview \
  --article-id article \
  --variant html

# 独立目录模式
node scripts/render.mjs article.md --out ./cards \
  --name 昵称 --handle "@X: xxx" --avatar avatar.png --no-verified --footer-note "文字"
```

统一预览模式默认输出到 `<工作区>/output/preview/{文章}/{版本}/`，生成 `card-01.png`…（2160×2880）、`manifest.json`、整组画廊 `index.html`，并刷新 `<工作区>/output/preview/index.html`。`preview/` 下每篇文章只有一个顶层目录，公众号与小红书产物共用该文章目录；不再创建 `output/xhs-preview/` 或 `output/preview/xhs/`。统一入口中的小红书区域只展示最近处理文章的最新 Markdown 版与最新 HTML 版，各来源最多一套；公众号预览不受影响。画廊会自动读取同目录 `caption.txt`。

排版固定使用 864×1152 逻辑画布、34px 正文、1.65 行高和 42px 左右边距，再以 2.5 倍导出 2160×2880。常规长文以 15 张为内容目标，通过列表拆分、紧凑块间距和分页利用率控制页数，不缩小正文视觉大小。

HTML 输入会保留颜色、强调、标题、代码与媒体，同时移除造成大块留白的公众号白色卡片外壳，把自定义列表拆成可分页条目，并统一数字序号对齐。内联 16px 正文默认归一到 34px。

## 分页规则

- Markdown 中单独一行 `---` 为强制分页符（作者控制切点）
- 其余按块级元素边界自动分页，不切断段落
- 单个超高元素（长代码块、大图）独占一页并等比缩放
- 文中本地图片自动内联为 data URL
- HTML 全文只有一个顶层容器时会自动展开后分页，避免整篇缩成一张
- 长页面逐张截图时锁定视口和滚动位置，确保每页头像、正文与页脚完整
- 页数由内容自然产生；超过小红书单帖 18 张时拆帖，不缩小全局字号

## 改样式

改 `assets/template.html`。**内容排版规则必须写在 `.prose` 前缀选择器下** —— 分页测量容器与真实卡片共用这个类，否则测量与渲染不同步，页面会溢出。同理，`render.mjs` 里测高度的探针卡必须带头像与页码占位，否则 header/footer 测矮，每页会超塞。

## 许可

MIT。推文壳视觉基调参考 [write-then-publish](https://github.com/fxyadela/write-then-publish)（MIT）与 Twitter/X 官方配色，代码为独立实现。
