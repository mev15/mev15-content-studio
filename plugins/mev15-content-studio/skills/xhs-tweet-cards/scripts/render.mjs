#!/usr/bin/env node
/**
 * xhs-tweet-cards 渲染器
 * 输入 Markdown / HTML，输出带推文壳的小红书 3:4 多图（2160×2880 PNG）。
 * 原文保真：内容只经 marked 确定性转换与 DOM 分页，不经任何改写。
 *
 * 用法:
 *   node render.mjs <input.md|input.html> [--out DIR] [--config FILE]
 *                   [--name 昵称] [--handle @xx] [--avatar 图片] [--no-verified]
 * 分页:
 *   Markdown 中单独一行 `---` 为强制分页符；其余按块级元素边界自动分页。
 */
import { chromium } from "playwright";
import { marked } from "marked";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";

const SKILL_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");
const CARD_W = 1080, CARD_H = 1440, SCALE = 2;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-verified") args.verified = false;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function toDataUrl(filePath) {
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" }[extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`不支持的图片格式: ${filePath}`);
  const buf = readFileSync(filePath);
  if (buf.length > 15 * 1024 * 1024) throw new Error(`图片超过 15MB: ${filePath}`);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** 把 HTML 里的本地图片路径内联为 data URL（远程 URL 保留） */
function inlineLocalImages(html, baseDir) {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (m, pre, src, post) => {
    if (/^(https?:|data:)/i.test(src)) return m;
    const p = resolve(baseDir, decodeURIComponent(src));
    if (!existsSync(p)) {
      console.warn(`[warn] 图片不存在，保留原引用: ${src}`);
      return m;
    }
    return pre + toDataUrl(p) + post;
  });
}

const args = parseArgs(process.argv.slice(2));
const inputPath = args._[0];
if (!inputPath) {
  console.error("用法: node render.mjs <input.md|input.html> [--out DIR] [--config FILE] [--name ..] [--handle ..] [--avatar ..] [--no-verified]");
  process.exit(2);
}

const input = resolve(inputPath);
const outDir = resolve(args.out || join(dirname(input), "xhs-cards"));
const configPath = args.config ? resolve(args.config) : join(SKILL_DIR, "config.json");
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};

const profile = {
  displayName: args.name || config.displayName || "未命名作者",
  handle: args.handle || config.handle || "@handle",
  verified: args.verified !== undefined ? args.verified : config.verified !== false,
  avatar: args.avatar || config.avatar || "",
  footerNote: args["footer-note"] ?? config.footerNote ?? "",
};

const raw = readFileSync(input, "utf-8");
const isHtml = /\.html?$/i.test(input);
marked.setOptions({ gfm: true, breaks: true });
let contentHtml = isHtml ? raw : marked.parse(raw);
contentHtml = inlineLocalImages(contentHtml, dirname(input));

let avatarDataUrl = "";
if (profile.avatar) {
  const p = resolve(profile.avatar.startsWith("~") ? profile.avatar.replace("~", process.env.HOME) : profile.avatar);
  if (existsSync(p)) avatarDataUrl = toDataUrl(p);
  else console.warn(`[warn] 头像文件不存在: ${p}，使用首字占位`);
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: CARD_W + 200, height: CARD_H + 200 }, deviceScaleFactor: SCALE });

const templateHtml = readFileSync(join(SKILL_DIR, "assets", "template.html"), "utf-8");
await page.setContent(templateHtml, { waitUntil: "load" });
await page.evaluate((html) => { document.getElementById("measure").innerHTML = html; }, contentHtml);
await page.evaluate(() => document.fonts.ready);
// 等待所有图片（含 data URL）解码完成，避免截图空框
await page.evaluate(() => Promise.all(
  [...document.images].map((img) => img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))
));

// —— 分页 + 逐页渲染，全部在页面内完成，Node 侧只负责逐页截图 ——
const plan = await page.evaluate(({ profile, avatarDataUrl }) => {
  const measure = document.getElementById("measure");
  const stage = document.getElementById("stage");
  const tpl = document.getElementById("card-template");

  // 1. 用一张空卡实测 header/footer 占高，得出正文可用高度
  //    探针需带上头像与页脚占位，否则 header/footer 测偏矮，每页会超塞
  const probe = tpl.content.firstElementChild.cloneNode(true);
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
  const bodyStyle = getComputedStyle(body);
  const footStyle = getComputedStyle(footer);
  const maxH = probe.clientHeight - header.offsetHeight - footer.offsetHeight
    - parseFloat(footStyle.marginTop) - parseFloat(bodyStyle.paddingTop);
  stage.removeChild(probe);

  // 2. 按块级元素边界分组；HR = 强制分页；单元素超高 → 独占 + 缩放
  const MARGIN = 26;
  const blocks = [...measure.children];
  const groups = [];
  let cur = { nodes: [], height: 0 };
  const flush = () => { if (cur.nodes.length) { groups.push(cur); cur = { nodes: [], height: 0 }; } };
  for (const el of blocks) {
    if (el.tagName === "HR") { flush(); continue; }
    const h = el.offsetHeight + MARGIN;
    if (h > maxH && !cur.nodes.length) { groups.push({ nodes: [el], height: h, shrink: true }); continue; }
    if (cur.height + h > maxH) flush();
    if (h > maxH) { groups.push({ nodes: [el], height: h, shrink: true }); continue; }
    cur.nodes.push(el); cur.height += h;
  }
  flush();

  // 3. 逐页构建真实卡片 DOM
  const summaries = [];
  groups.forEach((group, i) => {
    const card = tpl.content.firstElementChild.cloneNode(true);
    card.dataset.page = String(i + 1);
    // header 身份区
    const headerEl = card.querySelector(".card-header");
    if (avatarDataUrl) {
      const img = document.createElement("img");
      img.className = "avatar"; img.src = avatarDataUrl;
      headerEl.insertBefore(img, headerEl.firstElementChild);
    } else {
      const fb = document.createElement("div");
      fb.className = "avatar-fallback";
      fb.textContent = (profile.displayName || "?").trim().charAt(0);
      headerEl.insertBefore(fb, headerEl.firstElementChild);
    }
    card.querySelector(".display-name").textContent = profile.displayName;
    card.querySelector(".handle").textContent = profile.handle;
    if (profile.verified) card.querySelector(".badge").style.display = "";
    // footer
    card.querySelector(".footer-note").textContent = profile.footerNote;
    card.querySelector(".page-no").textContent = `${i + 1} / ${groups.length}`;
    // 正文
    const bodyEl = card.querySelector(".card-body");
    group.nodes.forEach((n) => bodyEl.appendChild(n));
    if (group.shrink) {
      const wrap = document.createElement("div");
      wrap.className = "fit-shrink";
      while (bodyEl.firstChild) wrap.appendChild(bodyEl.firstChild);
      bodyEl.appendChild(wrap);
      wrap.style.zoom = String(Math.min(1, maxH / group.height));
    }
    stage.appendChild(card);
    summaries.push((card.querySelector(".card-body").textContent || "").trim().replace(/\s+/g, " ").slice(0, 48));
  });
  return { pages: groups.length, maxH: Math.round(maxH), summaries };
}, { profile, avatarDataUrl });

// —— 逐页截图 ——
const files = [];
for (let i = 1; i <= plan.pages; i++) {
  const card = page.locator(`.card[data-page="${i}"]`);
  await card.scrollIntoViewIfNeeded();
  const name = `card-${String(i).padStart(2, "0")}.png`;
  await card.screenshot({ path: join(outDir, name) });
  files.push(name);
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify({
  source: input, pages: plan.pages, size: `${CARD_W * SCALE}x${CARD_H * SCALE}`,
  profile: { ...profile, avatar: profile.avatar ? "(configured)" : "(fallback)" },
  files, summaries: plan.summaries,
}, null, 2));

await browser.close();
console.log(`✅ 生成 ${plan.pages} 张卡片 → ${outDir}`);
plan.summaries.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2, "0")}: ${s}`));
