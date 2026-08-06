#!/usr/bin/env -S node --experimental-strip-types
/**
 * gzh-publish — 把排版好的公众号 HTML + 封面图发布到微信公众号草稿箱。
 * 直连微信官方 API，零 npm 依赖（Node ≥ 22.6，内置 fetch/FormData/Blob）。
 * 用法见 ../SKILL.md，或运行时不带参数查看 usage。
 */
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const API = 'https://api.weixin.qq.com';
const UPLOADIMG_MAX_BYTES = 1024 * 1024; // uploadimg 接口限制：jpg/png ≤ 1MB
// 凭据与默认配置所在目录：skill 本体无状态，账号状态集中在这里
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'gzh-publish');

// ---------- 纯函数（供测试） ----------

const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;

export function extractImageSrcs(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(IMG_SRC_RE)) out.push((m[1] ?? m[2]) as string);
  return [...new Set(out)];
}

export type SrcKind = 'external' | 'wechat' | 'skipped';

export function classifySrc(src: string): SrcKind {
  if (!/^https?:\/\//i.test(src)) return 'skipped'; // data: URI、相对/本地路径
  return /^https?:\/\/([^/]+\.)?(qpic\.cn|weixin\.qq\.com)\//i.test(src) ? 'wechat' : 'external';
}

export function replaceImageSrcs(html: string, mapping: Map<string, string>): string {
  // 长 URL 优先替换，避免一个 URL 是另一个 URL 前缀时误伤
  const entries = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = html;
  for (const [from, to] of entries) out = out.split(from).join(to);
  return out;
}

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

// ---------- 微信 API ----------

const ERR_HINTS: Record<number, string> = {
  40164: '调用方 IP 不在白名单（公众号后台 → 设置与开发 → 基本配置 → IP白名单）',
  40001: 'AppSecret 错误或 access_token 已失效',
  40013: 'AppID 无效',
  45009: '接口调用超过频率限制，稍后重试',
  48001: '接口权限不足（确认公众号类型/认证状态是否开放该 API）',
};

interface WxResp {
  errcode?: number;
  errmsg?: string;
  [k: string]: unknown;
}

function checkWx(json: WxResp, ctx: string): WxResp {
  if (json.errcode && json.errcode !== 0) {
    const hint = ERR_HINTS[json.errcode] ? `\n  提示: ${ERR_HINTS[json.errcode]}` : '';
    throw new Error(`${ctx}失败: errcode=${json.errcode} errmsg=${json.errmsg}${hint}`);
  }
  return json;
}

async function getStableToken(appid: string, secret: string): Promise<string> {
  const res = await fetch(`${API}/cgi-bin/stable_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credential', appid, secret, force_refresh: false }),
  });
  const json = checkWx((await res.json()) as WxResp, '获取 access_token ');
  if (typeof json.access_token !== 'string') throw new Error('stable_token 响应中无 access_token');
  return json.access_token;
}

async function wxUploadFile(endpoint: string, token: string, buf: Uint8Array, filename: string, mime: string): Promise<WxResp> {
  const fd = new FormData();
  fd.append('media', new Blob([buf], { type: mime }), filename);
  const res = await fetch(`${API}${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${token}`, {
    method: 'POST',
    body: fd,
  });
  return (await res.json()) as WxResp;
}

const MIME_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png' };

async function downloadImage(url: string): Promise<{ buf: Uint8Array; mime: string; filename: string }> {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; gzh-publish)' } });
  if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}: ${url}`);
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const buf = new Uint8Array(await res.arrayBuffer());
  let filename = basename(new URL(url).pathname) || 'image';
  if (!/\.(jpe?g|png)$/i.test(filename)) filename += MIME_EXT[mime] ?? '';
  return { buf, mime, filename };
}

/** 正文图：uploadimg 换取微信 CDN URL，不占素材库配额 */
async function uploadContentImage(token: string, buf: Uint8Array, filename: string, mime: string): Promise<string> {
  const json = checkWx(await wxUploadFile('/cgi-bin/media/uploadimg', token, buf, filename, mime), `上传正文图 ${filename} `);
  if (typeof json.url !== 'string') throw new Error(`uploadimg 响应中无 url（${filename}）`);
  return json.url;
}

/** 封面：add_material 永久素材，换取 thumb_media_id */
async function uploadCoverMaterial(token: string, coverPath: string): Promise<string> {
  const buf = await readFile(coverPath);
  const ext = coverPath.toLowerCase().match(/\.(jpe?g|png)$/)?.[1];
  if (!ext) throw new Error(`封面仅支持 jpg/png: ${coverPath}`);
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const json = checkWx(
    await wxUploadFile('/cgi-bin/material/add_material?type=image', token, new Uint8Array(buf), basename(coverPath), mime),
    '上传封面 ',
  );
  if (typeof json.media_id !== 'string') throw new Error('add_material 响应中无 media_id');
  return json.media_id;
}

interface DraftArticle {
  title: string;
  content: string;
  thumb_media_id: string;
  author?: string;
  digest?: string;
  content_source_url?: string;
}

async function createDraft(token: string, article: DraftArticle): Promise<string> {
  const res = await fetch(`${API}/cgi-bin/draft/add?access_token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ articles: [article] }),
  });
  const json = checkWx((await res.json()) as WxResp, '创建草稿 ');
  if (typeof json.media_id !== 'string') throw new Error('draft/add 响应中无 media_id');
  return json.media_id;
}

// ---------- CLI ----------

const USAGE = `用法:
  node --experimental-strip-types publish_draft.ts \\
    --html <排版产物.html> --cover <封面.jpg> --title <标题> \\
    [--author 作者] [--digest 摘要] [--source-url URL] \\
    [--append-html 尾部片段.html] [--dry-run]

凭据从进程环境变量或 ~/.config/gzh-publish/env 读取（前者优先；dry-run 不需要）。详见 SKILL.md。`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      html: { type: 'string' },
      cover: { type: 'string' },
      title: { type: 'string' },
      author: { type: 'string' },
      digest: { type: 'string' },
      'source-url': { type: 'string' },
      'append-html': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.html || !values.cover || !values.title) {
    console.error(USAGE);
    process.exit(1);
  }

  // 配置优先级：进程环境变量 > ~/.config/gzh-publish/env（文件不存在则忽略）
  let fileEnv: Record<string, string> = {};
  try {
    fileEnv = parseEnvFile(await readFile(join(CONFIG_DIR, 'env'), 'utf8'));
  } catch {}
  const cfg = (k: string): string | undefined => process.env[k] ?? fileEnv[k];

  let html = await readFile(values.html, 'utf8');
  // 尾部追加片段（如公众号名片）：CLI 参数优先（相对 cwd），其次配置（相对路径相对配置目录）
  let appendPath = values['append-html'] ?? cfg('GZH_APPEND_HTML');
  if (appendPath && !values['append-html'] && !isAbsolute(appendPath)) appendPath = join(CONFIG_DIR, appendPath);
  if (appendPath) {
    html += '\n' + (await readFile(appendPath, 'utf8'));
    console.log(`尾部追加: ${appendPath}`);
  }
  if (/<!doctype\s|<html[\s>]/i.test(html)) {
    console.warn('⚠ 输入疑似完整 HTML 文档（含 <html>/<!doctype>）。草稿 content 应为正文片段；若这是 preview 包裹文件，请改用排版产物片段。');
  }
  await readFile(values.cover); // 提前验证封面可读

  const srcs = extractImageSrcs(html);
  const external = srcs.filter((s) => classifySrc(s) === 'external');
  const wechat = srcs.filter((s) => classifySrc(s) === 'wechat');
  const skipped = srcs.filter((s) => classifySrc(s) === 'skipped');

  console.log(`图片扫描: ${srcs.length} 张去重后 — 待上传外链 ${external.length}，已是微信域 ${wechat.length}，跳过 ${skipped.length}`);
  for (const s of skipped) console.warn(`  ⚠ 跳过（非外链，请先传图床）: ${s.slice(0, 100)}`);

  if (values['dry-run']) {
    for (const s of external) console.log(`  → 将上传: ${s}`);
    console.log(`封面: ${values.cover}\n标题: ${values.title}\n[dry-run] 未调用任何微信 API。`);
    return;
  }

  const appid = cfg('WECHAT_APP_ID');
  const secret = cfg('WECHAT_APP_SECRET');
  if (!appid || !secret) throw new Error(`缺少 WECHAT_APP_ID / WECHAT_APP_SECRET（进程环境变量或 ${join(CONFIG_DIR, 'env')}）`);

  const token = await getStableToken(appid, secret);

  const mapping = new Map<string, string>();
  const unresolved: string[] = [];
  for (const src of external) {
    const { buf, mime, filename } = await downloadImage(src);
    if (!MIME_EXT[mime]) {
      console.warn(`  ⚠ 非 jpg/png（${mime || '未知类型'}），保留原链接（微信端会过滤，需手工处理）: ${src}`);
      unresolved.push(src);
      continue;
    }
    if (buf.length > UPLOADIMG_MAX_BYTES) {
      console.warn(`  ⚠ 超过 1MB（${(buf.length / 1024).toFixed(0)}KB），uploadimg 可能拒绝: ${src}`);
    }
    const wxUrl = await uploadContentImage(token, buf, filename, mime);
    mapping.set(src, wxUrl);
    console.log(`  ✓ ${src} → ${wxUrl}`);
  }

  const content = replaceImageSrcs(html, mapping);
  const thumbMediaId = await uploadCoverMaterial(token, values.cover);
  console.log(`  ✓ 封面永久素材 media_id: ${thumbMediaId}`);

  const draftId = await createDraft(token, {
    title: values.title,
    content,
    thumb_media_id: thumbMediaId,
    ...(values.author ? { author: values.author } : {}),
    ...(values.digest ? { digest: values.digest } : {}),
    ...(values['source-url'] ? { content_source_url: values['source-url'] } : {}),
  });

  console.log(JSON.stringify({
    draft_media_id: draftId,
    cover_media_id: thumbMediaId,
    images_uploaded: Object.fromEntries(mapping),
    images_unresolved: unresolved,
  }, null, 2));
  console.log('✅ 草稿已创建，请到公众号后台草稿箱确认。');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e: unknown) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  });
}
