# Mev15 Content Studio

面向中文内容创作的 Codex 插件包：微信公众号排版 + 青十五文章配图 + 公众号草稿箱发布。

## 包含的 skills

### `gzh-design`

把 Markdown、Word、PDF 或纯文本整理并排成可直接复制到微信公众号编辑器的 HTML。内置主题组件库、微信兼容校验、文章预览与 `output/preview/index.html` 统一入口。

本发行版额外包含两套已经固化、可直接选择的 AI 蓝色主题：

- **AI 科技蓝**：03 清晰数字蓝，信息感更明确，作为 AI 主题默认配色。
- **AI 清透湖蓝**：05 清透湖蓝，更轻柔、更舒展。

### `qing-shiwu-illustrations`

为中文文章生成青十五风格正文配图和微信公众号、X Articles、知乎等多平台封面。该 skill 与 [`mev15-illustrations`](https://github.com/mev15/mev15-illustrations) 中的当前版本保持一致。

### `gzh-publish`

把排版好的公众号 HTML（正文配图为图床外链）和封面图一键同步到公众号**草稿箱**：自动下载正文外链图片、上传微信素材库并替换为微信 CDN 链接，封面上传为永久素材，最后创建草稿。直连微信官方 API（需自己的 AppID/AppSecret，且运行机器出口 IP 已加公众号后台白名单），零第三方服务、零 npm 依赖（Node ≥ 22.6）。只写草稿箱，不群发、不正式发布。凭据配置：按 skill 内 `env.example` 模板复制到 `~/.config/gzh-publish/env`（本仓库不存放任何凭据）。

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
cp -R plugins/mev15-content-studio/skills/gzh-publish "${CODEX_HOME:-$HOME/.codex}/skills/"
```

### Claude Code

skills 遵循 SKILL.md 开放标准，同样适用于 Claude Code：

```bash
mkdir -p ~/.claude/skills
cp -R plugins/mev15-content-studio/skills/gzh-design ~/.claude/skills/
cp -R plugins/mev15-content-studio/skills/qing-shiwu-illustrations ~/.claude/skills/
cp -R plugins/mev15-content-studio/skills/gzh-publish ~/.claude/skills/
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

```text
Use $gzh-publish 把 article.html 和 cover.jpg 发布到公众号草稿箱，标题《……》。
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
- `gzh-publish` 为本仓库原创组件，按仓库根许可证 GNU AGPL-3.0-or-later 发布。

完整说明见 [NOTICE.md](NOTICE.md) 与 [LICENSES](LICENSES)。仓库根目录的默认许可证为 GNU AGPL-3.0-or-later；各独立组件目录中的许可证继续适用于对应组件。
