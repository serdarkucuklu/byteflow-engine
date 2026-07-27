import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scorePost, aggregate, pickWeighted, leaderboard} from './scoreboard.mjs';

const post = (over = {}) => ({
  pillar: 'agents', layout: 'cycle', durSec: 20, voice: 6, voiceName: 'Kore',
  insights: {views: 100, reach: 80, saved: 2, shares: 1, total_interactions: 8,
    ig_reels_avg_watch_time: 8000, ig_reels_video_view_total_time: 800000},
  ...over,
});

test('scorePost needs real data — no insights, no score', () => {
  assert.equal(scorePost({pillar: 'rag'}), null);
  assert.equal(scorePost({insights: {}}), null);
  assert.equal(scorePost({insights: {reach: 0, views: 0}}), null);
});

test('retention dominates the score', () => {
  const low = scorePost(post({insights: {...post().insights, ig_reels_avg_watch_time: 2000}}));
  const high = scorePost(post({insights: {...post().insights, ig_reels_avg_watch_time: 16000}}));
  assert.ok(high > low * 1.8, `retention ağırlığı yetersiz: ${low} → ${high}`);
});

test('saves and shares lift the score, and shares count more', () => {
  const plain = scorePost(post());
  const saved = scorePost(post({insights: {...post().insights, saved: 8}}));
  const shared = scorePost(post({insights: {...post().insights, shares: 8}}));
  assert.ok(saved > plain);
  assert.ok(shared > saved, 'paylaşım erişimi büyüttüğü için daha ağır olmalı');
});

test('a short video with the same watch time scores higher (completion, not seconds)', () => {
  const long = scorePost(post({durSec: 40}));
  const short = scorePost(post({durSec: 12}));
  assert.ok(short > long);
});

test('aggregate shrinks small samples toward the global mean', () => {
  const history = [
    post({pillar: 'rag', insights: {...post().insights, ig_reels_avg_watch_time: 18000}}), // tek harika post
    post({pillar: 'agents'}), post({pillar: 'agents'}), post({pillar: 'agents'}),
    post({pillar: 'agents'}), post({pillar: 'agents'}),
  ];
  const {groups, global} = aggregate(history, 'pillar');
  const rag = groups.get('rag'), agents = groups.get('agents');
  assert.equal(rag.n, 1);
  assert.ok(rag.mean > rag.score, 'tek örnek ham ortalamasıyla ödüllendirilmemeli');
  assert.ok(Math.abs(rag.score - global) < Math.abs(rag.mean - global), 'global ortalamaya büzülmeli');
  assert.ok(agents.n === 5 && Math.abs(agents.score - agents.mean) < 0.05, 'çok örnekte büzülme azalır');
});

test('pickWeighted explores while data is thin, then favours winners', () => {
  const thin = aggregate([post()], 'pillar');
  assert.ok(['a', 'b'].includes(pickWeighted(['a', 'b'], thin, {random: () => 0.9})));

  const history = [
    ...Array.from({length: 6}, () => post({pillar: 'winner', insights: {...post().insights, ig_reels_avg_watch_time: 17000, saved: 9}})),
    ...Array.from({length: 6}, () => post({pillar: 'loser', insights: {...post().insights, ig_reels_avg_watch_time: 1500, saved: 0, shares: 0}})),
  ];
  const stats = aggregate(history, 'pillar');
  let wins = 0;
  for (let i = 0; i < 100; i++) {
    if (pickWeighted(['winner', 'loser'], stats, {random: () => i / 100}) === 'winner') wins++;
  }
  assert.ok(wins > 65, `kazanan yeterince öne çıkmadı: ${wins}/100`);
  assert.ok(wins < 100, 'keşif tamamen ölmemeli');
});

test('an untried option is treated as average, so new topics still get a chance', () => {
  const history = Array.from({length: 8}, () => post({pillar: 'known'}));
  const stats = aggregate(history, 'pillar');
  let picked = 0;
  for (let i = 0; i < 60; i++) if (pickWeighted(['known', 'brand-new'], stats, {random: () => i / 60}) === 'brand-new') picked++;
  assert.ok(picked > 5, `hiç denenmemiş konu şans almalı: ${picked}/60`);
});

test('leaderboard summarises every dimension it has data for', () => {
  const out = leaderboard([post(), post({pillar: 'rag', layout: 'nodes-flow'})]);
  assert.match(out, /pillar/);
  assert.match(out, /layout/);
  assert.match(out, /length/);
  assert.equal(leaderboard([{pillar: 'x'}]), '  (henüz ölçülmüş post yok)');
});
