#!/usr/bin/env node
/**
 * 把图文卡片 + 文案存入小红书草稿箱（只存草稿，绝不发布）
 *
 * 用法:
 *   node publish.mjs --dir <卡片目录>            # 目录内需有 card-*.png 与 caption.txt
 *   node publish.mjs --dir <目录> --dry-run      # 只走到填完内容，不点保存
 *
 * 设计原则:
 *   - 只点"存草稿"，永不点"发布"（脚本中不存在发布按钮的点击路径）
 *   - 每一步截图落盘，无界面也能复盘
 *   - 页面结构变化时明确报错并留证据，不做静默兜底
 */
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const SKILL_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");
const STATE_DIR = process.env.XHS_STATE_DIR || join(SKILL_DIR, ".state");
const STATE_FILE = join(STATE_DIR, "storage-state.json");

const PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish?source=official";
const MAX_IMAGES = 18;
const TITLE_MAX = 20;
const BODY_MAX = 1000;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const dir = resolve(args.dir || args._[0] || ".");
const shotDir = join(dir, "publish-shots");
let step = 0;

async function shot(page, name) {
  mkdirSync(shotDir, { recursive: true });
  const p = join(shotDir, `${String(++step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false }).catch(() => {});
  return p;
}

// ---------- 输入校验 ----------
if (!existsSync(STATE_FILE)) {
  console.error(`❌ 未找到登录态: ${STATE_FILE}\n   请先运行: node ${join(SKILL_DIR, "scripts/login.mjs")} --phone <手机号>`);
  process.exit(3);
}
const images = readdirSync(dir).filter((f) => /^card-\d+\.png$/i.test(f)).sort()
  .map((f) => join(dir, f));
if (!images.length) {
  console.error(`❌ ${dir} 下没有 card-NN.png，请先用 xhs-tweet-cards skill 生成卡片。`);
  process.exit(2);
}
if (images.length > MAX_IMAGES) {
  console.error(`❌ 图片 ${images.length} 张，超过小红书上限 ${MAX_IMAGES} 张。`);
  process.exit(2);
}

const captionPath = join(dir, "caption.txt");
if (!existsSync(captionPath)) {
  console.error(`❌ 缺少文案文件: ${captionPath}（第一行标题，空行后为正文）`);
  process.exit(2);
}
const caption = readFileSync(captionPath, "utf-8").replace(/\r\n/g, "\n");
const nl = caption.indexOf("\n");
const title = (nl === -1 ? caption : caption.slice(0, nl)).trim();
const body = (nl === -1 ? "" : caption.slice(nl + 1)).trim();
if (!title) { console.error("❌ caption.txt 第一行（标题）为空。"); process.exit(2); }
if ([...title].length > TITLE_MAX) {
  console.error(`❌ 标题 ${[...title].length} 字，超过小红书上限 ${TITLE_MAX} 字：${title}`);
  process.exit(2);
}
if ([...body].length > BODY_MAX) {
  console.error(`❌ 正文 ${[...body].length} 字，超过小红书上限 ${BODY_MAX} 字。`);
  process.exit(2);
}

console.log(`准备存草稿：${images.length} 张图 | 标题「${title}」| 正文 ${[...body].length} 字`);

// ---------- 执行 ----------
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  userAgent: UA,
  storageState: STATE_FILE,
});
const page = await ctx.newPage();

try {
  await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  if (/\/login/.test(page.url())) {
    const p = await shot(page, "login-expired");
    throw new Error(`登录态已失效，被重定向到登录页。请重新运行 login.mjs。截图: ${p}`);
  }
  await shot(page, "publish-page");

  // 1. 切到"上传图文"标签（发布页默认可能是视频）
  const imageTab = page.locator('text=/上传图文|写长文|图文/').first();
  if (await imageTab.count()) {
    await imageTab.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  // 2. 上传图片（直接投喂 file input，不依赖点击弹系统文件框）
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: "attached", timeout: 20000 });
  await fileInput.setInputFiles(images);
  console.log(`[1/4] 已提交 ${images.length} 张图片，等待上传完成…`);
  await page.waitForTimeout(3000 + images.length * 1500);
  await shot(page, "images-uploaded");

  // 3. 填标题与正文
  const titleInput = page.locator('input[placeholder*="标题"], textarea[placeholder*="标题"]').first();
  await titleInput.waitFor({ state: "visible", timeout: 30000 });
  await titleInput.fill(title);
  await page.waitForTimeout(800);

  // 正文是富文本编辑器（contenteditable），fill() 不适用，用键盘输入
  const bodyEditor = page.locator('div[contenteditable="true"], textarea[placeholder*="正文"], textarea[placeholder*="描述"]').first();
  await bodyEditor.waitFor({ state: "visible", timeout: 20000 });
  await bodyEditor.click();
  await page.waitForTimeout(500);
  for (const line of body.split("\n")) {
    if (line) await page.keyboard.insertText(line);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  console.log(`[2/4] 已填入标题与正文`);
  await page.waitForTimeout(1500);
  const filledShot = await shot(page, "content-filled");

  if (args.dryRun) {
    console.log(`[dry-run] 内容已填好但未保存。请查看截图确认: ${filledShot}`);
    await browser.close();
    process.exit(0);
  }

  // 4. 存草稿 —— 只找"存草稿/暂存"，绝不点"发布"
  const draftBtn = page.locator('button:has-text("存草稿"), button:has-text("暂存离开"), text="存草稿"').first();
  if (!(await draftBtn.count())) {
    const p = await shot(page, "no-draft-button");
    throw new Error(`页面上找不到"存草稿"按钮，已中止（不会改用发布按钮）。请查看截图人工确认: ${p}`);
  }
  await draftBtn.click({ timeout: 15000 });
  await page.waitForTimeout(5000);
  const doneShot = await shot(page, "draft-saved");
  console.log(`[3/4] 已点击"存草稿"`);
  console.log(`[4/4] ✅ 完成。请在小红书 App「草稿箱」或创作后台确认，截图: ${doneShot}`);
} catch (e) {
  await shot(page, "error");
  console.error(`❌ 存草稿失败: ${e.message.split("\n")[0]}\n   截图目录: ${shotDir}`);
  await browser.close();
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
