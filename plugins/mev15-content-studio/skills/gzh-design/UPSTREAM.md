# Upstream and modifications

Upstream project: <https://github.com/isjiamu/gzh-design-skill>

Original copyright:

> gzh-design-skill — 微信公众号排版技能
> Copyright (C) 2026 甲木 (Jiamu) × 摸鱼小李 (Moyu Xiaoli)

This copy remains licensed under GNU AGPL-3.0-or-later.

Modifications in this distribution, dated 2026-08-06:

- Added the AI 科技蓝 theme using palette 03 清晰数字蓝.
- Added the independent AI 清透湖蓝 theme using palette 05 清透湖蓝.
- Changed generated article output to `output/preview/<article-id>/`.
- Added an automatically maintained `output/preview/index.html` entry page.
- Kept theme-development previews separate from daily article outputs.

Additional modifications dated 2026-08-07:

- Kept image captions equal to their Markdown alt text without decorative prefixes.
- Kept colon-led list introductions and their immediately following lists in one visual container.
- Separated subsection-title styling from inline highlight styling, including a blue left-bar subtitle for AI 科技蓝.
- Standardized ordinary body, list, and quote text at 16px while inheriting WeChat's default font and body color; monospace declarations remain limited to code.
