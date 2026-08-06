# 多平台文章封面工作流

## 目标

一次调用完成“读全文 → 提炼统一封面概念 → 搜索可复用素材 → 生成母版 → 裁切或重排 → 输出四个精确尺寸成品”。四张成品必须像同一套封面，而不是互不相干的创意。

默认平台与输出：

| 平台 | 文件名 | 像素 | 比例 | 处理原则 |
|---|---|---:|---:|---|
| 微信公众号头条 | `cover-wechat-primary-900x383.png` | 900×383 | 2.35:1 | 从母版覆盖式裁切，主体保持居中安全 |
| 微信公众号次条 | `cover-wechat-secondary-500x500.png` | 500×500 | 1:1 | 优先安全裁切；主体过小或动作残缺时做方形重排 |
| X Articles | `cover-x-article-1920x368.png` | 1920×368 | 约 5.22:1 | 优先安全裁切；失败时用同一概念做超宽重排 |
| 知乎文章 | `cover-zhihu-1380x560.png` | 1380×560 | 约 2.46:1 | 从母版轻微裁切，保留高清二倍图 |

这些是制作预设，不是永久不变的平台 API 契约。平台规则变化或用户指定其他尺寸时，以用户和当前平台要求为准。

## 1. 读全文并定一个概念

提炼：

- 文章标题与一句话承诺。
- 最重要的判断，不要平均概括所有章节。
- 一个能同时代表文章主题和点击理由的物理隐喻。
- 青十五承担的核心动作。
- 1-2 个主物件；不要把目录画成模块图。

封面应比正文配图更像“视觉入口”：信息更少、轮廓更强、缩小后仍能认出。默认不把完整文章标题写进图里，平台页面会显示标题。允许 0-4 个极短批注；没有必要时不要加字。

## 2. 搜索并核对现有素材

画面涉及具体产品、服务、品牌或设备时，在写生图提示词前先搜索当前文章 workspace：

- 优先查看 `assets/icons/`、`assets/icons-drag-ready/`、`assets/logos/` 及用户指定的素材目录。
- 优先使用产品级图标；只有没有产品图标或用户明确指定时，才使用厂商级图标。
- 查看候选素材的标题、文件名和实际图形，不能只按相似关键词猜测。产品合并、更名或标志迁移时，以用户指定的当前标志为准。
- 把选定图标转换成图像模型可读的参考图并明确标注角色。使用实际图标表达产品，不要在画面中改用产品名文字。
- 没有可信素材时，使用无品牌的中性物件；不要凭记忆伪造官方标志。

## 3. 建立统一视觉方案

先写一个简短封面规格：

- 核心隐喻。
- 青十五从哪里露出上半身、双手做什么。
- 主物件与主路径。
- 黑、橙、红、蓝各自承担什么。
- 哪些元素必须在所有平台版本中保留。
- 哪些留白可以被裁掉。

母版、公众号次条方形重排版和 X 超宽重排版必须共享核心隐喻、角色动作、主物件、线稿风格和颜色语义。允许为目标比例调整物件间距、尺度与留白，不允许换成另一个故事。

## 4. 生成母版

用内置 `image_gen` 生成一张 16:9 横版母版，并把 `assets/ip-reference/qing-shiwu-avatar.jpg` 作为强制角色身份参考。

提示词在正文配图模板基础上增加：

```text
Use case: ads-marketing
Asset type: unified article cover master for WeChat Official Account, X Articles, and Zhihu

Create a sparse cover illustration, not a body infographic. Use one memorable physical metaphor derived from the article. Keep all irreplaceable subjects and the complete conceptual action near the horizontal center. Leave generous expendable white space around the scene for later platform crops. The image must still read clearly when reduced to a small feed thumbnail.

Do not render the full article title. No large headline, no watermark, no decorative logo wall. When supplied local product icons are semantically essential, render one faithful icon at the corresponding object instead of writing the product name. Use at most 0-4 other very short labels only when essential.

Recurring IP character required:
Use the attached qing-shiwu avatar as the mandatory identity reference. Preserve the pure-white rounded head-and-upper-torso, uneven black outline, asymmetric dot eyes, short slanted eyebrows, and thin arms. Show upper body only. Never add a waist, legs, feet, or a full standing body. The fruit in the avatar is not a fixed accessory.
```

生成后保存原图为 `cover-master.png`，先检查角色与隐喻，再做尺寸适配。

## 5. 裁切公众号头条、次条与知乎

使用 `scripts/adapt_covers.py` 做覆盖式裁切和高质量缩放。禁止直接把宽高分别缩放到目标尺寸。

```bash
python qing-shiwu-illustrations/scripts/adapt_covers.py \
  --master /path/to/cover-master.png \
  --output-dir /path/to/article-dir/article-stem/covers
```

脚本默认以画面中心为焦点。主体偏移时传入 `--focal-x` 和 `--focal-y`，数值范围是 0-1。先检查自动生成的 `500×500` 次条图；横版母版裁成方形后角色、主物件、图标或动作不完整时，按第 6 节生成方形源图，再用 `--square-source` 重跑。脚本只接受内置生图默认产出的非交错 8-bit PNG，使用 Python 标准库运行，不依赖 Pillow 或 ImageMagick。

## 6. 处理公众号次条方形版本

公众号次条不是把头条图机械裁成正方形。自动裁切只有在以下条件全部成立时才能直接使用：

- 青十五的上半身、眼眉、双臂和核心动作完整。
- 主物件和必要产品图标在 `200×200` 预览下仍能辨认。
- 方形画面没有大块无效留白，也没有只剩局部物件。

任一失败时，使用母版作为概念参考，调用 `image_gen` 做同概念方形重排：

```text
Input images:
Image 1: visual-concept reference from the approved cover master
Image 2: mandatory Qing Shiwu character identity reference
Image 3..N: verified local product-icon references when the concept uses them

Recompose the same cover concept for a square WeChat secondary-story thumbnail. Preserve the same metaphor, Qing Shiwu action, main object, verified product icons, line style, and color semantics. Enlarge the character, core action, and essential icons so they remain recognizable at 200x200. Keep all essential elements inside the square safe area. Do not merely crop the wide composition. No full article title, no legs, no watermark.
```

把重排原图保存为 `cover-wechat-secondary-source.png`，再传给裁切脚本：

```bash
python qing-shiwu-illustrations/scripts/adapt_covers.py \
  --master /path/to/cover-master.png \
  --square-source /path/to/cover-wechat-secondary-source.png \
  --output-dir /path/to/article-dir/article-stem/covers
```

## 7. 处理 X Articles 超宽版本

X 版本只保留母版中间约三分之一高度。先查看自动裁切结果：

- 青十五的完整上半身、眼眉和双臂是否可见。
- 核心动作是否完整。
- 主物件是否仍能在 1 秒内读懂。
- 是否变成一条空白过多、主体过小的窄条。

全部通过即可使用自动裁切。任一失败时，不要移动焦点硬救，也不要拉伸；用母版作为视觉参考，调用 `image_gen` 做同概念超宽重排：

```text
Input images:
Image 1: visual-concept reference from the approved cover master
Image 2: mandatory Qing Shiwu character identity reference
Image 3..N: verified local product-icon references when the concept uses them

Recompose the same cover concept for an ultra-wide X Articles header. Preserve the same metaphor, Qing Shiwu action, main object, line style, and color semantics. Arrange every essential element inside one shallow panoramic band across the horizontal center, with expendable blank white space above and below so a 5.22:1 center crop remains complete. Do not stretch, squash, redesign, or add new story elements. No full article title, no legs, no watermark.
```

把重排原图保存为 `cover-x-source.png`，再传给裁切脚本：

```bash
python qing-shiwu-illustrations/scripts/adapt_covers.py \
  --master /path/to/cover-master.png \
  --x-source /path/to/cover-x-source.png \
  --square-source /path/to/cover-wechat-secondary-source.png \
  --output-dir /path/to/article-dir/article-stem/covers
```

## 8. 标题、文字与产品标识

- 默认不在封面内重复完整文章标题。
- 用户明确要求带标题时，先确定逐字文本和安全区，再用确定性本地排版叠加；不要让生图模型猜长中文标题。
- 没有可靠中文字体或排版工具时，交付无标题版本并说明，不要输出错字版本。
- 手写批注仍遵循少、短、准确；错字无法可靠修复时删除批注。
- 产品有可靠本地图标时，使用图标而不是产品名文字。交付前核对产品级/厂商级选择、图形轮廓和颜色；不要用相近标志凑数。

## 9. QA

四张成品逐一检查：

- 像素尺寸与文件名完全正确。
- 没有拉伸、压扁、黑边、透明缝或意外模糊。
- 青十五身份稳定且只出现上半身。
- 青十五通过双臂、视线和姿态承担核心动作。
- 核心隐喻一致，四张图属于同一视觉系列。
- 缩略图尺寸下仍能识别角色、主物件和点击理由。
- 公众号次条在 `200×200` 预览下仍能认出角色、主物件和必要产品图标。
- 具体产品使用了核对过的本地产品图标，没有用产品名文字或错误标志替代。
- 无大标题、错字、水印、商业海报感、PPT 感或复杂背景。

不合格时先调整裁切焦点；核心动作仍不完整时，重排对应平台源图。

## 10. 保存与文章修改

已有 Markdown 文章时，默认保存到文章文件同目录的同名资产目录：

```text
<article-dir>/<article-stem>/covers/
├── cover-master.png
├── cover-x-source.png                 # 仅需要超宽重排时
├── cover-wechat-secondary-source.png  # 仅需要方形重排时
├── cover-wechat-primary-900x383.png
├── cover-wechat-secondary-500x500.png
├── cover-x-article-1920x368.png
└── cover-zhihu-1380x560.png
```

例如 `/notes/my-post.md` 对应 `/notes/my-post/covers/`。只有粘贴正文而没有文章文件时，才采用用户指定目录；没有指定时先生成预览并请用户决定项目内保存位置，不要擅自写到无关目录。

默认不修改文章。只有用户明确要求时，才插入 Markdown 图片、更新 frontmatter 或删除封面标记。不要覆盖已有资产；冲突时创建语义清晰的版本化目录或文件名。
