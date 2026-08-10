import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function hrefFor(value) {
  return String(value).split("/").map((part) => encodeURIComponent(part)).join("/");
}

function mtime(pathValue) {
  try { return statSync(pathValue).mtimeMs; } catch { return 0; }
}

function directories(pathValue) {
  if (!existsSync(pathValue)) return [];
  return readdirSync(pathValue, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(pathValue, entry.name));
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function collectGzh(previewRoot) {
  const entries = [];
  for (const articleDir of directories(previewRoot)) {
    if (["xhs"].includes(basename(articleDir)) || basename(articleDir).startsWith(".")) continue;
    const htmlFiles = readdirSync(articleDir).filter((name) => name.endsWith(".html") && name !== "index.html").map((name) => join(articleDir, name));
    const primary = htmlFiles.filter((file) => file.endsWith("_预览.html")).sort((a, b) => mtime(b) - mtime(a))[0]
      || htmlFiles.sort((a, b) => mtime(b) - mtime(a))[0];
    if (!primary) continue;
    entries.push({
      article: basename(articleDir),
      meta: "公众号 · 排版预览",
      description: basename(primary),
      modified: mtime(primary),
      href: hrefFor(relative(previewRoot, primary).replaceAll("\\", "/")),
      label: "打开公众号预览",
      secondary: "",
    });
  }
  return entries;
}

function collectXhs(previewRoot) {
  const entries = [];
  const root = join(previewRoot, "xhs");
  for (const articleDir of directories(root)) {
    for (const variantDir of directories(articleDir)) {
      const manifestPath = join(variantDir, "manifest.json");
      const galleryPath = join(variantDir, "index.html");
      if (!existsSync(manifestPath) || !existsSync(galleryPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const captionPath = join(variantDir, "caption.txt");
        entries.push({
          articleId: manifest.articleId || basename(articleDir),
          inputType: manifest.inputType || manifest.variant || basename(variantDir),
          article: manifest.title || basename(articleDir),
          meta: `小红书 · ${manifest.sourceLabel || "多图预览"}`,
          description: `${manifest.size || "1080x1440"} · 共 ${manifest.pages || 0} 张`,
          modified: mtime(manifestPath),
          href: hrefFor(relative(previewRoot, galleryPath).replaceAll("\\", "/")),
          label: "打开多图预览",
          secondary: existsSync(captionPath) ? hrefFor(relative(previewRoot, captionPath).replaceAll("\\", "/")) : "",
        });
      } catch { /* ignore incomplete entries */ }
    }
  }
  const sorted = entries.sort((a, b) => b.modified - a.modified);
  if (!sorted.length) return [];
  const latestArticle = sorted[0].articleId;
  const current = sorted.filter((entry) => entry.articleId === latestArticle);
  const carousel = current.find((entry) => entry.inputType === "carousel");
  if (carousel) return [carousel];
  const byType = new Map();
  for (const entry of current) if (!byType.has(entry.inputType)) byType.set(entry.inputType, entry);
  return [...byType.values()].slice(0, 2);
}

function renderCard(entry, index) {
  return `<article class="card"><div class="number">${String(index + 1).padStart(2, "0")}</div><div class="content"><div class="meta"><span>${escapeHtml(entry.meta)}</span><time>${formatTime(entry.modified)}</time></div><h2>${escapeHtml(entry.article)}</h2><p>${escapeHtml(entry.description)}</p><div class="actions"><a class="primary" href="${entry.href}">${escapeHtml(entry.label)} →</a>${entry.secondary ? `<a href="${entry.secondary}">发帖文案</a>` : ""}</div></div></article>`;
}

export function refreshPreviewIndex(previewRoot) {
  mkdirSync(previewRoot, { recursive: true });
  const entries = [...collectGzh(previewRoot), ...collectXhs(previewRoot)].sort((a, b) => b.modified - a.modified);
  const cards = entries.length ? entries.map(renderCard).join("\n") : `<div class="empty">还没有预览内容</div>`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容预览中心</title><style>
*{box-sizing:border-box}body{margin:0;color:#172033;background:#f3f6f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}.page{width:min(1040px,calc(100% - 28px));margin:auto;padding:52px 0 72px}.eyebrow{color:#3f73b9;font-size:12px;font-weight:800;letter-spacing:.14em}h1{margin:12px 0 10px;font-size:clamp(34px,5vw,54px);letter-spacing:-.04em}.intro{margin:0 0 30px;color:#708090;line-height:1.7}.list{display:grid;gap:14px}.card{display:grid;grid-template-columns:58px 1fr;overflow:hidden;border:1px solid #d9e2e8;border-radius:16px;background:#fff}.number{padding-top:24px;color:#3f73b9;background:#e9f0f7;font-family:ui-monospace,monospace;font-size:13px;font-weight:800;text-align:center}.content{min-width:0;padding:22px 24px}.meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;color:#82909e;font-size:12px}.meta span{color:#3f73b9;font-weight:800}.card h2{margin:12px 0 6px;font-size:21px}.card p{margin:0;overflow:hidden;color:#7d8995;font-family:ui-monospace,monospace;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-top:18px}.actions a{color:#526374;font-size:13px;font-weight:700;text-decoration:none}.actions .primary{padding:10px 14px;color:#fff;border-radius:9px;background:#3f73b9}.empty{padding:50px;border:1px dashed #b9c7d2;border-radius:16px;background:#fff;text-align:center}@media(max-width:640px){.page{padding-top:32px}.card{grid-template-columns:42px 1fr}.content{padding:19px 15px}.actions{align-items:flex-start;flex-direction:column}}
</style></head><body><main class="page"><div class="eyebrow">CONTENT PREVIEW</div><h1>内容预览中心</h1><p class="intro">统一查看公众号排版和当前文章最新的小红书图文方案。</p><section class="list">${cards}</section></main></body></html>`;
  const destination = join(previewRoot, "index.html");
  const temporary = join(previewRoot, ".index.html.tmp");
  writeFileSync(temporary, html, "utf8");
  renameSync(temporary, destination);
  return { destination, entries: entries.length };
}
