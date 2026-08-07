---
name: x-publish
description: 把 markdown 原稿一键转换并发布到 X (Twitter) Articles 草稿箱：自动做 md → content_state（DraftJS）结构转换，代码块转 blockquote、表格改写为列表、正文图片与封面上传为 X 媒体，最后调官方 POST /2/articles/draft 创建草稿。直连 X 官方 API（OAuth 2.0 PKCE），零 npm 依赖。触发场景：(1) 用户说"发到 X""同步到 X 草稿""发 Twitter 长文/Articles"，(2) 文章 markdown 定稿后要推送到 X，(3) 用户给出 md 文件和封面要求发布到 X。只创建草稿，绝不正式发布；输入是 markdown 原稿而非排版 HTML（X Articles 不接受自定义样式）。
---

# X Articles 草稿发布 Skill

把一篇 **markdown 原稿**（不是排版 HTML）转换并发布到 X (Twitter) Articles **草稿箱**。脚本会：

1. 解析 markdown，转换为 X Articles 的 `content_state`（DraftJS 结构，snake_case 字段）；
2. 正文图片（本地路径或外链均可）上传到 X 媒体端点（`media_category=tweet_image`），封面同理；
3. 调 `POST /2/articles/draft` 创建草稿，输出 article id。

全程只调 `api.x.com` 官方接口，内容与凭据不经过任何第三方。

## 排版转换规则（X Articles 只有语义块，无任何自定义样式）

| markdown | X Articles | 说明 |
|---|---|---|
| 第一个 `#` H1 | 文章标题 | 从正文抽出；`--title` 可覆盖 |
| `#` / `##` / `###` | header-one/two/three | 正文中再出现的 H1 保留为 header-one |
| `####` 及更深 | 整段粗体 | X 无 H4-H6 |
| 粗体/斜体/删除线 | inline_style_ranges | 一一对应 |
| `[文本](url)` | link entity | 一一对应 |
| 行内代码 | 纯文本 | X 无 code 样式，反引号剥除 |
| 代码块 | blockquote（整块） | 块内保留换行；X 无代码块类型，等宽与高亮丢失，适合短命令片段 |
| 表格 | 无序列表（首行视为表头、首列为行主键） | > 3 列会警告；数据表格建议改链 Dune |
| 无序/有序列表 | list-item（缩进转 depth，上限 2） | 嵌套渲染效果以 X 实际为准 |
| `>` 引用 | blockquote | 一一对应 |
| 独立成行的 `![](...)` | atomic 图片块 | 仅 jpg/png/webp ≤ 5MB；GIF/SVG 警告跳过 |
| 行内图片 | 降级为 alt 文本 | 图片请独立成行 |
| `---` 分割线 | 跳过并警告 | API 无 divider 元素 |

## 前置条件（一次性）

- **发布账号开通 X Premium**（任意档位；Articles 功能的硬性要求）。
- **X 开发者 App**（[developer.x.com](https://developer.x.com)）：创建项目与 App（2026 年起新开发者为按量计费，写入约 $0.015/次，草稿成本可忽略）；在 App 的 User authentication settings 里开启 OAuth 2.0，Type of App 选 Native App（public client）或 Web App（confidential），**Callback URL 填一个你记得住的地址**（如 `http://localhost:8917/callback`，无需真的有服务在听）。
- Node.js ≥ 22.6（单文件 TypeScript，`--experimental-strip-types` 运行；Node ≥ 23.6 或 ≥ 22.18 可省略该 flag）。

凭据放在**本机配置目录**（skill 本体无状态；模板见本目录 `env.example`）：

```bash
mkdir -p ~/.config/x-publish && chmod 700 ~/.config/x-publish
cp env.example ~/.config/x-publish/env   # 填入 Client ID / Callback URL
chmod 600 ~/.config/x-publish/env
```

然后完成一次 OAuth 授权（PKCE，全程复制粘贴，无需本机浏览器，适合 headless 服务器）：

```bash
node --experimental-strip-types scripts/publish_article.ts --login
```

按提示在任意设备浏览器打开授权 URL → 授权后浏览器跳转到回调地址（打不开是正常的）→ **30 秒内**把地址栏完整 URL 粘回终端。token 存入 `~/.config/x-publish/tokens.json`，之后自动用 refresh token 静默续期（X 的 refresh token 每次轮换，脚本会自动写回）。

## 用法

先 dry-run 核对转换计划（不调任何 API、不需要凭据）：

```bash
node --experimental-strip-types scripts/publish_article.ts \
  --md drafts/my-article.md \
  --cover covers/x-cover.jpg \
  --dry-run
```

dry-run 会完整打印将提交的 `content_state` JSON、图片上传清单与全部警告。确认后去掉 `--dry-run` 正式创建草稿。

### 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `--md` | ✅ | markdown 原稿路径；标题默认取第一个 H1 |
| `--cover` | | 封面图（jpg/png/webp ≤ 5MB）；可省略，草稿建好后在网页编辑器补 |
| `--title` | | 覆盖标题 |
| `--dry-run` | | 只打印转换计划与 content_state，不产生任何外部副作用 |
| `--login` | | 运行一次 OAuth 2.0 PKCE 授权 |

## 双平台安装（Claude Code / Codex）

SKILL.md 仅使用 `name` + `description` frontmatter，两端通用；脚本自包含、无状态。

- **Claude Code**：本 plugin 自带，无需安装。
- **Codex CLI**：把本目录整个复制（或 symlink）到 Codex 的 skills 目录即可：

```bash
mkdir -p ~/.codex/skills
cp -r <本目录> ~/.codex/skills/x-publish     # 或 ln -s
```

两端共用 `~/.config/x-publish/` 的凭据与 token，授权一次即可。

## 与本 plugin 其他 skill 的衔接

- 输入取**文章的 markdown 源稿**——即 `gzh-design` 排版之前的那份原稿。不要传排版 HTML：X Articles 没有自定义样式，主题系统在 X 侧无意义。
- `qing-shiwu-illustrations` 生成的封面 → 按 X 文章头图比例（约 5:2）出图后作 `--cover` 传入；正文配图本地路径或图床外链均可，脚本会统一上传到 X。
- 同一篇文章双平台发布：md 原稿 → `x-publish` 进 X 草稿箱；md → `gzh-design` 排版 → `gzh-publish` 进公众号草稿箱。

## 常见错误对照

| HTTP | 含义与处理 |
|---|---|
| 401 | token 无效/过期——重新 `--login`；若刚改过 scope 也需重新授权 |
| 403 | 账号未开 X Premium，或开发者 App 未挂到有效计费项目 |
| 429 | 限流——稍后重试 |
| 503 | X 服务端错误；若带了 `--cover` 可去掉重试（社区反馈 cover_media 偶发 503），封面事后在编辑器补 |

## 边界与安全

- **只写草稿箱**：脚本没有任何 `articles/{id}/publish` 调用；草稿在 x.com 桌面网页版的发帖框 → Articles 里查看、编辑、删除；重复运行创建新草稿而非覆盖。
- OAuth token 等同账号发文权限：`tokens.json` 与 `env` 均 0600 存放于本机，不要提交仓库。scopes 最小化为 `tweet.read tweet.write users.read media.write offline.access`。
- **schema 注意**：Articles API 较新，官方文档示例不全。`cover_media` 结构已实测确认为 `{media_id, media_category}`（2026-08 通过 API 校验错误信息反推并验证）；link entity 按 DraftJS 惯例实现、API 已接受。若草稿内容渲染异常，先 `--dry-run` 核对 JSON，再对照 [官方文档](https://docs.x.com/x-api/articles/introduction) 当前版本调整。
