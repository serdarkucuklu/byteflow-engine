import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchTrends} from './fetch-trends.mjs';

// Sahte parser: her feed için sabit item döndürür
const fakeParser = {
  parseURL: async (url) => ({
    items: [
      {title: `Item from ${url}`, contentSnippet: 'summary text', link: 'https://x/1'},
      {title: `Second ${url}`, contentSnippet: 'more', link: 'https://x/2'},
    ],
  }),
};

test('aggregates items across feeds with source + shape', async () => {
  const out = await fetchTrends({limit: 5, parser: fakeParser});
  assert.ok(out.length > 0 && out.length <= 5);
  for (const c of out) {
    assert.equal(typeof c.title, 'string');
    assert.equal(typeof c.summary, 'string');
    assert.equal(typeof c.link, 'string');
    assert.equal(typeof c.source, 'string');
  }
});

test('one failing feed does not break the rest', async () => {
  let n = 0;
  const flaky = {parseURL: async () => { if (n++ === 0) throw new Error('feed down'); return {items: [{title: 'ok', contentSnippet: 's', link: 'l'}]}; }};
  const out = await fetchTrends({limit: 5, parser: flaky});
  assert.ok(out.length >= 1);
});
