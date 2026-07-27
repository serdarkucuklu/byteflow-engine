import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, existsSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fetchFootage, searchClips, queryFromTitle, FALLBACK_QUERIES} from './fetch-footage.mjs';

const bytes = n => Buffer.alloc(n, 1);

function pexelsResponse(videos) {
  return {ok: true, status: 200, json: async () => ({videos})};
}

const VERTICAL_VIDEO = {
  id: 101, duration: 12, url: 'https://pexels.com/v/101', user: {name: 'Ada'},
  video_files: [
    {width: 720, height: 1280, link: 'https://cdn/720.mp4'},
    {width: 1080, height: 1920, link: 'https://cdn/1080.mp4'},
    {width: 2160, height: 3840, link: 'https://cdn/4k.mp4'},   // >1400px → elenir
    {width: 1920, height: 1080, link: 'https://cdn/land.mp4'}, // yatay → elenir
  ],
};

test('searchClips picks the best vertical file under the width cap', async () => {
  const hits = await searchClips({
    query: 'server room', keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async () => pexelsResponse([VERTICAL_VIDEO]),
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].url, 'https://cdn/1080.mp4');
  assert.equal(hits[0].provider, 'pexels');
  assert.match(hits[0].credit, /Ada/);
});

test('searchClips drops clips shorter than the loop threshold', async () => {
  const hits = await searchClips({
    query: 'x', keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async () => pexelsResponse([{...VERTICAL_VIDEO, duration: 2}]),
  });
  assert.deepEqual(hits, []);
});

test('searchClips falls through to the next provider when the first has no key', async () => {
  const calls = [];
  const hits = await searchClips({
    query: 'neon city', keys: {PIXABAY_API_KEY: 'p'},
    fetchFn: async url => {
      calls.push(url);
      return {ok: true, status: 200, json: async () => ({hits: [{
        id: 7, duration: 9, user: 'Lin',
        videos: {large: {width: 1080, height: 1920, url: 'https://px/large.mp4'}},
      }]})};
    },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /pixabay\.com\/api\/videos/);
  assert.equal(hits[0].provider, 'pixabay');
});

test('searchClips returns [] when no provider key is configured', async () => {
  const hits = await searchClips({query: 'x', keys: {}, fetchFn: async () => {
    throw new Error('should not be called');
  }});
  assert.deepEqual(hits, []);
});

test('fetchFootage downloads one clip per query and never repeats a video', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  const clips = await fetchFootage({
    queries: ['server room', 'circuit board'], count: 2, outDir,
    keys: {PEXELS_API_KEY: 'k'}, pick: arr => arr[0],
    fetchFn: async url => {
      if (url.startsWith('https://api.pexels.com')) {
        // Her iki sorgu da AYNI iki videoyu döndürüyor → ikinci sorgu farklı olanı almalı.
        return pexelsResponse([VERTICAL_VIDEO, {...VERTICAL_VIDEO, id: 202,
          video_files: [{width: 1080, height: 1920, link: 'https://cdn/second.mp4'}]}]);
      }
      return {ok: true, status: 200, arrayBuffer: async () => bytes(500_000)};
    },
  });
  assert.equal(clips.length, 2);
  assert.notEqual(clips[0].path, clips[1].path);
  assert.deepEqual(clips.map(c => c.query), ['server room', 'circuit board']);
  assert.equal(readdirSync(outDir).length, 2);
  for (const c of clips) assert.ok(existsSync(c.path));
});

test('fetchFootage skips a truncated download instead of writing a broken clip', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  const clips = await fetchFootage({
    queries: ['server room'], count: 1, outDir, keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => url.startsWith('https://api.pexels.com')
      ? pexelsResponse([VERTICAL_VIDEO])
      : {ok: true, status: 200, arrayBuffer: async () => bytes(1000)},
  });
  assert.deepEqual(clips, []);
  assert.equal(readdirSync(outDir).length, 0);
});

test('fetchFootage survives a provider outage (returns [], caller falls back)', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  const clips = await fetchFootage({
    queries: ['x'], count: 1, outDir, keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async () => ({ok: false, status: 503, json: async () => ({})}),
  });
  assert.deepEqual(clips, []);
});

test('fetchFootage pads a short query list from the fallback pool', async () => {
  const seen = [];
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  await fetchFootage({
    queries: ['only one'], count: 3, outDir, keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => {
      if (url.startsWith('https://api.pexels.com')) {
        seen.push(decodeURIComponent(new URL(url).searchParams.get('query')));
        return pexelsResponse([]);
      }
      return {ok: false, status: 404};
    },
  });
  assert.equal(seen.length, 3);
  assert.equal(seen[0], 'only one');
  assert.ok(FALLBACK_QUERIES.includes(seen[1]));
});

test('queryFromTitle strips filler and yields a searchable phrase', () => {
  const q = queryFromTitle('How does RAG retrieval actually work?');
  assert.match(q, /rag/);
  assert.doesNotMatch(q, /\bhow\b|\bdoes\b/);
});

test('people queries are rejected — the page is faceless', async () => {
  const {isPeopleQuery} = await import('./fetch-footage.mjs');
  for (const q of ['developer typing laptop', 'woman using phone', 'team meeting office', 'close up hands keyboard']) {
    assert.ok(isPeopleQuery(q), q);
  }
  for (const q of ['server room data center', 'circuit board macro', 'rain on glass at night']) {
    assert.ok(!isPeopleQuery(q), q);
  }
  assert.ok(FALLBACK_QUERIES.every(q => !isPeopleQuery(q)), 'yedek havuzda insan olmamalı');
});

test('fetchFootage drops a people query and pads from the fallback pool', async () => {
  const {mkdtempSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const seen = [];
  await fetchFootage({
    queries: ['server rack aisle', 'developer typing at desk'], count: 2,
    outDir: mkdtempSync(join(tmpdir(), 'bf-footage-')), keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => {
      seen.push(decodeURIComponent(new URL(url).searchParams.get('query')));
      return {ok: true, status: 200, json: async () => ({videos: []})};
    },
  });
  assert.equal(seen[0], 'server rack aisle');
  assert.ok(!seen.some(q => /developer/.test(q)), 'insanlı sorgu kullanılmamalı');
  assert.equal(seen.length, 2);
});
