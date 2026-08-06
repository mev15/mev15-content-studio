#!/usr/bin/env python3
"""扫描 output/preview 下的公众号文章目录并重建统一入口 index.html。"""

import argparse
import html
import os
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


def find_workspace_root(start=None):
    """从指定位置向上寻找项目根目录，找不到时使用当前工作目录。"""
    current = Path(start or os.getcwd()).resolve()
    if current.is_file():
        current = current.parent
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists() or (candidate / "AGENTS.md").is_file():
            return candidate
    return Path(os.getcwd()).resolve()


def href_for(path, preview_root):
    relative = path.relative_to(preview_root).as_posix()
    return quote(relative, safe="/()_-.~")


def theme_from_filename(filename):
    stem = Path(filename).stem
    stem = re.sub(r"_预览$", "", stem)
    if "_排版_" in stem:
        return stem.split("_排版_", 1)[1]
    return "公众号排版"


def collect_articles(preview_root):
    """只收集文章子目录；以下划线或点开头的内部目录会被忽略。"""
    articles = []
    for article_dir in preview_root.iterdir():
        if not article_dir.is_dir() or article_dir.name.startswith(("_", ".")):
            continue

        preview_files = sorted(
            article_dir.glob("*_预览.html"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        html_files = sorted(
            (path for path in article_dir.glob("*.html") if path.name != "index.html"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        primary = preview_files[0] if preview_files else (html_files[0] if html_files else None)
        if primary is None:
            continue

        clean_files = [path for path in html_files if path != primary and not path.name.endswith("_预览.html")]
        markdown_files = sorted(
            (path for path in article_dir.glob("*.md") if path.name.lower() != "readme.md"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        related = [primary, *clean_files, *markdown_files]
        modified = max(path.stat().st_mtime for path in related)
        articles.append({
            "name": article_dir.name,
            "primary": primary,
            "clean": clean_files[0] if clean_files else None,
            "markdown": markdown_files[0] if markdown_files else None,
            "theme": theme_from_filename(primary.name),
            "modified": modified,
        })

    return sorted(articles, key=lambda item: (-item["modified"], item["name"]))


def render_card(article, index, preview_root):
    name = html.escape(article["name"])
    theme = html.escape(article["theme"])
    primary_href = href_for(article["primary"], preview_root)
    modified = datetime.fromtimestamp(article["modified"]).strftime("%Y-%m-%d %H:%M")

    extra_links = []
    if article["clean"]:
        extra_links.append(
            f'<a class="secondary-link" href="{href_for(article["clean"], preview_root)}">干净 HTML</a>'
        )
    if article["markdown"]:
        extra_links.append(
            f'<a class="secondary-link" href="{href_for(article["markdown"], preview_root)}">Markdown</a>'
        )
    extras = "".join(extra_links)

    return f"""
      <article class="article-card">
        <div class="card-number">{index:02d}</div>
        <div class="card-content">
          <div class="card-meta"><span>{theme}</span><time>{modified}</time></div>
          <h2>{name}</h2>
          <p>{html.escape(article['primary'].name)}</p>
          <div class="card-actions">
            <a class="primary-link" href="{primary_href}">打开排版预览 <span aria-hidden="true">→</span></a>
            {extras}
          </div>
        </div>
      </article>"""


def render_index(articles, preview_root):
    cards = "\n".join(
        render_card(article, index, preview_root)
        for index, article in enumerate(articles, start=1)
    )
    if not cards:
        cards = """
      <section class="empty-state">
        <div class="empty-icon">AI</div>
        <h2>还没有排版文章</h2>
        <p>使用 gzh-design 生成第一篇文章后，这里会自动出现访问入口。</p>
      </section>"""

    latest = (
        datetime.fromtimestamp(max(article["modified"] for article in articles)).strftime("%Y-%m-%d %H:%M")
        if articles else "等待首篇文章"
    )
    count = len(articles)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公众号排版预览</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; color: #172033; background: #f5f8fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }}
    a {{ color: inherit; }}
    .page {{ width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 72px; }}
    .eyebrow {{ display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: #2563a9; font-size: 12px; font-weight: 700; letter-spacing: .16em; }}
    .eyebrow::before {{ content: ""; width: 24px; height: 3px; border-radius: 99px; background: #55a6d9; }}
    h1 {{ margin: 0; font-size: clamp(32px, 5vw, 52px); line-height: 1.12; letter-spacing: -.04em; }}
    .intro {{ max-width: 650px; margin: 18px 0 0; color: #627086; font-size: 16px; line-height: 1.8; }}
    .summary {{ display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 34px 0 24px; padding: 16px 20px; border: 1px solid #dce7f1; border-radius: 14px; background: #fff; color: #627086; font-size: 13px; }}
    .summary strong {{ color: #1f5f9f; font-size: 15px; }}
    .article-list {{ display: grid; gap: 14px; }}
    .article-card {{ display: grid; grid-template-columns: 58px minmax(0, 1fr); border: 1px solid #dce7f1; border-radius: 18px; background: #fff; overflow: hidden; transition: border-color .18s ease, transform .18s ease; }}
    .article-card:hover {{ border-color: #8fbddb; transform: translateY(-2px); }}
    .card-number {{ display: flex; align-items: flex-start; justify-content: center; padding-top: 24px; color: #397eb7; background: #edf6fb; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; }}
    .card-content {{ min-width: 0; padding: 23px 24px 24px; }}
    .card-meta {{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; color: #708197; font-size: 12px; }}
    .card-meta span {{ color: #24699f; font-weight: 700; }}
    .article-card h2 {{ margin: 12px 0 6px; font-size: 21px; line-height: 1.4; }}
    .article-card p {{ margin: 0; overflow: hidden; color: #8190a3; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }}
    .card-actions {{ display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin-top: 20px; }}
    .primary-link {{ display: inline-flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: #fff; background: #276fa8; font-size: 14px; font-weight: 700; text-decoration: none; }}
    .primary-link:hover {{ background: #1f5f90; }}
    .secondary-link {{ color: #53657a; font-size: 13px; font-weight: 600; text-decoration: none; }}
    .secondary-link:hover {{ color: #1f6fa8; text-decoration: underline; text-underline-offset: 4px; }}
    .empty-state {{ padding: 68px 24px; border: 1px dashed #b9cfe1; border-radius: 18px; background: #fff; text-align: center; }}
    .empty-icon {{ display: grid; width: 54px; height: 54px; margin: 0 auto 18px; place-items: center; border-radius: 14px; color: #25699f; background: #e8f3fa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; }}
    .empty-state h2 {{ margin: 0 0 8px; font-size: 20px; }}
    .empty-state p {{ margin: 0; color: #738297; font-size: 14px; }}
    footer {{ margin-top: 28px; color: #8a97a8; font-size: 12px; text-align: center; }}
    @media (max-width: 640px) {{
      .page {{ width: min(100% - 20px, 1040px); padding-top: 34px; }}
      .article-card {{ grid-template-columns: 42px minmax(0, 1fr); }}
      .card-number {{ padding-top: 22px; }}
      .card-content {{ padding: 20px 16px; }}
      .card-actions {{ align-items: flex-start; flex-direction: column; }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <div class="eyebrow">GZH PREVIEW</div>
    <h1>公众号排版预览</h1>
    <p class="intro">这里汇总 gzh-design 生成的文章。打开预览即可检查排版，并复制富文本到微信公众号编辑器。</p>
    <section class="summary" aria-label="索引摘要">
      <span>文章数量：<strong>{count}</strong></span>
      <span>最近更新：<strong>{latest}</strong></span>
    </section>
    <section class="article-list" aria-label="文章列表">
{cards}
    </section>
    <footer>索引由 gzh-design 自动维护 · 主题开发目录不会显示在此页</footer>
  </main>
</body>
</html>
"""


def build_index(workspace_root):
    workspace_root = Path(workspace_root).resolve()
    preview_root = workspace_root / "output" / "preview"
    preview_root.mkdir(parents=True, exist_ok=True)
    articles = collect_articles(preview_root)
    output = preview_root / "index.html"
    temporary = preview_root / ".index.html.tmp"
    temporary.write_text(render_index(articles, preview_root), encoding="utf-8")
    os.replace(temporary, output)
    return output, len(articles)


def main():
    parser = argparse.ArgumentParser(description="重建 output/preview/index.html 文章索引")
    parser.add_argument("workspace_root", nargs="?", help="项目根目录；默认从当前目录向上查找")
    args = parser.parse_args()
    root = Path(args.workspace_root).resolve() if args.workspace_root else find_workspace_root()
    output, count = build_index(root)
    print(f"✓ 已更新公众号排版索引: {output}（{count} 篇）")


if __name__ == "__main__":
    main()
