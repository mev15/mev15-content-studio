---
name: xhs-carousel
description: 将 Markdown、HTML 或长文全自动重组为带 Twitter 账号壳的青十五品牌小红书 3:4 轮播图文：尽量沿用原文措辞，通过删减与合并提炼故事板，优先保留原文中有助理解的图片，再自动生成 1080×1440 PNG、整组预览和发帖文案并校验溢出、字号与留白。用于“小红书图文”“小红书轮播”“文章转小红书多图”“carousel cards”等传播型重排任务；默认无需用户手动分页、选模板或编辑 HTML。
---

# xhs-carousel

把文章当作内容来源，不把 Markdown 或 HTML 当作截图目标。自动完成“提炼 → 故事板 → 版式 → 渲染 → 校验 → 预览”。

## 自动化约定

- 不询问分页、模板、字号、配色或图源；根据内容直接决定。
- 页数由语义单元与手机可读性决定，通常 5–10 张，最多 15 张；不为凑固定张数硬拆内容，也不为压页数把文字塞小。每页只表达一个核心信息；相邻内容在解释同一件事且合并后仍清晰时才合并。
- 默认使用 Twitter 账号壳与固定的青十五 Swiss 内容系统。用户可用提示词调整重点、语气、页数或图片范围，但无需操作编辑器。
- 优先使用原文中有助理解的图片或截图，并服从用户指定的章节范围与排除规则。没有图片时使用排版、清单、对比和流程表达，不为了填空主动搜索或生成装饰图。
- 忠于原文事实和作者语气。压缩时以删除、截短、合并原句为主，尽量沿用原词、判断和第一人称；只有为了页面衔接才补少量连接语。
- Markdown 的 `**粗体**` 与 `==高亮==` 是作者显式标出的重点，生成故事板时必须连同标记保留；渲染分别使用加粗与荧光笔效果，不得降级为普通正文。
- 两个或多个工具介绍页优先采用统一的 `tool` 版式：标题区展示工具名、原文高亮的官网路径与可核实的官方图标，下方保留原文截图和说明。需要图标时先查官网或官网指向的官方仓库并记录来源；无法核实时使用字标回退，不使用第三方素材冒充官方图标。
- 收束页需要帮助读者在多个工具间选择时，在对应列表项复用前文已核实的官方图标；非工具项不强行补图标。
- 被压缩掉的解释放进发帖正文，不把全文塞回图片。

## 执行流程

### 1. 读取来源

读取用户指定的 Markdown、HTML 或文本。HTML 只提取内容、层级与图片，不继承原 CSS。识别：核心结论、读者收益、3–7 个关键观点、证据图片、用户指定的图片包含/排除边界，以及可进入发帖正文的补充细节。

建立原文措辞清单：每页标题、条目和图片说明优先从原文截取；同时记录原文的粗体与高亮范围，作为页面层级和视觉强调依据；不得把作者的具体经验改写成泛化的教程口吻。

### 2. 生成故事板

开始前读取：

- `references/storyboard-schema.md`：JSON 字段、字数和页数约束。
- `references/layout-system.md`：版式角色与自动选择规则。

在文章项目内写入临时或成品 `storyboard.json`。必须包含：

- `title`、`source`。
- `pages`：封面 + 内容页 + 收束页。
- `post`：小红书标题、正文和标签。

不要向用户展示或要求确认故事板；除非用户明确要求先看规划，否则直接继续渲染。

### 3. 渲染

安装目录记为 `<skill>`，文章仓库根目录记为 `<workspace>`：

```bash
node <skill>/scripts/render.mjs <storyboard.json> \
  --preview-root <workspace>/output/preview \
  --article-id <稳定文章标识> \
  --variant carousel
```

独立输出可用：

```bash
node <skill>/scripts/render.mjs <storyboard.json> --out <输出目录>
```

身份配置优先级：命令行 > 进程环境变量 > `~/.config/xhs-carousel/env` > 内置默认值。可配置：

```dotenv
XHS_CAROUSEL_DISPLAY_NAME=青十五
XHS_CAROUSEL_HANDLE=mev15_eth
XHS_CAROUSEL_AVATAR=/absolute/path/to/avatar.jpg
XHS_CAROUSEL_VERIFIED=true
XHS_CAROUSEL_FOOTER_NOTE=
```

未配置头像时，自动寻找同一插件内 `qing-shiwu-illustrations/assets/ip-reference/qing-shiwu-avatar.jpg`。

### 4. 自动修正

渲染器会把检查结果写入 `validation.json`。命令失败时：

1. 读取具体页面与错误；
2. 先判断低利用率页是否能与同主题相邻页自然合并；合并会造成密度过高时，改为缩短文案、减少条目或调整局部版式；
3. 重新渲染，最多自动修正 3 轮；
4. 不通过缩小全局正文、改变画布或要求用户手动分页来规避问题。

### 5. 视觉检查

渲染成功后，先看整组画廊，再逐张检查封面、列表/步骤页、每张图片页、每张工具页和最后一页原图。按 `references/qa.md` 检查一眼可懂、层级、留白与跨页节奏。发现问题直接调整故事板并重渲染，不把内部版式选择抛给用户。

### 6. 交付

输出目录包含：

- `card-01.png` 等 1080×1440 图片。
- `deck.html`：实际渲染源。
- `index.html`：整组画廊。
- `storyboard.json`：最终故事板。
- `caption.txt`：可粘贴的小红书文案。
- `manifest.json`、`validation.json`。

使用 `--preview-root` 时自动登记到 `<workspace>/output/preview/index.html`；统一入口只展示最近处理文章的最新 carousel，不堆叠历史测试变体。汇报统一入口、卡片张数和主题结构；图片就绪后可交给 `xhs-draft-publish` 存入草稿箱。

## 边界

- 这不是逐字分页工具，但必须尽量保留原文措辞与作者口吻；需要逐字保留时使用 `xhs-tweet-cards`。
- 不提供可视化编辑器、手动分页语法或模板选择界面。
- 不正式发布内容，只生成资产；存草稿使用 `xhs-draft-publish`。
- 上游来源与修改说明见 `UPSTREAM.md`，代码按 AGPL-3.0-or-later 发布。
