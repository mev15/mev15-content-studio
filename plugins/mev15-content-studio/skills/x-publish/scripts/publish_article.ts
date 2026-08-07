#!/usr/bin/env -S node --experimental-strip-types
/**
 * x-publish — 把 markdown 原稿转换为 X (Twitter) Articles 草稿。
 * 直连 X 官方 API（POST /2/articles/draft），零 npm 依赖（Node ≥ 22.6，内置 fetch/FormData/Blob）。
 * 只创建草稿，绝不调用 publish。用法见 ../SKILL.md，或运行时不带参数查看 usage。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const API = 'https://api.x.com';
const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const SCOPES = 'tweet.read tweet.write users.read media.write offline.access';
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // X 图片上限 5MB
const IMAGE_EXT_WHITELIST = new Set(['jpg', 'jpeg', 'png', 'webp']); // Articles 拒收 GIF/视频
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'x-publish');
const TOKENS_PATH = join(CONFIG_DIR, 'tokens.json');

// ---------- 类型 ----------

interface StyleRange { offset: number; length: number; style: string }
interface EntityRange { key: number; offset: number; length: number }
interface Block {
  text: string;
  type: string;
  depth?: number;
  inline_style_ranges?: StyleRange[];
  entity_ranges?: EntityRange[];
}
interface Entity { key: string; value: { type: string; mutability: string; data: Record<string, unknown> } }

/** 解析期的中间块：图片在发布期才物化（上传后回填 entity） */
interface PendingImage { src: string; alt: string; blockIndex: number }

interface ContentPlan {
  title: string;
  blocks: Block[];
  entities: Entity[];
  images: PendingImage[];   // blockIndex 指向 blocks 里的 atomic 占位块
  warnings: string[];
}

// ---------- 纯函数（供测试） ----------

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[line.slice(0, eq).trim()] = val;
  }
  return out;
}

interface InlineResult { text: string; styles: StyleRange[]; links: { offset: number; length: number; url: string }[] }

/** 行内 markdown → 纯文本 + 样式区间 + 链接区间（offset 为 JS string index，与 DraftJS 的 UTF-16 口径一致） */
export function parseInline(src: string): InlineResult {
  const out: InlineResult = { text: '', styles: [], links: [] };
  // 按出现位置取最早的 token；同位置按数组顺序（code 最优先，避免代码里的 * 被解析）
  const patterns: { re: RegExp; kind: 'code' | 'bold' | 'strike' | 'link' | 'img' | 'italic' }[] = [
    { re: /`([^`]+)`/, kind: 'code' },
    { re: /\*\*((?:[^*]|\*(?!\*))+)\*\*/, kind: 'bold' },
    { re: /~~([^~]+)~~/, kind: 'strike' },
    { re: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, kind: 'img' },
    { re: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/, kind: 'link' },
    { re: /\*([^*\s](?:[^*]*[^*\s])?)\*/, kind: 'italic' },
  ];
  let rest = src;
  while (rest.length > 0) {
    let best: { m: RegExpExecArray; kind: string } | null = null;
    for (const { re, kind } of patterns) {
      const m = re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) best = { m, kind };
    }
    if (!best) { out.text += rest; break; }
    out.text += rest.slice(0, best.m.index);
    const start = out.text.length;
    if (best.kind === 'code') {
      out.text += best.m[1]; // 行内代码：X 无 code 样式，保留原文本
    } else if (best.kind === 'img') {
      out.text += best.m[1] || '[图片]'; // 行内图片降级为 alt 文本（独立成行的图片才会上传）
    } else if (best.kind === 'link') {
      const inner = parseInline(best.m[1]);
      out.text += inner.text;
      for (const s of inner.styles) out.styles.push({ ...s, offset: s.offset + start });
      out.links.push({ offset: start, length: inner.text.length, url: best.m[2] });
    } else {
      const inner = parseInline(best.m[1]);
      out.text += inner.text;
      for (const s of inner.styles) out.styles.push({ ...s, offset: s.offset + start });
      for (const l of inner.links) out.links.push({ ...l, offset: l.offset + start });
      const style = best.kind === 'bold' ? 'bold' : best.kind === 'strike' ? 'strikethrough' : 'italic';
      out.styles.push({ offset: start, length: inner.text.length, style });
    }
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

/** 从 markdown 提取标题：第一个 H1（并从正文移除），否则第一个非空行截断 */
export function extractTitle(md: string): { title: string; body: string } {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s) continue;
    if (/^#\s+/.test(s)) {
      lines.splice(i, 1);
      return { title: s.replace(/^#\s+/, '').trim(), body: lines.join('\n') };
    }
    return { title: parseInline(s).text.slice(0, 100), body: md };
  }
  return { title: 'Untitled', body: md };
}

/** 去掉 YAML frontmatter */
export function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  return md.slice(md.indexOf('\n', end + 1) + 1);
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');
}

function splitTableRow(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** 把文本块加入 blocks（带行内解析）；linkEntity 回调用于分配 entity key */
function pushTextBlock(plan: ContentPlan, type: string, raw: string, depth?: number): void {
  const { text, styles, links } = parseInline(raw);
  const block: Block = { text, type };
  if (depth) block.depth = depth;
  if (styles.length) block.inline_style_ranges = styles;
  if (links.length) {
    block.entity_ranges = links.map((l) => {
      const key = plan.entities.length;
      plan.entities.push({ key: String(key), value: { type: 'link', mutability: 'mutable', data: { url: l.url } } });
      return { key, offset: l.offset, length: l.length };
    });
  }
  plan.blocks.push(block);
}

/** 表格 → 无序列表：第一行视为表头、第一列视为行主键 */
function pushTable(plan: ContentPlan, rows: string[][]): void {
  if (rows.length < 2) return;
  const header = rows[0];
  if (header.length > 3) plan.warnings.push(`表格有 ${header.length} 列，转列表后较长，建议改写或链接 Dune`);
  for (const row of rows.slice(1)) {
    const label = row[0] ?? '';
    const detail = header.length <= 2
      ? (row[1] ?? '')
      : row.slice(1).map((c, i) => `${header[i + 1]}: ${c}`).join('；');
    const text = `${label} — ${detail}`;
    const block: Block = { text, type: 'unordered-list-item' };
    if (label) block.inline_style_ranges = [{ offset: 0, length: label.length, style: 'bold' }];
    plan.blocks.push(block);
  }
}

/** 代码块 → 整块 blockquote（X 无代码块类型；块内保留换行） */
function pushCodeBlock(plan: ContentPlan, code: string): void {
  plan.blocks.push({ text: code.replace(/\n+$/, ''), type: 'blockquote' });
}

/** markdown 正文 → 内容计划（图片留占位，发布期物化） */
export function mdToPlan(md: string, opts: { title?: string } = {}): ContentPlan {
  const stripped = stripFrontmatter(md);
  const { title: extracted, body } = extractTitle(stripped);
  const plan: ContentPlan = { title: opts.title ?? extracted, blocks: [], entities: [], images: [], warnings: [] };

  const lines = body.split('\n');
  let para: string[] = [];
  let quote: string[] = [];
  let table: string[][] = [];
  let inCode = false; let codeLines: string[] = [];

  const flushPara = () => {
    if (para.length) { pushTextBlock(plan, 'unstyled', para.join(' ')); para = []; }
  };
  const flushQuote = () => {
    if (quote.length) { pushTextBlock(plan, 'blockquote', quote.join(' ')); quote = []; }
  };
  const flushTable = () => {
    if (table.length) { pushTable(plan, table); table = []; }
  };
  const flushAll = () => { flushPara(); flushQuote(); flushTable(); };

  for (const line of lines) {
    const s = line.trim();

    if (inCode) {
      if (s.startsWith('```')) { inCode = false; pushCodeBlock(plan, codeLines.join('\n')); codeLines = []; }
      else codeLines.push(line);
      continue;
    }
    if (s.startsWith('```')) { flushAll(); inCode = true; continue; }

    if (!s) { flushAll(); continue; }

    // 表格行
    if (s.startsWith('|') || (table.length > 0 && s.includes('|'))) {
      if (table.length === 1 && isTableSeparator(s)) continue; // 表头分隔行
      flushPara(); flushQuote();
      table.push(splitTableRow(s));
      continue;
    }
    flushTable();

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(s);
    if (h) {
      flushAll();
      const level = h[1].length;
      if (level === 1) pushTextBlock(plan, 'header-one', h[2]);
      else if (level === 2) pushTextBlock(plan, 'header-two', h[2]);
      else if (level === 3) pushTextBlock(plan, 'header-three', h[2]);
      else {
        // X 无 H4-H6：降级为整段粗体
        const { text } = parseInline(h[2]);
        plan.blocks.push({ text, type: 'unstyled', inline_style_ranges: [{ offset: 0, length: text.length, style: 'bold' }] });
      }
      continue;
    }

    // 分割线：X API 未提供 divider block，跳过
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) { flushAll(); plan.warnings.push('分割线（---）无 API 对应元素，已跳过'); continue; }

    // 引用
    const q = /^>\s?(.*)$/.exec(s);
    if (q) { flushPara(); flushTable(); if (q[1]) quote.push(q[1]); continue; }
    flushQuote();

    // 独立成行的图片 → atomic 占位块
    const img = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(s);
    if (img) {
      flushAll();
      plan.images.push({ src: img[2], alt: img[1], blockIndex: plan.blocks.length });
      plan.blocks.push({ text: ' ', type: 'atomic' }); // entity_ranges 由 finalizeImages 回填
      continue;
    }

    // 列表项（缩进 → depth，上限 2）
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushAll();
      const depth = Math.min(2, Math.floor(li[1].length / 2));
      const type = /^\d/.test(li[2]) ? 'ordered-list-item' : 'unordered-list-item';
      pushTextBlock(plan, type, li[3], depth);
      continue;
    }

    para.push(s);
  }
  if (inCode && codeLines.length) { pushCodeBlock(plan, codeLines.join('\n')); }
  flushAll();
  return plan;
}

// ---------- 凭据与 OAuth ----------

async function loadConfig(): Promise<Record<string, string>> {
  let fileConf: Record<string, string> = {};
  try { fileConf = parseEnvFile(await readFile(join(CONFIG_DIR, 'env'), 'utf8')); } catch { /* 允许纯环境变量 */ }
  const conf = { ...fileConf };
  for (const k of ['X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_REDIRECT_URI']) {
    if (process.env[k]) conf[k] = process.env[k] as string;
  }
  return conf;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface Tokens { access_token: string; refresh_token?: string; expires_at: number }

async function saveTokens(t: Tokens): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(TOKENS_PATH, JSON.stringify(t, null, 2) + '\n', { mode: 0o600 });
}

function tokenAuthHeaders(conf: Record<string, string>): Record<string, string> {
  // confidential client 用 Basic auth；public client 只在 body 里带 client_id
  if (conf.X_CLIENT_SECRET) {
    return { Authorization: `Basic ${Buffer.from(`${conf.X_CLIENT_ID}:${conf.X_CLIENT_SECRET}`).toString('base64')}` };
  }
  return {};
}

async function tokenRequest(conf: Record<string, string>, params: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ ...params, client_id: conf.X_CLIENT_ID });
  const res = await fetch(`${API}/2/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...tokenAuthHeaders(conf) },
    body,
  });
  const json = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`token 请求失败（HTTP ${res.status}）：${json.error ?? ''} ${json.error_description ?? JSON.stringify(json)}`);
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: Date.now() + (json.expires_in ?? 7200) * 1000 };
}

async function login(conf: Record<string, string>): Promise<void> {
  if (!conf.X_CLIENT_ID) throw new Error('缺少 X_CLIENT_ID：先复制 env.example 到 ~/.config/x-publish/env 并填写');
  if (!conf.X_REDIRECT_URI) throw new Error('缺少 X_REDIRECT_URI：需与 X 开发者后台 App 的 Callback URL 完全一致');
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const url = `${AUTHORIZE_URL}?${new URLSearchParams({
    response_type: 'code', client_id: conf.X_CLIENT_ID, redirect_uri: conf.X_REDIRECT_URI,
    scope: SCOPES, state, code_challenge: challenge, code_challenge_method: 'S256',
  })}`;
  console.log('\n1. 在任意浏览器打开以下 URL 并授权（授权账号需 X Premium）：\n');
  console.log(url);
  console.log('\n2. 授权后浏览器会跳转到回调地址（本地打不开是正常的）。');
  console.log('   ⚠️ 授权码 30 秒过期：跳转后立刻复制地址栏完整 URL 粘贴到这里。\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('粘贴跳转后的完整 URL（或仅 code 值）> ')).trim();
  rl.close();
  let code = answer;
  if (answer.includes('://') || answer.includes('?')) {
    const u = new URL(answer.includes('://') ? answer : `http://x/?${answer.split('?').pop()}`);
    const gotState = u.searchParams.get('state');
    if (gotState && gotState !== state) throw new Error('state 不匹配，可能粘贴了旧的授权跳转 URL，请重新 --login');
    code = u.searchParams.get('code') ?? '';
  }
  if (!code) throw new Error('未能从输入中解析出授权 code');
  const tokens = await tokenRequest(conf, { grant_type: 'authorization_code', code, redirect_uri: conf.X_REDIRECT_URI, code_verifier: verifier });
  if (!tokens.refresh_token) console.warn('⚠️ 未返回 refresh_token（offline.access 未生效？）：access token 2 小时后需重新 --login');
  await saveTokens(tokens);
  console.log(`\n✅ 授权成功，token 已保存到 ${TOKENS_PATH}`);
}

async function ensureAccessToken(conf: Record<string, string>): Promise<string> {
  let tokens: Tokens;
  try { tokens = JSON.parse(await readFile(TOKENS_PATH, 'utf8')) as Tokens; }
  catch { throw new Error(`未找到 ${TOKENS_PATH}：先运行 --login 完成一次授权`); }
  if (Date.now() < tokens.expires_at - 60_000) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error('access token 已过期且无 refresh token：重新运行 --login');
  const next = await tokenRequest(conf, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  // X 的 refresh token 会轮换：必须立刻把新的写回，旧的已作废
  if (!next.refresh_token) next.refresh_token = tokens.refresh_token;
  await saveTokens(next);
  return next.access_token;
}

// ---------- X API ----------

async function apiError(res: Response): Promise<never> {
  const body = await res.text();
  const hints: Record<number, string> = {
    401: 'token 无效或过期——重新 --login；或 App 的 scope 缺失（需重新授权）',
    402: '开发者账户 credits 不足——到 console.x.com 给按量计费账户绑定付款方式并充值 credits',
    403: '权限不足——确认授权账号已开通 X Premium（Articles 前置条件），以及开发者 App 已挂到有效的付费/按量计费项目',
    429: '触发限流——稍后重试',
    503: 'X 服务端错误——若请求带了封面（cover_media），可去掉封面重试（社区反馈该字段偶发 503），草稿建好后在网页编辑器里补封面',
  };
  throw new Error(`X API HTTP ${res.status}${hints[res.status] ? `（${hints[res.status]}）` : ''}\n${body.slice(0, 2000)}`);
}

async function uploadImage(token: string, bytes: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('media', new Blob([new Uint8Array(bytes)]), filename);
  form.append('media_category', 'tweet_image');
  const res = await fetch(`${API}/2/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) await apiError(res);
  const json = await res.json() as { data?: { id?: string } };
  if (!json.data?.id) throw new Error(`media/upload 未返回 media id：${JSON.stringify(json).slice(0, 500)}`);
  return json.data.id;
}

/** 读取本地图片或下载外链图片，校验格式与大小；不合规返回 null（调用方警告并跳过） */
async function fetchImageBytes(src: string, mdDir: string): Promise<{ bytes: Buffer; filename: string } | null> {
  let bytes: Buffer; let filename: string;
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) return null;
    bytes = Buffer.from(await res.arrayBuffer());
    filename = basename(new URL(src).pathname) || 'image';
  } else if (src.startsWith('data:')) {
    return null;
  } else {
    const p = isAbsolute(src) ? src : join(mdDir, src);
    try { bytes = await readFile(p); } catch { return null; }
    filename = basename(p);
  }
  const ext = extname(filename).slice(1).toLowerCase();
  if (!IMAGE_EXT_WHITELIST.has(ext)) return null;
  if (bytes.length > IMAGE_MAX_BYTES) return null;
  return { bytes, filename };
}

/** 上传全部正文图片，把占位 atomic 块物化为 image entity；失败的图片块降级为警告并移除 */
async function finalizeImages(plan: ContentPlan, token: string, mdDir: string): Promise<void> {
  const dead: number[] = [];
  for (const img of plan.images) {
    const got = await fetchImageBytes(img.src, mdDir);
    if (!got) {
      plan.warnings.push(`图片跳过（仅支持 jpg/png/webp、≤5MB、可读取）：${img.src}`);
      dead.push(img.blockIndex);
      continue;
    }
    const mediaId = await uploadImage(token, got.bytes, got.filename);
    const key = plan.entities.length;
    const data: Record<string, unknown> = { media_items: [{ media_category: 'tweet_image', media_id: mediaId }] };
    if (img.alt) data.caption = img.alt;
    plan.entities.push({ key: String(key), value: { type: 'image', mutability: 'immutable', data } });
    plan.blocks[img.blockIndex].entity_ranges = [{ key, offset: 0, length: 1 }];
    console.log(`  ✅ 图片已上传：${img.src} → media_id ${mediaId}`);
  }
  // 从后往前删除失败的占位块，并同步修正其余占位的 blockIndex
  for (const idx of dead.sort((a, b) => b - a)) {
    plan.blocks.splice(idx, 1);
    for (const i of plan.images) if (i.blockIndex > idx) i.blockIndex--;
  }
}

async function createDraft(token: string, plan: ContentPlan, coverMediaId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    title: plan.title,
    content_state: { blocks: plan.blocks, entities: plan.entities },
  };
  if (coverMediaId) body.cover_media = { media_id: coverMediaId, media_category: 'tweet_image' };
  const res = await fetch(`${API}/2/articles/draft`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await apiError(res);
  const json = await res.json() as { data?: { id?: string } };
  if (!json.data?.id) throw new Error(`draft 未返回 id：${JSON.stringify(json).slice(0, 500)}`);
  return json.data.id;
}

// ---------- main ----------

function usage(): void {
  console.log(`用法：
  首次授权：  publish_article.ts --login   （交互式：需在真实终端运行，中途粘贴回调 URL）
  发布草稿：  publish_article.ts --md 文章.md [--cover 封面.jpg] [--title "标题"] [--dry-run]

参数：
  --md         markdown 原稿路径（必填；标题默认取第一个 H1）
  --cover      封面图（jpg/png/webp，≤5MB；可选，也可事后在网页编辑器补）
  --title      覆盖标题（默认取 md 的 H1）
  --dry-run    只打印转换计划与 content_state JSON，不调任何 API
  --login      运行一次 OAuth 2.0 PKCE 交互式授权（凭据配置见 ../env.example）`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      md: { type: 'string' }, cover: { type: 'string' }, title: { type: 'string' },
      'dry-run': { type: 'boolean' }, login: { type: 'boolean' },
    },
  });
  const conf = await loadConfig();
  if (values.login) { await login(conf); return; }
  if (!values.md) { usage(); process.exit(values.md === undefined ? 1 : 0); }

  const mdPath = resolve(values.md as string);
  const md = await readFile(mdPath, 'utf8');
  const plan = mdToPlan(md, { title: values.title });

  const stats = new Map<string, number>();
  for (const b of plan.blocks) stats.set(b.type, (stats.get(b.type) ?? 0) + 1);
  console.log(`标题：${plan.title}`);
  console.log(`块统计：${[...stats.entries()].map(([t, n]) => `${t}×${n}`).join('，')}`);
  console.log(`图片：${plan.images.length} 张`);

  if (values['dry-run']) {
    if (plan.images.length) console.log('\n将上传的图片：\n' + plan.images.map((i) => `  - ${i.src}`).join('\n'));
    if (values.cover) console.log(`\n封面：${values.cover}`);
    for (const w of plan.warnings) console.warn(`⚠️ ${w}`);
    console.log('\ncontent_state（供核对）：');
    console.log(JSON.stringify({ title: plan.title, content_state: { blocks: plan.blocks, entities: plan.entities } }, null, 2));
    console.log('\n（dry-run：未调用任何 API）');
    return;
  }

  if (!conf.X_CLIENT_ID) throw new Error('缺少 X_CLIENT_ID：先配置 ~/.config/x-publish/env 并 --login');
  const token = await ensureAccessToken(conf);

  await finalizeImages(plan, token, dirname(mdPath));

  let coverMediaId: string | undefined;
  if (values.cover) {
    const got = await fetchImageBytes(values.cover as string, process.cwd());
    if (!got) throw new Error(`封面不可用（仅 jpg/png/webp、≤5MB）：${values.cover}`);
    coverMediaId = await uploadImage(token, got.bytes, got.filename);
    console.log(`  ✅ 封面已上传 → media_id ${coverMediaId}`);
  }

  const draftId = await createDraft(token, plan, coverMediaId);
  for (const w of plan.warnings) console.warn(`⚠️ ${w}`);
  console.log(`\n✅ 草稿已创建：article id ${draftId}`);
  console.log('   到 x.com（桌面网页版）→ 发帖框 → Articles 草稿里查看与编辑；本工具不做正式发布。');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => { console.error(`❌ ${e instanceof Error ? e.message : e}`); process.exit(1); });
}
