import test from 'node:test';
import assert from 'node:assert/strict';
import { mdToPlan, parseInline } from './publish_article.ts';

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
