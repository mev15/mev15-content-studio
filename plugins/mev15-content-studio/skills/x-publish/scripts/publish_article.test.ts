import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPromoText, mdToPlan, normalizeRemoteImageFilename, parseInline, xPromoPath } from './publish_article.ts';

test('==highlight== is stripped and converted to bold', () => {
  const got = parseInline('使用 ==Paseo== 继续开发');
  assert.equal(got.text, '使用 Paseo 继续开发');
  assert.deepEqual(got.styles, [{ offset: 3, length: 5, style: 'bold' }]);
});

test('fenced code becomes a native markdown atomic entity', () => {
  const plan = mdToPlan('# 标题\n\n```bash\ncurl https://example.com | sh\n```');
  assert.deepEqual(plan.blocks, [{
    text: ' ',
    type: 'atomic',
    entity_ranges: [{ key: 0, offset: 0, length: 1 }],
  }]);
  assert.deepEqual(plan.entities, [{
    key: '0',
    value: {
      type: 'markdown',
      mutability: 'mutable',
      data: { markdown: '```bash\ncurl https://example.com | sh\n```' },
    },
  }]);
});

test('adjacent physical text lines remain separate blocks', () => {
  const plan = mdToPlan('# 标题\n\n注册：使用 gmail 登录。\n支付：使用 Bybit 卡。\n总体来说，没有额外成本。');
  assert.deepEqual(plan.blocks.map(({ text, type }) => ({ text, type })), [
    { text: '注册：使用 gmail 登录。', type: 'unstyled' },
    { text: '支付：使用 Bybit 卡。', type: 'unstyled' },
    { text: '总体来说，没有额外成本。', type: 'unstyled' },
  ]);
});

test('H3 and deeper headings become bold unstyled blocks while H2 stays native', () => {
  const plan = mdToPlan([
    '# 标题',
    '',
    '## 二级标题',
    '',
    '### 三级 *斜体* [链接](https://example.com)',
    '',
    '#### 四级标题',
  ].join('\n'));

  assert.deepEqual(plan.blocks, [
    { text: '二级标题', type: 'header-two' },
    {
      text: '三级 斜体 链接',
      type: 'unstyled',
      inline_style_ranges: [
        { offset: 0, length: 8, style: 'bold' },
        { offset: 3, length: 2, style: 'italic' },
      ],
      entity_ranges: [{ key: 0, offset: 6, length: 2 }],
    },
    {
      text: '四级标题',
      type: 'unstyled',
      inline_style_ranges: [{ offset: 0, length: 4, style: 'bold' }],
    },
  ]);
  assert.deepEqual(plan.entities, [{
    key: '0',
    value: {
      type: 'link',
      mutability: 'mutable',
      data: { url: 'https://example.com' },
    },
  }]);
});

test('extensionless remote images use HTTP Content-Type', () => {
  assert.equal(normalizeRemoteImageFilename('RoXNVkrYl5Rk37nEXPRE', 'image/png'), 'RoXNVkrYl5Rk37nEXPRE.png');
  assert.equal(normalizeRemoteImageFilename('cover', 'image/jpeg; charset=binary'), 'cover.jpg');
  assert.equal(normalizeRemoteImageFilename('already.webp', 'application/octet-stream'), 'already.webp');
  assert.equal(normalizeRemoteImageFilename('unknown', 'application/octet-stream'), null);
});

test('promo sidecar defaults next to markdown source', () => {
  assert.equal(
    xPromoPath('/tmp/articles/demo.md'),
    '/tmp/articles/demo.x-promo.md',
  );
  assert.equal(xPromoPath('/tmp/articles/demo.md', '/tmp/custom.md'), '/tmp/custom.md');
});

test('promo sidecar contains only copy-ready text', () => {
  assert.equal(formatPromoText('  一段待发布导语。\n'), '一段待发布导语。\n');
  assert.throws(() => formatPromoText('   '), /不能为空/);
});
