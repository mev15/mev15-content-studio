#!/usr/bin/env python3
"""把已校验的公众号正文片段（纯 <section>）包成带「复制」按钮的浏览器预览页。

用户打开预览页 → 点右上角「复制到公众号」→ 按钮选中并复制里面渲染后的富文本
（等价手动 Ctrl+A/Ctrl+C，样式全保留）→ 到公众号编辑器 Ctrl+V 粘贴即可。

按钮和 JS 只存在于预览外壳里，**不在被复制的 section 内**，所以粘进公众号的
仍是干净合规的正文，不含 <script>/<button>。校验请对原始 section 文件跑
validate_gzh_html.py（本预览页含 script/style，不参与校验）。

用法:
    wrap_preview.py <section.html> [output.html]
    默认输出到同一文章目录：
    - 源文件已在 output/preview/ 下：写到源文件所在目录
    - 其它位置：写到 output/preview/<文章标识>/
"""

import os
import sys

from update_preview_index import build_index


def find_workspace_root(src):
    """从源文件向上寻找当前项目根目录，找不到时回退到当前工作目录。"""
    starts = [os.path.dirname(os.path.abspath(src)), os.getcwd()]
    checked = set()
    for start in starts:
        current = os.path.abspath(start)
        while current not in checked:
            checked.add(current)
            if (os.path.exists(os.path.join(current, ".git")) or
                    os.path.isfile(os.path.join(current, "AGENTS.md"))):
                return current
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
    return os.path.abspath(os.getcwd())


def is_within(path, parent):
    """判断 path 是否位于 parent 内，兼容不同挂载点。"""
    try:
        return os.path.commonpath([os.path.abspath(path), os.path.abspath(parent)]) == os.path.abspath(parent)
    except ValueError:
        return False


def default_output_path(src, title):
    """为预览选择 output/preview 下的文章目录。"""
    workspace_root = find_workspace_root(src)
    preview_root = os.path.join(workspace_root, "output", "preview")
    src_dir = os.path.dirname(os.path.abspath(src))
    if is_within(src_dir, preview_root):
        out_dir = src_dir
    else:
        article_id = title.split("_排版_", 1)[0] or title
        out_dir = os.path.join(preview_root, article_id)
    return os.path.join(out_dir, title + "_预览.html")


def main():
    if len(sys.argv) < 2:
        print("用法: wrap_preview.py <section.html> [output.html]")
        sys.exit(1)
    src = sys.argv[1]
    if not os.path.isfile(src):
        print(f"✗ 找不到文件: {src}")
        sys.exit(1)

    content = open(src, encoding="utf-8").read().strip()
    tpl_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "assets", "preview-template.html")
    tpl = open(tpl_path, encoding="utf-8").read()

    title = os.path.splitext(os.path.basename(src))[0]
    out_html = tpl.replace("{{TITLE}}", title).replace("<!--GZH_CONTENT-->", content)

    if len(sys.argv) > 2:
        out = sys.argv[2]
    else:
        out = default_output_path(src, title)
    out_dir = os.path.dirname(os.path.abspath(out))
    os.makedirs(out_dir, exist_ok=True)
    open(out, "w", encoding="utf-8").write(out_html)
    index_path, article_count = build_index(find_workspace_root(src))
    print(f"✓ 已生成带「复制」按钮的预览页: {out}")
    print(f"✓ 已更新统一入口: {index_path}（{article_count} 篇）")
    print("  用浏览器打开它，点右上角「复制到公众号」，再去公众号编辑器 Ctrl/⌘+V 粘贴。")


if __name__ == "__main__":
    main()
