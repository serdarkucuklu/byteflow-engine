import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchInsights} from './fetch-insights.mjs';

test('fetchInsights flattens Graph API insight values into a metric map', async () => {
  const fakeFetch = async (url) => {
    assert.match(url, /12345\/insights/);
    assert.match(url, /metric=reach,plays,saved,shares,total_interactions/);
    return {ok: true, json: async () => ({data: [
      {name: 'reach', values: [{value: 800}]},
      {name: 'plays', values: [{value: 1200}]},
      {name: 'saved', values: [{value: 40}]},
      {name: 'shares', values: [{value: 12}]},
      {name: 'total_interactions', values: [{value: 95}]},
    ]})};
  };
  const out = await fetchInsights({mediaId: '12345', token: 't', fetchFn: fakeFetch});
  assert.deepEqual(out, {reach: 800, plays: 1200, saved: 40, shares: 12, total_interactions: 95});
});

test('fetchInsights throws on non-ok responses', async () => {
  const fakeFetch = async () => ({ok: false, status: 400, text: async () => 'bad'});
  await assert.rejects(() => fetchInsights({mediaId: '1', token: 't', fetchFn: fakeFetch}), /insights HTTP 400/);
});
