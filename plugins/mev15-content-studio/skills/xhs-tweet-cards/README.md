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

## 用法

```bash
node scripts/render.mjs article.md --out ./cards
node scripts/render.mjs article.md --out ./cards \
  --name 昵称 --handle "@X: xxx" --avatar avatar.png --no-verified --footer-note "文字"
```

输出 `card-01.png`…（2160×2880）与 `manifest.json`。

## 分页规则

- Markdown 中单独一行 `---` 为强制分页符（作者控制切点）
- 其余按块级元素边界自动分页，不切断段落
- 单个超高元素（长代码块、大图）独占一页并等比缩放
- 文中本地图片自动内联为 data URL

## 改样式

改 `assets/template.html`。**内容排版规则必须写在 `.prose` 前缀选择器下** —— 分页测量容器与真实卡片共用这个类，否则测量与渲染不同步，页面会溢出。同理，`render.mjs` 里测高度的探针卡必须带头像与页码占位，否则 header/footer 测矮，每页会超塞。

## 许可

MIT。推文壳视觉基调参考 [write-then-publish](https://github.com/fxyadela/write-then-publish)（MIT）与 Twitter/X 官方配色，代码为独立实现。
