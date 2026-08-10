#!/usr/bin/env node
import { chromium } from "playwright";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { refreshPreviewIndex } from "./update-preview.mjs";

const SKILL_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");
const CARD_W = 1080;
const CARD_H = 1440;
const ALLOWED_TYPES = new Set(["cover", "statement", "list", "steps", "compare", "quote", "image", "tool", "summary"]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) args[token.slice(2)] = argv[++i];
    else args._.push(token);
  }
  return args;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatInline(value = "") {
  return escapeHtml(value)
    .replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

function safeSegment(value, fallback = "untitled") {
  const cleaned = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "");
  return cleaned || fallback;
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const result = {};
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function homePath(value) {
  const raw = String(value || "");
  if (raw === "~") return process.env.HOME || raw;
  if (raw.startsWith("~/")) return join(process.env.HOME || "", raw.slice(2));
  return raw;
}

function imageDataUrl(filePath) {
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  }[extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`不支持的图片格式: ${filePath}`);
  return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`;
}

function resolveImage(src, baseDir) {
  if (!src) return "";
  if (/^(https?:|data:)/i.test(src)) return src;
  const candidate = resolve(baseDir, homePath(src));
  if (!existsSync(candidate)) throw new Error(`图片不存在: ${candidate}`);
  return imageDataUrl(candidate);
}

function textLength(value) {
  return Array.from(String(value || "").replace(/\*\*|==/g, "").replace(/\s/g, "")).length;
}

function booleanValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
}

function validateStoryboard(story) {
  const errors = [];
  const warnings = [];
  if (!story || typeof story !== "object") errors.push("根节点必须是 JSON object");
  if (!String(story?.title || "").trim()) errors.push("缺少 title");
  if (!Array.isArray(story?.pages)) errors.push("pages 必须是数组");
  const pages = Array.isArray(story?.pages) ? story.pages : [];
  if (pages.length < 4 || pages.length > 15) errors.push(`pages 必须为 4–15 张，当前 ${pages.length} 张`);
  if (pages[0]?.type !== "cover") errors.push("第 1 张必须是 cover");
  const usedTypes = new Set();
  pages.forEach((page, index) => {
    const label = `第 ${index + 1} 张`;
    if (!ALLOWED_TYPES.has(page?.type)) errors.push(`${label} type 不支持: ${page?.type}`);
    usedTypes.add(page?.type);
    if (page?.type === "cover" && !String(page.title || "").trim()) errors.push(`${label} 缺少 title`);
    if (["statement", "list", "steps", "compare", "image", "summary"].includes(page?.type)
      && !String(page.title || "").trim()) errors.push(`${label} 缺少 title`);
    if (["list", "steps", "summary"].includes(page?.type)) {
      if (!Array.isArray(page.items) || page.items.length < 2 || page.items.length > 6) {
        errors.push(`${label} items 必须为 2–6 条`);
      }
    }
    if (page?.type === "compare") {
      for (const side of ["left", "right"]) {
        if (!page[side] || !String(page[side].title || "").trim()) errors.push(`${label} 缺少 ${side}.title`);
        if (!Array.isArray(page[side]?.items) || page[side].items.length < 2 || page[side].items.length > 4) {
          errors.push(`${label} ${side}.items 必须为 2–4 条`);
        }
      }
    }
    if (page?.type === "quote" && !String(page.quote || "").trim()) errors.push(`${label} 缺少 quote`);
    if (page?.type === "image" && !String(page.src || "").trim()) errors.push(`${label} 缺少 src`);
    if (page?.type === "tool") {
      if (!String(page.toolName || "").trim()) errors.push(`${label} 缺少 toolName`);
      if (!String(page.toolUrl || "").trim()) errors.push(`${label} 缺少 toolUrl`);
      if (!String(page.src || "").trim()) errors.push(`${label} 缺少 src`);
    }
    const title = page?.type === "quote" ? page.quote : page?.type === "tool" ? page.toolName : page?.title;
    const recommended = page?.type === "cover" ? 20 : page?.type === "quote" ? 34 : 18;
    if (textLength(title) > recommended) warnings.push(`${label} 主文案偏长（${textLength(title)} 字，建议 ≤${recommended}）`);
    if (index > 0 && pages[index - 1]?.type === page?.type && page?.type !== "image") {
      warnings.push(`${label} 与上一张重复使用 ${page.type} 版式`);
    }
  });
  if (usedTypes.size < 3) errors.push("整组至少使用 3 种页面角色");
  if (pages.length && !["summary", "quote"].includes(pages.at(-1)?.type)) warnings.push("最后一张建议使用 summary 或 quote");
  if (!story?.post || typeof story.post !== "object") errors.push("缺少 post");
  if (!String(story?.post?.title || "").trim()) errors.push("缺少 post.title");
  if (textLength(story?.post?.title) > 20) errors.push(`post.title 超过 20 字（当前 ${textLength(story?.post?.title)}）`);
  if (!String(story?.post?.body || "").trim()) errors.push("缺少 post.body");
  const tags = Array.isArray(story?.post?.tags) ? story.post.tags : [];
  const caption = `${story?.post?.title || ""}\n\n${story?.post?.body || ""}\n\n${tags.join(" ")}`.trim();
  if (textLength(caption) > 1000) errors.push(`发帖文案超过 1000 字（当前 ${textLength(caption)}）`);
  return { errors, warnings, caption };
}

function normalizeItem(item) {
  if (typeof item === "string") return { title: item, text: "", icon: "" };
  return {
    title: String(item?.title || item?.text || ""),
    text: item?.title ? String(item?.text || "") : "",
    icon: String(item?.icon || ""),
  };
}

function pageChrome(page, index, total, profile, avatar, body, className = "") {
  const eyebrow = page.eyebrow || (index === 0 ? "QING SHIWU / CAROUSEL" : "QING SHIWU / NOTES");
  const avatarHtml = avatar
    ? `<img class="avatar" src="${avatar}" alt="">`
    : `<div class="avatar-fallback">${escapeHtml(profile.displayName.trim().charAt(0) || "青")}</div>`;
  const verifiedHtml = profile.verified
    ? `<svg class="verified-badge" viewBox="0 0 24 24" aria-label="已验证"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>`
    : "";
  return `    <section class="poster xhs type-${escapeHtml(page.type)}" id="card-${String(index + 1).padStart(2, "0")}" data-type="${escapeHtml(page.type)}">
      <div class="page ${escapeHtml(className)}">
        <header class="tweet-header">
          ${avatarHtml}
          <div class="identity-copy"><div class="name-row"><p class="display-name">${escapeHtml(profile.displayName)}</p>${verifiedHtml}</div><p class="handle">${escapeHtml(profile.handle)}</p></div>
          <div class="more-dots" aria-hidden="true">···</div>
        </header>
        <div class="topline"><p class="eyebrow">${escapeHtml(eyebrow)}</p><p class="page-count">${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</p></div>
        ${body}
        <footer class="footer">
          <p class="footer-note">${escapeHtml(profile.footerNote || "LONG POST")}</p>
          <p class="footer-handle">${escapeHtml(profile.handle)}</p>
        </footer>
      </div>
    </section>`;
}

function renderListItems(items, baseDir) {
  return items.map((raw, index) => {
    const item = normalizeItem(raw);
    const icon = item.icon ? resolveImage(item.icon, baseDir) : "";
    const heading = `<div class="ledger-heading">${icon ? `<img class="ledger-icon" src="${icon}" alt="">` : ""}<h3 class="ledger-title">${formatInline(item.title)}</h3></div>`;
    return `<div class="ledger-row"><div class="ledger-no">${String(index + 1).padStart(2, "0")}</div><div class="ledger-copy${icon ? " has-icon" : ""}">${heading}${item.text ? `<p class="ledger-text">${formatInline(item.text)}</p>` : ""}</div></div>`;
  }).join("");
}

function renderPage(page, index, total, profile, avatar, baseDir) {
  if (page.type === "cover") {
    const tags = Array.isArray(page.tags) && page.tags.length
      ? `<div class="tag-row">${page.tags.slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
      : "";
    const body = `<div class="page-body cover-body"><div class="cover-mark">Q15</div><div class="cover-copy"><h1 class="cover-title">${formatInline(page.title)}</h1>${page.subtitle ? `<p class="cover-subtitle">${formatInline(page.subtitle)}</p>` : ""}</div>${tags}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "statement") {
    const body = `<div class="page-body statement-body"><h2 class="statement-title">${formatInline(page.title)}</h2>${page.accent ? `<div class="statement-accent">${formatInline(page.accent)}</div>` : ""}${page.body ? `<p class="statement-copy">${formatInline(page.body)}</p>` : ""}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "list" || page.type === "summary") {
    const body = `<div class="page-body"><h2 class="page-title">${formatInline(page.title)}</h2>${page.intro ? `<p class="intro">${formatInline(page.intro)}</p>` : ""}<div class="ledger">${renderListItems(page.items || [], baseDir)}</div>${page.closing ? `<p class="closing">${formatInline(page.closing)}</p>` : ""}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "steps") {
    const steps = (page.items || []).map((raw, stepIndex) => {
      const item = normalizeItem(raw);
      return `<div class="step"><div class="step-no">${String(stepIndex + 1).padStart(2, "0")}</div><div><h3 class="step-title">${formatInline(item.title)}</h3>${item.text ? `<p class="step-text">${formatInline(item.text)}</p>` : ""}</div></div>`;
    }).join("");
    const body = `<div class="page-body"><h2 class="page-title">${formatInline(page.title)}</h2>${page.intro ? `<p class="intro">${formatInline(page.intro)}</p>` : ""}<div class="steps">${steps}</div></div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "compare") {
    const side = (value) => `<div class="compare-side"><h3 class="compare-title">${formatInline(value.title)}</h3><ul class="compare-list">${value.items.map((item) => `<li>${formatInline(typeof item === "string" ? item : item?.title || item?.text || "")}</li>`).join("")}</ul></div>`;
    const body = `<div class="page-body"><h2 class="page-title">${formatInline(page.title)}</h2>${page.intro ? `<p class="intro">${formatInline(page.intro)}</p>` : ""}<div class="compare-grid">${side(page.left)}${side(page.right)}</div></div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "quote") {
    const body = `<div class="page-body quote-body"><div class="quote-mark">“</div>${page.title ? `<h2 class="page-title">${formatInline(page.title)}</h2>` : ""}<p class="quote-copy">${formatInline(page.quote)}</p>${page.note ? `<p class="quote-note">${formatInline(page.note)}</p>` : ""}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "image") {
    const src = resolveImage(page.src, baseDir);
    const imageItems = Array.isArray(page.items) && page.items.length
      ? `<div class="image-list">${page.items.slice(0, 4).map((raw, itemIndex) => { const item = normalizeItem(raw); return `<div class="image-list-row"><div class="image-list-no">${String(itemIndex + 1).padStart(2, "0")}</div><p class="image-list-text">${formatInline(item.text ? `${item.title}：${item.text}` : item.title)}</p></div>`; }).join("")}</div>`
      : "";
    const body = `<div class="page-body image-body"><h2 class="page-title">${formatInline(page.title)}</h2>${page.intro ? `<p class="intro">${formatInline(page.intro)}</p>` : ""}<figure class="image-frame"><img src="${src}" alt="${escapeHtml(page.alt || page.title)}"></figure>${page.caption ? `<p class="image-caption">${formatInline(page.caption)}</p>` : ""}${page.note ? `<p class="image-note">${formatInline(page.note)}</p>` : ""}${imageItems}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  if (page.type === "tool") {
    const src = resolveImage(page.src, baseDir);
    const icon = page.icon ? resolveImage(page.icon, baseDir) : "";
    const fallback = escapeHtml(String(page.toolName || "T").trim().charAt(0).toUpperCase() || "T");
    const iconHtml = icon
      ? `<img class="tool-icon" src="${icon}" alt="${escapeHtml(page.toolName)} icon">`
      : `<div class="tool-icon tool-icon-fallback">${fallback}</div>`;
    const body = `<div class="page-body tool-body"><div class="tool-heading">${iconHtml}<div class="tool-identity"><p class="tool-label">TOOL</p><h2 class="tool-name">${formatInline(page.toolName)}</h2><p class="tool-url"><mark>${escapeHtml(page.toolUrl)}</mark></p></div></div>${page.title ? `<p class="tool-title">${formatInline(page.title)}</p>` : ""}<figure class="tool-frame"><img src="${src}" alt="${escapeHtml(page.alt || page.title || page.toolName)}"></figure>${page.caption ? `<p class="image-caption">${formatInline(page.caption)}</p>` : ""}${page.note ? `<p class="tool-note">${formatInline(page.note)}</p>` : ""}</div>`;
    return pageChrome(page, index, total, profile, avatar, body);
  }

  throw new Error(`不支持的页面类型: ${page.type}`);
}

function hrefFor(pathValue) {
  return String(pathValue).split("/").map((part) => encodeURIComponent(part)).join("/");
}

function writeGallery(outDir, options) {
  const template = readFileSync(join(SKILL_DIR, "assets", "gallery-template.html"), "utf8");
  const gallery = options.files.map((file, index) => `      <figure><a href="${file}"><img src="${file}" alt="第 ${index + 1} 张" loading="${index === 0 ? "eager" : "lazy"}"></a><figcaption>${String(index + 1).padStart(2, "0")} / ${String(options.files.length).padStart(2, "0")}</figcaption></figure>`).join("\n");
  const back = options.previewRoot
    ? `<a class="back" href="${hrefFor(relative(outDir, join(options.previewRoot, "index.html")).replaceAll("\\", "/"))}">← 返回统一预览入口</a>`
    : `<span class="back">小红书自动轮播预览</span>`;
  const replacements = {
    "{{PAGE_TITLE}}": escapeHtml(`${options.title} · 小红书轮播预览`),
    "{{BACK_LINK}}": back,
    "{{BADGE}}": escapeHtml(`XHS CAROUSEL · ${options.files.length} 张`),
    "{{ARTICLE_TITLE}}": escapeHtml(options.title),
    "{{GALLERY_ITEMS}}": gallery,
    "{{CAPTION}}": escapeHtml(options.caption),
  };
  let html = template;
  for (const [needle, value] of Object.entries(replacements)) html = html.replaceAll(needle, value);
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const inputArg = args._[0];
if (!inputArg) {
  console.error("用法: node scripts/render.mjs <storyboard.json> [--out DIR | --preview-root DIR --article-id ID --variant carousel] [--env-file FILE]");
  process.exit(2);
}

const inputPath = resolve(inputArg);
if (!existsSync(inputPath)) throw new Error(`故事板不存在: ${inputPath}`);
const story = JSON.parse(readFileSync(inputPath, "utf8"));
const schema = validateStoryboard(story);
if (schema.errors.length) {
  console.error(schema.errors.map((item) => `[storyboard] ${item}`).join("\n"));
  process.exit(2);
}
schema.warnings.forEach((item) => console.warn(`[storyboard warn] ${item}`));

const configEnvPath = args["env-file"]
  ? resolve(args["env-file"])
  : join(process.env.HOME || "", ".config", "xhs-carousel", "env");
const configEnv = readEnvFile(configEnvPath);
const envValue = (...names) => {
  for (const name of names) {
    if (process.env[name] !== undefined) return process.env[name];
    if (configEnv[name] !== undefined) return configEnv[name];
  }
  return undefined;
};
const normalizeHandle = (value) => String(value || "").trim().replace(/^@?/, "@");
const siblingAvatar = resolve(SKILL_DIR, "..", "qing-shiwu-illustrations", "assets", "ip-reference", "qing-shiwu-avatar.jpg");
const profile = {
  displayName: args.name || envValue("XHS_CAROUSEL_DISPLAY_NAME", "XHS_TWEET_CARDS_DISPLAY_NAME") || "青十五",
  handle: normalizeHandle(args.handle || envValue("XHS_CAROUSEL_HANDLE", "XHS_TWEET_CARDS_HANDLE") || "mev15_eth"),
  avatarPath: homePath(args.avatar || envValue("XHS_CAROUSEL_AVATAR", "XHS_TWEET_CARDS_AVATAR") || (existsSync(siblingAvatar) ? siblingAvatar : "")),
  verified: booleanValue(envValue("XHS_CAROUSEL_VERIFIED", "XHS_TWEET_CARDS_VERIFIED"), true),
  footerNote: args["footer-note"] ?? envValue("XHS_CAROUSEL_FOOTER_NOTE", "XHS_TWEET_CARDS_FOOTER_NOTE") ?? "",
};
const avatar = profile.avatarPath && existsSync(resolve(profile.avatarPath)) ? imageDataUrl(resolve(profile.avatarPath)) : "";
if (profile.avatarPath && !avatar) console.warn(`[warn] 头像不存在: ${profile.avatarPath}`);

const previewRoot = args["preview-root"] ? resolve(args["preview-root"]) : null;
const inferredId = basename(story.source || inputPath, extname(story.source || inputPath));
const articleId = safeSegment(args["article-id"] || inferredId);
const variant = safeSegment(args.variant || "carousel", "carousel");
const outDir = resolve(args.out || (previewRoot
  ? join(previewRoot, articleId, variant)
  : join(dirname(inputPath), "xhs-carousel", articleId)));
mkdirSync(outDir, { recursive: true });

const posters = story.pages.map((page, index) => renderPage(page, index, story.pages.length, profile, avatar, dirname(inputPath))).join("\n");
let deck = readFileSync(join(SKILL_DIR, "assets", "deck-template.html"), "utf8");
deck = deck.replaceAll("{{PAGE_TITLE}}", escapeHtml(story.title)).replace("{{POSTERS}}", posters);
const deckPath = join(outDir, "deck.html");
writeFileSync(deckPath, deck, "utf8");
writeFileSync(join(outDir, "storyboard.json"), JSON.stringify(story, null, 2), "utf8");
writeFileSync(join(outDir, "caption.txt"), `${schema.caption}\n`, "utf8");

for (const filename of readdirSync(outDir)) {
  if (/^card-\d+\.png$/.test(filename)) unlinkSync(join(outDir, filename));
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const context = await browser.newContext({ viewport: { width: 1240, height: 1600 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(pathToFileURL(deckPath).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map((image) => image.complete
  ? Promise.resolve()
  : new Promise((done) => { image.onload = image.onerror = done; }))));

const layout = await page.$$eval(".poster", (posters) => posters.map((poster) => {
  const pageBody = poster.querySelector(".page-body");
  const footer = poster.querySelector(".footer");
  const posterRect = poster.getBoundingClientRect();
  const bodyRect = pageBody.getBoundingClientRect();
  const footerRect = footer.getBoundingClientRect();
  const title = poster.querySelector(".cover-title,.statement-title,.page-title,.quote-copy");
  const titleStyle = title ? getComputedStyle(title) : null;
  const lineHeight = titleStyle ? parseFloat(titleStyle.lineHeight) : 0;
  const titleLines = title && lineHeight ? Math.round(title.getBoundingClientRect().height / lineHeight) : 0;
  let minBodyFont = Infinity;
  for (const node of pageBody.querySelectorAll("p,li,h3,.ledger-text,.step-text")) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    minBodyFont = Math.min(minBodyFont, parseFloat(getComputedStyle(node).fontSize));
  }
  const children = [...pageBody.children].filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 4 && rect.height > 4;
  });
  const top = children.length ? Math.min(...children.map((node) => node.getBoundingClientRect().top)) : bodyRect.top;
  const bottom = children.length ? Math.max(...children.map((node) => node.getBoundingClientRect().bottom)) : bodyRect.top;
  return {
    id: poster.id,
    type: poster.dataset.type,
    width: poster.clientWidth,
    height: poster.clientHeight,
    overflow: Math.max(0, poster.scrollHeight - poster.clientHeight, pageBody.scrollHeight - pageBody.clientHeight),
    footerCollision: Math.max(0, Math.round(bottom - footerRect.top)),
    activeRatio: Number(((bottom - top) / Math.max(1, bodyRect.height)).toFixed(3)),
    minBodyFont: Number.isFinite(minBodyFont) ? minBodyFont : null,
    titleLines,
    posterBounds: {
      top: Math.round(bodyRect.top - posterRect.top),
      bottom: Math.round(bottom - posterRect.top),
    },
  };
}));

const validation = {
  ok: true,
  generatedAt: new Date().toISOString(),
  schemaWarnings: schema.warnings,
  pages: layout.map((item, index) => {
    const errors = [];
    const warnings = [];
    if (item.width !== CARD_W || item.height !== CARD_H) errors.push(`画布尺寸 ${item.width}×${item.height}`);
    if (item.overflow > 3) errors.push(`内容溢出 ${item.overflow}px`);
    if (item.footerCollision > 3) errors.push(`内容侵入页脚 ${item.footerCollision}px`);
    if (item.minBodyFont !== null && item.minBodyFont < 28) errors.push(`正文最小字号 ${item.minBodyFont}px`);
    if (item.type === "cover" && item.titleLines > 4) errors.push(`封面标题 ${item.titleLines} 行`);
    if (item.type !== "cover" && item.titleLines > 5) errors.push(`主文案 ${item.titleLines} 行`);
    if (!["cover", "statement", "quote"].includes(item.type) && item.activeRatio < 0.62) warnings.push(`正文区利用率 ${Math.round(item.activeRatio * 100)}%`);
    return { index: index + 1, ...item, errors, warnings };
  }),
};
validation.ok = validation.pages.every((item) => item.errors.length === 0);
writeFileSync(join(outDir, "validation.json"), JSON.stringify(validation, null, 2), "utf8");

const files = [];
for (let index = 0; index < story.pages.length; index++) {
  const filename = `card-${String(index + 1).padStart(2, "0")}.png`;
  await page.locator(`#card-${String(index + 1).padStart(2, "0")}`).screenshot({ path: join(outDir, filename) });
  files.push(filename);
}
await browser.close();

const manifest = {
  source: story.source || inputPath,
  inputType: "carousel",
  title: story.title,
  articleId,
  variant,
  sourceLabel: "AI 故事板轮播",
  pages: story.pages.length,
  pageTypes: story.pages.map((item) => item.type),
  size: `${CARD_W}x${CARD_H}`,
  files,
  profile: { displayName: profile.displayName, handle: profile.handle, verified: profile.verified, avatar: avatar ? "configured" : "fallback" },
  validation: validation.ok ? "passed" : "failed",
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
writeGallery(outDir, { files, title: story.title, caption: schema.caption, previewRoot });

if (previewRoot) {
  const result = refreshPreviewIndex(previewRoot);
  console.log(`✓ 已更新统一预览入口: ${result.destination}`);
}

layout.forEach((item, index) => {
  const result = validation.pages[index];
  const suffix = result.errors.length ? ` FAIL ${result.errors.join("；")}` : result.warnings.length ? ` WARN ${result.warnings.join("；")}` : " PASS";
  console.log(`${String(index + 1).padStart(2, "0")} ${item.type}${suffix}`);
});
console.log(`${validation.ok ? "✅" : "❌"} 生成 ${files.length} 张卡片 → ${outDir}`);
if (!validation.ok) process.exit(1);
