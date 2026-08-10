#!/usr/bin/env node
/**
 * 小红书创作平台短信登录 → 持久化登录态
 *
 * 用法:
 *   node login.mjs --phone 13800138000              # 发送验证码后等待
 *   node login.mjs --phone 13800138000 --code 123456 # 已有验证码，一步完成（不推荐，验证码有效期短）
 *   node login.mjs --check                          # 仅检查现有登录态是否有效
 *
 * 交互模型（无需看到浏览器界面）:
 *   1. 本脚本填手机号、点"发送验证码"，然后轮询等待验证码文件
 *   2. 用户收到短信后，把验证码写入 <state目录>/code.txt（或让 Claude 代写）
 *   3. 脚本读到验证码后提交，成功则保存 storageState
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync, unlinkSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";

const SKILL_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");
const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const STATE_DIR = resolve(process.env.XHS_STATE_DIR || join(CONFIG_HOME, "xhs-draft-publish"));
const STATE_FILE = join(STATE_DIR, "storage-state.json");
const CODE_FILE = join(STATE_DIR, "code.txt");
const SHOT_DIR = join(STATE_DIR, "shots");

const LOGIN_URL = "https://creator.xiaohongshu.com/login";
const HOME_URL = "https://creator.xiaohongshu.com/creator/home";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CONTEXT_OPTS = {
  viewport: { width: 1440, height: 900 },
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  userAgent: UA,
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") args.check = true;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const p = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p }).catch(() => {});
  return p;
}

/** 登录态判定：访问创作首页，未被弹回 /login 即视为有效 */
async function isLoggedIn(page) {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);
  return !/\/login/.test(page.url());
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
chmodSync(STATE_DIR, 0o700);

// ---------- --check ----------
if (args.check) {
  if (!existsSync(STATE_FILE)) {
    console.log(JSON.stringify({ ok: false, loggedIn: false, reason: "尚未登录：找不到 storage-state.json" }));
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ ...CONTEXT_OPTS, storageState: STATE_FILE });
  const page = await ctx.newPage();
  let loggedIn = false;
  try { loggedIn = await isLoggedIn(page); } catch (e) { console.error("检查失败:", e.message.split("\n")[0]); }
  const shotPath = await shot(page, "check");
  await browser.close();
  console.log(JSON.stringify({ ok: loggedIn, loggedIn, screenshot: shotPath,
    reason: loggedIn ? "登录态有效" : "登录态已失效，需要重新短信登录" }));
  process.exit(loggedIn ? 0 : 1);
}

// ---------- 短信登录 ----------
const phone = String(args.phone || "").trim();
if (!/^\d{11}$/.test(phone)) {
  console.error("用法: node login.mjs --phone <11位手机号> [--code 验证码]\n      node login.mjs --check");
  process.exit(2);
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext(CONTEXT_OPTS);
const page = await ctx.newPage();

try {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // 1. 填手机号
  const phoneInput = page.locator('input[placeholder*="手机号"]').first();
  await phoneInput.waitFor({ state: "visible", timeout: 20000 });
  await phoneInput.fill(phone);

  // 2. 勾选用户协议（未勾选会拦住登录按钮）
  const agree = page.locator('label:has-text("登录即同意") input[type="checkbox"], input[type="checkbox"]').first();
  if (await agree.count()) {
    const checked = await agree.isChecked().catch(() => false);
    if (!checked) await agree.check({ force: true }).catch(() => {});
  }

  // 3. 点"发送验证码"
  const sendBtn = page.locator('text="发送验证码"').first();
  await sendBtn.click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const sentShot = await shot(page, "01-code-sent");
  console.log(`[1/3] 已请求发送验证码到 ${phone.slice(0, 3)}****${phone.slice(-4)}（截图: ${sentShot}）`);

  // 4. 取验证码：命令行直接给，或轮询等待写入 code.txt
  let code = String(args.code || "").trim();
  if (!code) {
    if (existsSync(CODE_FILE)) unlinkSync(CODE_FILE);  // 清掉上次残留，避免读到旧码
    console.log(`[2/3] 等待验证码…请把收到的验证码写入: ${CODE_FILE}`);
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      if (existsSync(CODE_FILE)) {
        const v = readFileSync(CODE_FILE, "utf-8").trim();
        if (/^\d{4,8}$/.test(v)) { code = v; break; }
      }
      await sleep(2000);
    }
    if (existsSync(CODE_FILE)) unlinkSync(CODE_FILE);
    if (!code) throw new Error("等待验证码超时（5 分钟），请重新运行登录流程。");
  }

  // 5. 提交
  const codeInput = page.locator('input[placeholder*="验证码"]').first();
  await codeInput.fill(code);
  await page.getByRole("button", { name: /登\s*录/ }).click({ timeout: 15000 });
  await page.waitForTimeout(2500);

  // 某些账号/环境会在短信验证后追加 App 扫码验证。保留当前页面等待扫码，
  // 不要提前跳转到 HOME_URL，否则会使二维码立刻失效。
  const scanTitle = page.getByText("扫码验证", { exact: true });
  if (await scanTitle.isVisible().catch(() => false)) {
    const qrShot = await shot(page, "02-qr-verification");
    console.log(`[2.5/3] 需要用已登录该账号的小红书 App 扫码验证（二维码约 1 分钟有效）: ${qrShot}`);
    const scanDeadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < scanDeadline && /\/login/.test(page.url())) {
      await sleep(1500);
    }
    if (/\/login/.test(page.url())) {
      throw new Error(`等待 App 扫码验证超时，请重新运行登录流程。二维码截图: ${qrShot}`);
    }
  }

  await page.waitForTimeout(3000);
  await shot(page, "02-submitted");

  // 6. 校验并保存
  const loggedIn = /\/login/.test(page.url()) ? await isLoggedIn(page) : true;
  const finalShot = await shot(page, "03-result");
  if (!loggedIn) {
    throw new Error(`登录未成功（可能验证码错误/过期，或触发了二次验证）。请查看截图: ${finalShot}`);
  }
  await ctx.storageState({ path: STATE_FILE });
  chmodSync(STATE_FILE, 0o600);
  console.log(`[3/3] ✅ 登录成功，登录态已保存: ${STATE_FILE}（权限 600）`);
} catch (e) {
  const p = await shot(page, "99-error");
  console.error(`❌ 登录失败: ${e.message.split("\n")[0]}\n   截图: ${p}`);
  await browser.close();
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
