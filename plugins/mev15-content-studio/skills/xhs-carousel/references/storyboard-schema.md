# 故事板格式

渲染器只接受 JSON。所有可见文本不得写 HTML；允许且只允许保留两种原文内联重点标记：`**粗体**` 与 `==高亮==`。文案优先从原文截取，通过删减和合并控制长度，不把个人经验泛化改写。

```json
{
  "title": "远程工作流实践",
  "source": "/absolute/path/article.md",
  "pages": [
    {
      "type": "cover",
      "eyebrow": "工作流复盘",
      "title": "把远程工作变稳定",
      "subtitle": "环境、协作和日常操作一次讲清",
      "tags": ["远程开发", "工作流", "效率"]
    },
    {
      "type": "list",
      "eyebrow": "先说结论",
      "title": "先统一工作环境",
      "intro": "稳定协作更依赖一致的环境与流程。",
      "items": [
        {"title": "准备", "text": "确认运行环境和访问方式"},
        {"title": "协作", "text": "统一项目目录与操作入口"}
      ]
    }
  ],
  "post": {
    "title": "远程工作流复盘",
    "body": "可直接发布的纯文本正文。",
    "tags": ["#远程开发", "#工作流", "#效率工具"]
  }
}
```

## 硬约束

- `pages`：4–15 张；通常 5–10 张。页数服从语义与可读性，不设固定目标张数。
- 第一张必须是 `cover`；最后一张优先 `summary` 或 `quote`。
- 封面标题尽量不超过 20 个中文字符，正文页标题尽量不超过 16 个中文字符。
- 每页只承担一个观点。列表或步骤通常 3–5 条，最多 6 条。
- 相邻段落或图片若解释同一件事，且合并后仍能保持正文可读、图片清楚和层级完整，则优先放在同一页；容量不足时允许拆页，不以连续性为由强塞。
- 原文 `**粗体**` 与 `==高亮==` 必须保留在相应 JSON 文本字段中；不得改成普通文本，也不得自行增加无依据的强调。
- 正文页补充文字控制在 20–100 个中文字符；细节进入 `post.body`。
- `post.title` 不超过 20 个字符；`post.body` 与标签合计不超过 1000 字。
- `tags` 使用带 `#` 的字符串，建议 3–6 个。

## 页面字段

### `cover`

必需 `title`；可选 `eyebrow`、`subtitle`、`tags`。

### `statement`

必需 `title`；可选 `eyebrow`、`body`、`accent`。用于单一结论，不承载长列表。

### `list`

必需 `title`、`items`；可选 `eyebrow`、`intro`。`items` 可写字符串，也可写 `{title,text,icon}`；`icon` 相对故事板解析，也可使用绝对路径或 HTTPS，仅用于需要快速识别的工具选项。

### `steps`

必需 `title`、`items`；可选 `eyebrow`、`intro`。每项使用 `{title,text}`，按顺序表达流程。

### `compare`

必需 `title`、`left`、`right`。左右字段均为 `{title,items}`，每侧 2–4 条短句。

### `quote`

必需 `quote`；可选 `eyebrow`、`title`、`note`。用于作者判断或收束，不伪造外部引语。

### `image`

必需 `title`、`src`；可选 `eyebrow`、`intro`、`caption`、`note`、`items`。`src` 相对故事板文件解析，也可使用绝对路径或 HTTPS。`caption` 优先使用 Markdown alt，`intro`、`note` 可截取图片附近的原文解释；宽图或结构图下方仍有较多空间时，可放 2–4 条原文步骤到 `items`，不得用装饰撑空。遵守用户指定的图片章节范围。

### `tool`

必需 `toolName`、`toolUrl`、`src`；可选 `eyebrow`、`title`、`icon`、`caption`、`note`。用于“工具名/官网 + 原文截图 + 一句说明”的产品介绍页。`toolUrl` 使用原文高亮的官网路径，标题区由渲染器固定高亮显示。`icon` 只允许使用官网或官网链接的官方仓库资源；查不到时省略，渲染器使用字标回退。同一组内多个工具页必须复用该版式与字段层级。

### `summary`

必需 `title`、`items`；可选 `eyebrow`、`closing`。通常作为最后一页。若条目在比较前文出现的工具，可给对应 `{title,text,icon}` 复用已核实的官方图标；非工具条目省略 `icon`。
