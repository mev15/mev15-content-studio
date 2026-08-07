/**
 * 纯函数单元测试（不触网）：
 * node --experimental-strip-types --test scripts/publish_draft.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractImageSrcs,
  classifySrc,
  replaceImageSrcs,
  parseEnvFile,
  selectWechatCoverFiles,
  chooseDigest,
} from './publish_draft.ts';

test('extractImageSrcs: 双引号/单引号/属性乱序/大小写/去重', () => {
  const html = `
    <p><img src="https://a.com/1.jpg" alt="x"></p>
    <IMG width="100" SRC='https://a.com/2.png'/>
    <img data-x="1" src="https://a.com/1.jpg">
    <img alt="no src here">
  `;
  assert.deepEqual(extractImageSrcs(html), ['https://a.com/1.jpg', 'https://a.com/2.png']);
});

test('extractImageSrcs: 无图返回空数组', () => {
  assert.deepEqual(extractImageSrcs('<p>hello</p>'), []);
});

test('classifySrc: 图床外链为 external', () => {
  assert.equal(classifySrc('https://img.example-cdn.com/x.jpg'), 'external');
  assert.equal(classifySrc('HTTP://a.com/y.png'), 'external');
});

test('classifySrc: 微信域为 wechat', () => {
  assert.equal(classifySrc('https://mmbiz.qpic.cn/mmbiz_jpg/abc/640'), 'wechat');
  assert.equal(classifySrc('http://sz.qpic.cn/foo.jpg'), 'wechat');
  assert.equal(classifySrc('https://mp.weixin.qq.com/x.png'), 'wechat');
});

test('classifySrc: 伪装域名不算微信域', () => {
  assert.equal(classifySrc('https://evilqpic.cn/x.jpg'), 'external');
  assert.equal(classifySrc('https://qpic.cn.evil.com/x.jpg'), 'external');
});

test('classifySrc: data URI 与相对路径为 skipped', () => {
  assert.equal(classifySrc('data:image/png;base64,iVBOR'), 'skipped');
  assert.equal(classifySrc('./local/img.png'), 'skipped');
  assert.equal(classifySrc('/abs/img.png'), 'skipped');
});

test('replaceImageSrcs: 多次出现全部替换', () => {
  const m = new Map([['https://a.com/1.jpg', 'https://mmbiz.qpic.cn/A']]);
  const out = replaceImageSrcs('<img src="https://a.com/1.jpg"><img src="https://a.com/1.jpg">', m);
  assert.equal(out, '<img src="https://mmbiz.qpic.cn/A"><img src="https://mmbiz.qpic.cn/A">');
});

test('replaceImageSrcs: 前缀重叠时长 URL 优先，互不误伤', () => {
  const m = new Map([
    ['https://a.com/1.jpg', 'https://mmbiz.qpic.cn/SHORT'],
    ['https://a.com/1.jpg?v=2', 'https://mmbiz.qpic.cn/LONG'],
  ]);
  const out = replaceImageSrcs('<img src="https://a.com/1.jpg"><img src="https://a.com/1.jpg?v=2">', m);
  assert.equal(out, '<img src="https://mmbiz.qpic.cn/SHORT"><img src="https://mmbiz.qpic.cn/LONG">');
});

test('replaceImageSrcs: 含 & ? 中文的 URL 精确替换', () => {
  const url = 'https://cdn.x.com/图 片.jpg?a=1&b=2';
  const m = new Map([[url, 'https://mmbiz.qpic.cn/B']]);
  assert.equal(replaceImageSrcs(`<img src="${url}">`, m), '<img src="https://mmbiz.qpic.cn/B">');
});

test('parseEnvFile: 注释/空行/引号/含等号的值/空格', () => {
  const parsed = parseEnvFile('# 注释\n\nA=1\nB="x=y"\nC=\'z\'\n D = spaced \nNOEQ\n=nokey\n');
  assert.deepEqual(parsed, { A: '1', B: 'x=y', C: 'z', D: 'spaced' });
});

test('parseEnvFile: 空文本返回空对象', () => {
  assert.deepEqual(parseEnvFile(''), {});
});

test('chooseDigest: summary 映射到 digest，并兼容旧参数', () => {
  assert.equal(chooseDigest(undefined, '  新摘要  '), '新摘要');
  assert.equal(chooseDigest('旧摘要', undefined), '旧摘要');
  assert.equal(chooseDigest('同一摘要', '同一摘要'), '同一摘要');
  assert.equal(chooseDigest('  ', ''), undefined);
});

test('chooseDigest: 两个参数不一致时拒绝静默覆盖', () => {
  assert.throws(() => chooseDigest('摘要 A', '摘要 B'), /内容不一致/);
});

test('selectWechatCoverFiles: 只选公众号两个成品尺寸', () => {
  assert.deepEqual(selectWechatCoverFiles([
    'cover-master.png',
    'cover-x-source.png',
    'cover-x-article-1920x368.png',
    'cover-zhihu-1380x560.png',
    'cover-wechat-secondary-source.png',
    'cover-wechat-primary-900x383.png',
    'cover-wechat-secondary-500x500.png',
  ]), {
    primary: 'cover-wechat-primary-900x383.png',
    secondary: 'cover-wechat-secondary-500x500.png',
  });
});

test('selectWechatCoverFiles: 任一公众号尺寸缺失则不返回', () => {
  assert.equal(selectWechatCoverFiles([
    'cover-wechat-primary-900x383.png',
    'cover-zhihu-1380x560.png',
  ]), undefined);
});

test('selectWechatCoverFiles: canonical 文件优先于其它公众号候选', () => {
  assert.deepEqual(selectWechatCoverFiles([
    'wechat-primary-alt.png',
    'wechat-secondary-alt.png',
    'cover-wechat-primary-900x383.jpg',
    'cover-wechat-secondary-500x500.jpg',
    'cover-wechat-primary-900x383.png',
    'cover-wechat-secondary-500x500.png',
  ]), {
    primary: 'cover-wechat-primary-900x383.png',
    secondary: 'cover-wechat-secondary-500x500.png',
  });
});
