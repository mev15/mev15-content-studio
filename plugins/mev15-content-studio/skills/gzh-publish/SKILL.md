---
name: gzh-publish
description: 把排版好的微信公众号 HTML（正文配图为图床外链）和封面图一键同步到公众号草稿箱：自动下载正文外链图片、上传到微信素材库并替换为微信 CDN 链接，封面上传为永久素材，最后创建草稿。直连微信官方 API（AppID/AppSecret + IP 白名单），零第三方服务、零 npm 依赖。触发场景：(1) 用户说"发到草稿箱""同步到公众号""上传公众号素材/封面"，(2) gzh-design 排版完成后要推送到公众号，(3) 用户给出成品 HTML 和封面图要求发布。只创建草稿，绝不群发或正式发布；不做排版（排版用 gzh-design）。
---

# 公众号草稿发布 Skill

把一篇**已经排版好**的公众号 HTML（例如 `gzh-design` 的排版产物）连同封面图发布到微信公众号**草稿箱**。脚本会：

1. 扫描 HTML 中所有 `<img>` 的图床外链，逐张下载并调用微信 `media/uploadimg` 上传（不占素材库 10 万张配额），把外链替换为微信 CDN（`mmbiz.qpic.cn`）链接——**微信会过滤正文里的非微信域图片，这一步是必须的**；
2. 封面图调用 `material/add_material` 上传为永久素材，取得 `thumb_media_id`；
3. 调用 `draft/add` 创建草稿，输出草稿 `media_id`。

全程只调 `api.weixin.qq.com` 官方接口，内容与凭据不经过任何第三方。

## 前置条件（一次性）

- 公众号后台获取 **AppID / AppSecret**（设置与开发 → 基本配置）。
- 把运行机器的**出口 IP 加入公众号 IP 白名单**（同页面），否则所有调用报 `errcode 40164`。
- Node.js ≥ 22.6（脚本为单文件 TypeScript，用 `--experimental-strip-types` 运行；Node ≥ 23.6 或 ≥ 22.18 可省略该 flag）。

凭据放在**本机配置目录**（skill 本体无状态，可自由复制安装到任何端；模板见本目录 `env.example`）：

```bash
mkdir -p ~/.config/gzh-publish && chmod 700 ~/.config/gzh-publish
cp env.example ~/.config/gzh-publish/env   # 然后编辑填入真实值
chmod 600 ~/.config/gzh-publish/env
```

同名**进程环境变量优先**于配置文件（便于 CI 或一次性覆盖）；`XDG_CONFIG_HOME` 已设置时配置目录随之变化。

## 用法

先 dry-run 核对将要处理的图片清单（不调任何 API、不需要凭据）：

```bash
node --experimental-strip-types scripts/publish_draft.ts \
  --html output/preview/my-article/article.html \
  --cover covers/wechat-main.jpg \
  --title "文章标题" \
  --dry-run
```

确认无误后去掉 `--dry-run` 正式发布（凭据自动从配置目录读取，无需任何前缀）：

```bash
node --experimental-strip-types scripts/publish_draft.ts \
  --html output/preview/my-article/article.html \
  --cover covers/wechat-main.jpg \
  --title "文章标题" \
  --author "作者名" \
  --digest "可选摘要，不给则微信自动截取正文前 54 字" \
  --source-url "https://example.com/original"
```

### 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `--html` | ✅ | 排版产物 HTML 文件路径（正文片段，**不是** preview 包裹的完整页面） |
| `--cover` | ✅ | 封面图本地路径（jpg/png，微信头条封面建议 2.35:1） |
| `--title` | ✅ | 草稿标题（≤ 64 字） |
| `--author` | | 作者名 |
| `--digest` | | 摘要；省略则微信自动截取 |
| `--source-url` | | 「阅读原文」链接 |
| `--append-html` | | 发布前追加到正文末尾的 HTML 片段文件（如公众号名片，见下节），相对路径相对当前目录；不传时读配置 `GZH_APPEND_HTML`（相对路径相对 `~/.config/gzh-publish/`），两者都无则不追加 |
| `--dry-run` | | 只解析并打印计划，不调用微信 API |

## 与本 plugin 其他 skill 的衔接

- `gzh-design` 排版 → 拿它输出的**排版 HTML 片段**（可直接粘贴公众号编辑器的那份，不是 `output/preview/` 里带 `<html>` 骨架的预览页；误传预览页脚本会给出警告）。
- `qing-shiwu-illustrations` 生成的封面 → 作为 `--cover` 传入；正文配图若已上传图床并写进 HTML，将被自动搬运到微信素材库。

## 图片处理规则

- `http(s)` 外链且非微信域（`*.qpic.cn` / `*.weixin.qq.com`）→ 下载后上传替换。
- 已是微信域的链接 → 原样保留，跳过。
- `data:` URI、相对路径、本地路径 → 跳过并警告（请先传图床或改为外链）。
- `uploadimg` 仅支持 **jpg/png、单张 ≤ 1MB**；GIF 与超限图片会警告跳过（保留原链接，微信端会过滤，需手工处理）。

## 文末公众号名片（尾部片段）

想让每篇文章末尾自动带「公众号名片」卡片：把本目录的 `card.example.html` 复制为 `~/.config/gzh-publish/card.html`（和凭据同目录）并改成自己账号的字段，在同目录 `env` 里配 `GZH_APPEND_HTML=card.html` 即可每篇自动追加，单次可用 `--append-html` 覆盖。

名片组件模板（编辑器专用标签 `mp-common-profile`，真实填写示例见本目录 `card.example.html`）：

```html
<section style="margin-top:32px;">
<mp-common-profile class="js_uneditable custom_select_card mp_profile_iframe" data-pluginname="mpprofile" data-id="__BIZ__" data-headimg="__头像mmbiz地址__" data-nickname="__公众号名称__" data-alias="__微信号__" data-signature="__简介__" data-from="0"></mp-common-profile>
</section>
```

获取自己账号的真实字段最简单的办法：随便打开一篇自己历史文章的网页版，源码里搜 `mp-common-profile`，把整个标签原样复制出来（`data-id` 即公众号 `__biz` 值，头像已是 `mmbiz` 域名，脚本不会重复上传它）。

> ⚠️ 注意：`mp-common-profile` 是编辑器组件，`draft/add` 官方文档**未承诺**支持 API 注入。当前实测可用（草稿与发布均正常渲染为可点击名片），但属于未文档化行为，微信将来若调整内容清洗规则可能失效——失效的表现是卡片在草稿中消失或变成空白，不影响文章其余部分。

## 常见错误对照

| errcode | 含义与处理 |
|---|---|
| 40164 | 调用方 IP 不在白名单——去公众号后台把本机出口 IP 加上 |
| 40001 / 40013 | AppSecret / AppID 不对，检查环境变量 |
| 45009 | 接口调用超频，稍后重试 |
| 48001 | 接口权限不足——确认公众号类型与认证状态是否开放草稿箱 API |

## 边界与安全

- **只写草稿箱**，没有任何群发/正式发布调用；草稿可在公众号后台随手删除，重复运行会创建新草稿而不是覆盖。
- access_token 使用 `stable_token` 接口（`force_refresh=false`），不会踢掉其他调用方；**同一公众号请勿再混用旧版 `/cgi-bin/token` 接口**。
- AppSecret 等同于公众号 API 的完全控制权：只存于 `chmod 600` 的本机配置文件（`~/.config/gzh-publish/env`）或进程环境变量，不要写进脚本、日志或仓库。
