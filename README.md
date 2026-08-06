# Mev15 Content Studio

面向中文内容创作的 Codex 插件包：微信公众号排版 + 青十五文章配图。

## 包含的 skills

### `gzh-design`

把 Markdown、Word、PDF 或纯文本整理并排成可直接复制到微信公众号编辑器的 HTML。内置主题组件库、微信兼容校验、文章预览与 `output/preview/index.html` 统一入口。

本发行版额外包含两套已经固化、可直接选择的 AI 蓝色主题：

- **AI 科技蓝**：03 清晰数字蓝，信息感更明确，作为 AI 主题默认配色。
- **AI 清透湖蓝**：05 清透湖蓝，更轻柔、更舒展。

### `qing-shiwu-illustrations`

为中文文章生成青十五风格正文配图和微信公众号、X Articles、知乎等多平台封面。该 skill 与 [`mev15-illustrations`](https://github.com/mev15/mev15-illustrations) 中的当前版本保持一致。

## 安装

### Codex plugin（推荐）

```bash
git clone https://github.com/mev15/mev15-content-studio.git
cd mev15-content-studio
codex plugin marketplace add "$PWD"
codex plugin add mev15-content-studio@mev15
```

安装或更新后，请开启一个新线程，让 Codex 重新加载 skills。

### 只复制 skills

不使用 plugin 功能时，也可以直接安装两个 skill：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R plugins/mev15-content-studio/skills/gzh-design "${CODEX_HOME:-$HOME/.codex}/skills/"
cp -R plugins/mev15-content-studio/skills/qing-shiwu-illustrations "${CODEX_HOME:-$HOME/.codex}/skills/"
```

## 使用示例

```text
Use $gzh-design 用 AI 科技蓝排版 article.md。
```

```text
Use $gzh-design 用 AI 清透湖蓝排版 article.md。
```

```text
Use $qing-shiwu-illustrations 处理 article.md，并生成多平台封面。
```

## 更新

```bash
git pull
codex plugin add mev15-content-studio@mev15
```

更新后请新开一个线程测试。

## 隐私

插件不包含遥测或后台上传逻辑。文章和排版结果默认写入当前工作区；生成图片时，相关提示词和参考素材会按你所配置的图像生成服务处理。发布前请阅读 [PRIVACY.md](PRIVACY.md)。

## 许可与上游

这是一个混合许可发行包：

- `gzh-design` 基于 [`isjiamu/gzh-design-skill`](https://github.com/isjiamu/gzh-design-skill)，按 GNU AGPL-3.0-or-later 发布，并保留原作者声明。
- `qing-shiwu-illustrations` 基于 Ian Xiaohei Illustrations，保留 MIT License 与 Ian 的署名要求。

完整说明见 [NOTICE.md](NOTICE.md) 与 [LICENSES](LICENSES)。仓库根目录的默认许可证为 GNU AGPL-3.0-or-later；各独立组件目录中的许可证继续适用于对应组件。
