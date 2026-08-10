#!/usr/bin/env node
/**
 * xhs-tweet-cards 渲染器
 * 输入 Markdown / HTML，输出带推文壳的小红书 3:4 多图（2160×2880 PNG）。
 * 可选把画廊写入 output/preview/<文章>/<版本>/ 并刷新统一预览入口。
 */
import { chromium } from "playwright";
import { marked } from "marked";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

const SKILL_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");
// 固定逻辑排版坐标；导出倍率只负责清晰度，不参与文章间的字号调节。
// 正文 34 / 864 = 3.94%，与 write-then-publish 的默认视觉比例一致。
const CARD_W = 864;
const CARD_H = 1152;
const SCALE = 2.5;
const DEFAULT_HTML_FONT_SCALE = 2.125;
const TARGET_MAX_PAGES = 15;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-verified") args.verified = false;
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i];
    else args._.push(arg);
  }
  return args;
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hrefFor(pathValue) {
  return String(pathValue).split("/").map((part) => encodeURIComponent(part)).join("/");
}

function safeSegment(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");
  return cleaned || fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function normalizeHandle(value) {
  const handle = String(value || "").trim();
  if (!handle) return "@handle";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function toDataUrl(filePath) {
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  }[extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`不支持的图片格式: ${filePath}`);
  const buffer = readFileSync(filePath);
  if (buffer.length > 15 * 1024 * 1024) throw new Error(`图片超过 15MB: ${filePath}`);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function inlineLocalImages(html, baseDir) {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (match, before, src, after) => {
    if (/^(https?:|data:)/i.test(src)) return match;
    const imagePath = resolve(baseDir, decodeURIComponent(src));
    if (!existsSync(imagePath)) {
      console.warn(`[warn] 图片不存在，保留原引用: ${src}`);
      return match;
    }
    return before + toDataUrl(imagePath) + after;
  });
}

const highlightExtension = {
  name: "highlight",
  level: "inline",
  start(src) {
    const index = src.indexOf("==");
    return index >= 0 ? index : undefined;
  },
  tokenizer(src) {
    const match = /^==([^=\n]+)==/.exec(src);
    if (!match) return undefined;
    return {
      type: "highlight",
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    };
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
  },
  childTokens: ["tokens"],
};

/** 公众号 HTML 常用 16px 正文；归一到 864px 逻辑画布上的 34px 阅读基准。 */
function scaleHtmlFontSizes(html, factor) {
  if (factor === 1) return html;
  return html.replace(/(font-size\s*:\s*)(\d+(?:\.\d+)?)px/gi, (match, prefix, rawSize) => {
    const scaled = Math.round(Number(rawSize) * factor * 100) / 100;
    return `${prefix}${scaled}px`;
  });
}

function mtime(pathValue) {
  try {
    return statSync(pathValue).mtimeMs;
  } catch {
    return 0;
  }
}

function listDirectories(pathValue) {
  if (!existsSync(pathValue)) return [];
  return readdirSync(pathValue, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(pathValue, entry.name));
}

function formatTime(timestamp) {
  if (!timestamp) return "等待首篇文章";
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function themeFromFilename(filename) {
  const stem = filename.replace(/\.html?$/i, "").replace(/_预览$/, "");
  return stem.includes("_排版_") ? stem.split("_排版_", 2)[1] : "公众号排版";
}

function collectGzhEntries(previewRoot) {
  const entries = [];
  for (const articleDir of listDirectories(previewRoot)) {
    const articleName = basename(articleDir);
    if (articleName.startsWith("_") || articleName.startsWith(".")) continue;
    const files = readdirSync(articleDir)
      .filter((name) => name.endsWith(".html") && name !== "index.html")
      .map((name) => join(articleDir, name));
    const previews = files.filter((file) => file.endsWith("_预览.html")).sort((a, b) => mtime(b) - mtime(a));
    const htmlFiles = files.sort((a, b) => mtime(b) - mtime(a));
    const primary = previews[0] || htmlFiles[0];
    if (!primary) continue;
    const clean = htmlFiles.find((file) => file !== primary && !file.endsWith("_预览.html"));
    const modified = Math.max(...files.map(mtime), 0);
    entries.push({
      kind: "gzh",
      article: articleName,
      meta: `公众号 · ${themeFromFilename(basename(primary))}`,
      modified,
      description: basename(primary),
      primaryHref: hrefFor(relative(previewRoot, primary).replaceAll("\\", "/")),
      primaryLabel: "打开排版预览",
      secondaryHref: clean ? hrefFor(relative(previewRoot, clean).replaceAll("\\", "/")) : "",
      secondaryLabel: clean ? "干净 HTML" : "",
    });
  }
  return entries.sort((a, b) => b.modified - a.modified || a.article.localeCompare(b.article));
}

function collectXhsEntries(previewRoot) {
  const entries = [];
  for (const articleDir of listDirectories(previewRoot)) {
    const articleName = basename(articleDir);
    if (articleName.startsWith("_") || articleName.startsWith(".")) continue;
    for (const variantDir of listDirectories(articleDir)) {
      const manifestPath = join(variantDir, "manifest.json");
      const galleryPath = join(variantDir, "index.html");
      if (!existsSync(manifestPath) || !existsSync(galleryPath)) continue;
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch {
        continue;
      }
      const variant = manifest.variant || basename(variantDir);
      const sourceLabel = manifest.sourceLabel || (variant === "html" ? "公众号 HTML" : "原始 Markdown");
      // “最新”按本次渲染生成的 manifest 判断；后来补写旧 caption 不应把旧方案顶回入口。
      const modified = mtime(manifestPath);
      const captionPath = join(variantDir, "caption.txt");
      entries.push({
        kind: "xhs",
        articleId: manifest.articleId || basename(articleDir),
        inputType: manifest.inputType || (variant === "html" ? "html" : "markdown"),
        article: manifest.title || basename(articleDir),
        meta: `小红书 · ${sourceLabel}`,
        modified,
        description: `${manifest.size || "2160x2880"} · 共 ${manifest.pages || 0} 张`,
        primaryHref: hrefFor(relative(previewRoot, galleryPath).replaceAll("\\", "/")),
        primaryLabel: "打开多图预览",
        secondaryHref: existsSync(captionPath) ? hrefFor(relative(previewRoot, captionPath).replaceAll("\\", "/")) : "",
        secondaryLabel: existsSync(captionPath) ? "发帖文案" : "",
      });
    }
  }
  // 统一入口只保留最近处理文章的最新来源版本：Markdown 与 HTML 各最多一套。
  // 这样同一次对照预览不会互相顶掉，旧测试变体也不会继续堆在入口里。
  const sorted = entries.sort((a, b) => b.modified - a.modified || a.article.localeCompare(b.article));
  if (!sorted.length) return sorted;
  const latestArticleId = sorted[0].articleId;
  const latestByInputType = new Map();
  for (const entry of sorted) {
    if (entry.articleId !== latestArticleId || latestByInputType.has(entry.inputType)) continue;
    latestByInputType.set(entry.inputType, entry);
  }
  const inputOrder = { markdown: 0, html: 1 };
  return [...latestByInputType.values()].sort((a, b) =>
    (inputOrder[a.inputType] ?? 9) - (inputOrder[b.inputType] ?? 9));
}

function previewCard(entry, index) {
  const secondary = entry.secondaryHref
    ? `<a class="secondary-link" href="${entry.secondaryHref}">${htmlEscape(entry.secondaryLabel)}</a>`
    : "";
  return `
      <article class="article-card">
        <div class="card-number">${String(index).padStart(2, "0")}</div>
        <div class="card-content">
          <div class="card-meta"><span>${htmlEscape(entry.meta)}</span><time>${formatTime(entry.modified)}</time></div>
          <h2>${htmlEscape(entry.article)}</h2>
          <p>${htmlEscape(entry.description)}</p>
          <div class="card-actions">
            <a class="primary-link" href="${entry.primaryHref}">${htmlEscape(entry.primaryLabel)} <span aria-hidden="true">→</span></a>
            ${secondary}
          </div>
        </div>
      </article>`;
}

function writeUnifiedPreviewIndex(previewRoot) {
  mkdirSync(previewRoot, { recursive: true });
  const entries = [...collectGzhEntries(previewRoot), ...collectXhsEntries(previewRoot)];
  const cards = entries.length
    ? entries.map(previewCard).join("\n")
    : `<section class="empty-state"><div class="empty-icon">AI</div><h2>还没有预览内容</h2><p>生成第一篇公众号排版或小红书多图后，这里会自动出现入口。</p></section>`;
  const articleCount = new Set(entries.map((entry) => entry.article)).size;
  const latest = entries.length ? Math.max(...entries.map((entry) => entry.modified)) : 0;
  const output = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>内容预览中心</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; background: #f5f8fc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
    a { color: inherit; }
    .page { width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 72px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; color: #2563a9; font-size: 12px; font-weight: 700; letter-spacing: .16em; }
    .eyebrow::before { content: ""; width: 24px; height: 3px; border-radius: 99px; background: #55a6d9; }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 52px); line-height: 1.12; letter-spacing: -.04em; }
    .intro { max-width: 700px; margin: 18px 0 0; color: #627086; font-size: 16px; line-height: 1.8; }
    .summary { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 34px 0 24px; padding: 16px 20px; border: 1px solid #dce7f1; border-radius: 14px; background: #fff; color: #627086; font-size: 13px; }
    .summary strong { color: #1f5f9f; font-size: 15px; }
    .article-list { display: grid; gap: 14px; }
    .article-card { display: grid; grid-template-columns: 58px minmax(0, 1fr); border: 1px solid #dce7f1; border-radius: 18px; background: #fff; overflow: hidden; transition: border-color .18s ease, transform .18s ease; }
    .article-card:hover { border-color: #8fbddb; transform: translateY(-2px); }
    .card-number { display: flex; align-items: flex-start; justify-content: center; padding-top: 24px; color: #397eb7; background: #edf6fb; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 700; }
    .card-content { min-width: 0; padding: 23px 24px 24px; }
    .card-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; color: #708197; font-size: 12px; }
    .card-meta span { color: #24699f; font-weight: 700; }
    .article-card h2 { margin: 12px 0 6px; font-size: 21px; line-height: 1.4; }
    .article-card p { margin: 0; overflow: hidden; color: #8190a3; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin-top: 20px; }
    .primary-link { display: inline-flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: #fff; background: #276fa8; font-size: 14px; font-weight: 700; text-decoration: none; }
    .primary-link:hover { background: #1f5f90; }
    .secondary-link { color: #53657a; font-size: 13px; font-weight: 600; text-decoration: none; }
    .secondary-link:hover { color: #1f6fa8; text-decoration: underline; text-underline-offset: 4px; }
    .empty-state { padding: 68px 24px; border: 1px dashed #b9cfe1; border-radius: 18px; background: #fff; text-align: center; }
    .empty-icon { display: grid; width: 54px; height: 54px; margin: 0 auto 18px; place-items: center; border-radius: 14px; color: #25699f; background: #e8f3fa; font-weight: 800; }
    .empty-state h2 { margin: 0 0 8px; font-size: 20px; }
    .empty-state p { margin: 0; color: #738297; font-size: 14px; }
    footer { margin-top: 28px; color: #8a97a8; font-size: 12px; text-align: center; }
    @media (max-width: 640px) { .page { width: min(100% - 20px, 1040px); padding-top: 34px; } .article-card { grid-template-columns: 42px minmax(0, 1fr); } .card-number { padding-top: 22px; } .card-content { padding: 20px 16px; } .card-actions { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <main class="page">
    <div class="eyebrow">CONTENT PREVIEW</div>
    <h1>内容预览中心</h1>
    <p class="intro">统一查看公众号排版与小红书多图效果。公众号预览用于检查富文本排版；小红书区域保留当前文章最新的 Markdown 与 HTML 版本各一套。</p>
    <section class="summary" aria-label="索引摘要">
      <span>文章数量：<strong>${articleCount}</strong></span>
      <span>预览页面：<strong>${entries.length}</strong></span>
      <span>最近更新：<strong>${formatTime(latest)}</strong></span>
    </section>
    <section class="article-list" aria-label="预览列表">
${cards}
    </section>
    <footer>公众号预览与当前文章最新的小红书多图 · 点击卡片进入对应预览</footer>
  </main>
</body>
</html>
`;
  const destination = join(previewRoot, "index.html");
  const temporary = join(previewRoot, ".index.html.tmp");
  writeFileSync(temporary, output, "utf-8");
  renameSync(temporary, destination);
  return { destination, entries: entries.length, articles: articleCount };
}

function writeGallery(outDir, options) {
  const template = readFileSync(join(SKILL_DIR, "assets", "gallery.html"), "utf-8");
  const total = options.files.length;
  const galleryItems = options.files.map((file, index) => {
    const number = String(index + 1).padStart(2, "0");
    const loading = index === 0 ? "eager" : "lazy";
    return `      <figure><a href="${file}"><img src="${file}" alt="${htmlEscape(options.sourceLabel)}第 ${index + 1} 张" loading="${loading}"></a><figcaption>${number} / ${String(total).padStart(2, "0")}</figcaption></figure>`;
  }).join("\n");
  const backLink = options.previewRoot
    ? `<a class="back" href="${hrefFor(relative(outDir, join(options.previewRoot, "index.html")).replaceAll("\\", "/"))}">← 返回统一预览入口</a>`
    : `<span class="back">小红书多图预览</span>`;
  const replacements = {
    "{{PAGE_TITLE}}": htmlEscape(`${options.title} · ${options.sourceLabel}小红书多图预览`),
    "{{BACK_LINK}}": backLink,
    "{{BADGE}}": htmlEscape(`${options.sourceLabel.toUpperCase()} · ${total} 张`),
    "{{ARTICLE_TITLE}}": htmlEscape(options.title),
    "{{DESCRIPTION}}": htmlEscape(options.description),
    "{{GALLERY_ITEMS}}": galleryItems,
  };
  let output = template;
  for (const [needle, value] of Object.entries(replacements)) output = output.replaceAll(needle, value);
  writeFileSync(join(outDir, "index.html"), output, "utf-8");
}

const args = parseArgs(process.argv.slice(2));
const inputPath = args._[0];
if (!inputPath) {
  console.error("用法: node render.mjs <input.md|input.html> [--out DIR | --preview-root DIR --article-id ID --variant NAME] [--env-file FILE] [--html-font-scale 2.125] [--name ..] [--handle ..] [--avatar ..] [--no-verified]");
  process.exit(2);
}

const input = resolve(inputPath);
const isHtml = /\.html?$/i.test(input);
const configPath = args.config ? resolve(args.config) : join(SKILL_DIR, "config.json");
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
const envFilePath = args["env-file"] ? resolve(args["env-file"]) : join(SKILL_DIR, ".env");
const fileEnv = readEnvFile(envFilePath);
const envValue = (name) => process.env[name] ?? fileEnv[name];
const previewRoot = args["preview-root"] ? resolve(args["preview-root"]) : null;
const inferredArticleId = basename(input, extname(input)).replace(/_排版_.+$/, "");
const articleId = safeSegment(args["article-id"] || inferredArticleId, "untitled");
const variant = safeSegment(args.variant || (isHtml ? "html" : "markdown"), isHtml ? "html" : "markdown");
const outDir = resolve(args.out || (previewRoot
  ? join(previewRoot, articleId, variant)
  : join(dirname(input), "xhs-cards")));
const title = args.title || articleId;
const sourceLabel = args["source-label"] || (isHtml ? "公众号 HTML" : "原始 Markdown");
const htmlFontScale = positiveNumber(
  args["html-font-scale"] ?? envValue("XHS_TWEET_CARDS_HTML_FONT_SCALE") ?? config.htmlFontScale,
  DEFAULT_HTML_FONT_SCALE,
);

const profile = {
  displayName: args.name || envValue("XHS_TWEET_CARDS_DISPLAY_NAME") || config.displayName || "未命名作者",
  handle: normalizeHandle(args.handle || envValue("XHS_TWEET_CARDS_HANDLE") || config.handle),
  verified: args.verified !== undefined
    ? args.verified
    : parseBoolean(envValue("XHS_TWEET_CARDS_VERIFIED"), config.verified !== false),
  avatar: args.avatar || envValue("XHS_TWEET_CARDS_AVATAR") || config.avatar || "",
  footerNote: args["footer-note"] ?? envValue("XHS_TWEET_CARDS_FOOTER_NOTE") ?? config.footerNote ?? "",
};

const raw = readFileSync(input, "utf-8");
marked.use({ extensions: [highlightExtension] });
marked.setOptions({ gfm: true, breaks: true });
let contentHtml = isHtml ? scaleHtmlFontSizes(raw, htmlFontScale) : marked.parse(raw);
contentHtml = inlineLocalImages(contentHtml, dirname(input));

let avatarDataUrl = "";
if (profile.avatar) {
  const avatarPath = resolve(profile.avatar.startsWith("~") ? profile.avatar.replace("~", process.env.HOME) : profile.avatar);
  if (existsSync(avatarPath)) avatarDataUrl = toDataUrl(avatarPath);
  else console.warn(`[warn] 头像文件不存在: ${avatarPath}，使用首字占位`);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: CARD_W + 200, height: CARD_H + 200 }, deviceScaleFactor: SCALE });

const templateHtml = readFileSync(join(SKILL_DIR, "assets", "template.html"), "utf-8");
await page.setContent(templateHtml, { waitUntil: "load" });
await page.evaluate(({ html, unwrapRoot }) => {
  const measure = document.getElementById("measure");
  measure.innerHTML = html;
  if (unwrapRoot && measure.children.length === 1) {
    const root = measure.firstElementChild;
    if (/^(SECTION|DIV|MAIN|ARTICLE)$/.test(root.tagName) && root.children.length > 1) {
      root.replaceWith(...Array.from(root.children));
    }
  }

  if (!unwrapRoot) return;

  // 公众号主题的白色卡片容器在 3:4 分页里会形成大块原子元素：既浪费页尾，
  // 又会触发整块缩放。只移除这些外壳，保留内部颜色、强调、图片和标题结构。
  const isSurfaceCard = (element) => {
    if (!/^(SECTION|DIV|ARTICLE)$/.test(element.tagName)) return false;
    const style = element.getAttribute("style") || "";
    return /box-shadow\s*:/i.test(style)
      && /background\s*:\s*#(?:fff|ffffff)\b/i.test(style)
      && !/background\s*:\s*#1e293b\b/i.test(style);
  };
  for (const element of [...measure.children]) {
    if (!isSurfaceCard(element)) continue;
    const fragment = document.createDocumentFragment();
    for (const child of [...element.children]) fragment.appendChild(child);
    element.replaceWith(fragment);
  }

  // 归一化公众号自定义数字列表：固定两列网格，让圆形序号与首行文字稳定对齐。
  for (const row of measure.querySelectorAll('section[style*="display:flex"][style*="align-items:flex-start"]')) {
    const marker = row.firstElementChild;
    const body = marker?.nextElementSibling;
    if (!marker || body?.tagName !== "P" || !/^\d+$/.test((marker.textContent || "").trim())) continue;
    row.classList.add("xhs-list-row");
    marker.classList.add("xhs-list-marker");
  }

  for (const heading of measure.querySelectorAll('section[style*="display:flex"][style*="align-items:center"]')) {
    heading.classList.add("xhs-section-heading", "xhs-keep-next");
  }

  for (const paragraph of measure.querySelectorAll("p")) {
    const style = getComputedStyle(paragraph);
    const inline = paragraph.getAttribute("style") || "";
    const insideHeading = Boolean(paragraph.closest(".xhs-section-heading"));
    const insideCode = /mono/i.test(style.fontFamily)
      || Boolean(paragraph.closest('[style*="background:#1E293B"], [style*="background:#0F172A"]'));
    const isCaption = !insideHeading && !insideCode
      && style.textAlign === "center"
      && parseFloat(style.fontSize) <= 27;
    if (isCaption) paragraph.classList.add("xhs-caption");
    else if (!insideHeading && !insideCode) paragraph.classList.add("xhs-html-body");
    if (/border-left\s*:/i.test(inline)) paragraph.classList.add("xhs-subheading", "xhs-keep-next");
  }

  for (const codeBlock of measure.querySelectorAll('[style*="background:#1E293B"]')) {
    if (codeBlock.parentElement === measure) codeBlock.classList.add("xhs-code-block");
  }

  // 图片和紧随其后的图注组成一个媒体单元，防止图注跨页，同时统一居中。
  for (const element of [...measure.children]) {
    if (!element.querySelector?.("img")) continue;
    const caption = element.nextElementSibling;
    if (!caption?.classList.contains("xhs-caption")) continue;
    const pair = document.createElement("div");
    pair.className = "xhs-media-pair";
    element.replaceWith(pair);
    pair.append(element, caption);
  }

  for (const element of [...measure.children]) element.classList.add("xhs-html-block");
  const direct = [...measure.children];
  for (let index = 0; index < direct.length - 1; index++) {
    const current = direct[index];
    const next = direct[index + 1];
    const endsWithLead = /[：:]\s*$/.test((current.textContent || "").trim());
    if (endsWithLead && (next.classList.contains("xhs-list-row") || next.classList.contains("xhs-subheading"))) {
      current.classList.add("xhs-keep-next");
    }
  }
}, { html: contentHtml, unwrapRoot: isHtml });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all(
  [...document.images].map((image) => image.complete
    ? Promise.resolve()
    : new Promise((done) => { image.onload = image.onerror = done; }))
));

const pagination = await page.evaluate(({ profile: cardProfile, avatarData }) => {
  const measure = document.getElementById("measure");
  const stage = document.getElementById("stage");
  const template = document.getElementById("card-template");

  const probe = template.content.firstElementChild.cloneNode(true);
  const probeAvatar = document.createElement("div");
  probeAvatar.className = "avatar-fallback";
  probeAvatar.textContent = "测";
  probe.querySelector(".card-header").insertBefore(probeAvatar, probe.querySelector(".id-block"));
  probe.querySelector(".footer-note").textContent = "测";
  probe.querySelector(".page-no").textContent = "1 / 9";
  stage.appendChild(probe);
  const header = probe.querySelector(".card-header");
  const footer = probe.querySelector(".card-footer");
  const body = probe.querySelector(".card-body");
  const maxHeight = probe.clientHeight - header.offsetHeight - footer.offsetHeight
    - parseFloat(getComputedStyle(footer).marginTop) - parseFloat(getComputedStyle(body).paddingTop);
  stage.removeChild(probe);

  const margin = 16;
  const groups = [];
  let current = { nodes: [], height: 0 };
  const flush = () => {
    if (current.nodes.length) groups.push(current);
    current = { nodes: [], height: 0 };
  };
  const elements = [...measure.children];
  for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
    const element = elements[elementIndex];
    if (element.tagName === "HR") {
      flush();
      continue;
    }
    const height = element.offsetHeight + margin;
    const next = elements[elementIndex + 1];
    const nextHeight = next ? next.offsetHeight + margin : 0;
    if (element.classList.contains("xhs-keep-next")
      && current.nodes.length
      && current.height + height + nextHeight > maxHeight) flush();
    if (height > maxHeight && !current.nodes.length) {
      groups.push({ nodes: [element], height, shrink: true });
      continue;
    }
    if (current.height + height > maxHeight) flush();
    if (height > maxHeight) {
      groups.push({ nodes: [element], height, shrink: true });
      continue;
    }
    current.nodes.push(element);
    current.height += height;
  }
  flush();

  // 相邻页做一次顺序不变的均衡：把前一页末尾的完整内容块移到后一页页首，
  // 仅在两页高度差确实缩小时执行。避免末页只有一句话，也不切断段落或媒体。
  const blockHeight = (node) => node.offsetHeight + margin;
  for (let groupIndex = 0; groupIndex < groups.length - 1; groupIndex++) {
    const previous = groups[groupIndex];
    const following = groups[groupIndex + 1];
    if (previous.shrink || following.shrink) continue;
    while (previous.nodes.length > 1) {
      let moveStart = previous.nodes.length - 1;
      if (moveStart > 0 && previous.nodes[moveStart - 1].classList.contains("xhs-keep-next")) moveStart--;
      const moving = previous.nodes.slice(moveStart);
      const movingHeight = moving.reduce((sum, node) => sum + blockHeight(node), 0);
      if (following.height + movingHeight > maxHeight) break;
      const currentDifference = Math.abs(previous.height - following.height);
      const movedDifference = Math.abs(
        (previous.height - movingHeight) - (following.height + movingHeight),
      );
      if (movedDifference >= currentDifference) break;
      previous.nodes.splice(moveStart, moving.length);
      following.nodes.unshift(...moving);
      previous.height -= movingHeight;
      following.height += movingHeight;
    }
  }

  const summaries = [];
  groups.forEach((group, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.page = String(index + 1);
    const headerElement = card.querySelector(".card-header");
    if (avatarData) {
      const image = document.createElement("img");
      image.className = "avatar";
      image.src = avatarData;
      headerElement.insertBefore(image, headerElement.firstElementChild);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "avatar-fallback";
      fallback.textContent = (cardProfile.displayName || "?").trim().charAt(0);
      headerElement.insertBefore(fallback, headerElement.firstElementChild);
    }
    card.querySelector(".display-name").textContent = cardProfile.displayName;
    card.querySelector(".handle").textContent = cardProfile.handle;
    if (cardProfile.verified) card.querySelector(".badge").style.display = "";
    card.querySelector(".footer-note").textContent = cardProfile.footerNote;
    card.querySelector(".page-no").textContent = `${index + 1} / ${groups.length}`;
    const bodyElement = card.querySelector(".card-body");
    group.nodes.forEach((node) => bodyElement.appendChild(node));
    if (group.shrink) {
      const wrapper = document.createElement("div");
      wrapper.className = "fit-shrink";
      while (bodyElement.firstChild) wrapper.appendChild(bodyElement.firstChild);
      bodyElement.appendChild(wrapper);
      wrapper.style.zoom = String(Math.min(1, maxHeight / group.height));
    }
    stage.appendChild(card);
    summaries.push((bodyElement.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48));
  });
  const fillRatios = groups.map((group) => Math.round(Math.min(1, group.height / maxHeight) * 100));
  return { pages: groups.length, maxHeight: Math.round(maxHeight), summaries, fillRatios };
}, { profile, avatarData: avatarDataUrl });

console.log(`✓ 分页 ${pagination.pages} 张，正文区 ${pagination.maxHeight}px，利用率 ${pagination.fillRatios.join(",")}`);

for (const filename of readdirSync(outDir)) {
  if (/^card-\d+\.png$/.test(filename)) unlinkSync(join(outDir, filename));
}

const files = [];
await page.setViewportSize({ width: CARD_W + 200, height: CARD_H + 200 });
await page.evaluate(() => {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);
});
for (let index = 1; index <= pagination.pages; index++) {
  await page.evaluate(({ pageNumber, cardHeight }) => {
    document.getElementById("stage").style.transform = `translateY(-${(pageNumber - 1) * cardHeight}px)`;
    window.scrollTo(0, 0);
  }, { pageNumber: index, cardHeight: CARD_H });
  const filename = `card-${String(index).padStart(2, "0")}.png`;
  await page.screenshot({
    path: join(outDir, filename),
    clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
  });
  files.push(filename);
}
await browser.close();

const manifest = {
  source: input,
  inputType: isHtml ? "html" : "markdown",
  title,
  articleId,
  variant,
  sourceLabel,
  pages: pagination.pages,
  size: `${CARD_W * SCALE}x${CARD_H * SCALE}`,
  logicalSize: `${CARD_W}x${CARD_H}`,
  exportScale: SCALE,
  bodyFontSize: "34px",
  targetMaxPages: TARGET_MAX_PAGES,
  htmlFontScale: isHtml ? htmlFontScale : null,
  profile: { ...profile, avatar: profile.avatar ? "(configured)" : "(fallback)" },
  files,
  summaries: pagination.summaries,
  fillRatios: pagination.fillRatios,
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

const description = isHtml
  ? `由公众号排版 HTML 渲染，正文内联字号按 ${htmlFontScale} 倍归一到 34px 阅读基准，保留原主题层级与内容块；点击任意卡片可打开原图。`
  : "由原始 Markdown 按固定 864×1152 逻辑画布和 34px 正文基准渲染；页数由内容自然产生，不为控制张数缩小字号。";
writeGallery(outDir, { files, title, sourceLabel, description, previewRoot });

if (previewRoot) {
  const indexResult = writeUnifiedPreviewIndex(previewRoot);
  console.log(`✓ 已更新统一预览入口: ${indexResult.destination}（${indexResult.entries} 个预览）`);
}

console.log(`✅ 生成 ${pagination.pages} 张卡片 → ${outDir}`);
if (pagination.pages > TARGET_MAX_PAGES) console.warn(`[warn] 共 ${pagination.pages} 张，超过内容卡片目标 ${TARGET_MAX_PAGES} 张，请检查分页利用率。`);
if (pagination.pages > 18) console.warn(`[warn] 共 ${pagination.pages} 张，超过小红书单帖 18 张上限，请精简或拆帖。`);
pagination.summaries.forEach((summary, index) => console.log(
  `  ${String(index + 1).padStart(2, "0")} [${pagination.fillRatios[index]}%]: ${summary}`,
));
