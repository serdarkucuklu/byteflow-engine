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
    queries: ['empty data center aisle', 'circuit board macro'], count: 2, outDir,
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
  assert.deepEqual(clips.map(c => c.query), ['empty data center aisle', 'circuit board macro']);
  assert.equal(readdirSync(outDir).length, 2);
  for (const c of clips) assert.ok(existsSync(c.path));
});

test('fetchFootage skips a truncated download instead of writing a broken clip', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  const clips = await fetchFootage({
    queries: ['circuit board macro'], count: 1, outDir, keys: {PEXELS_API_KEY: 'k'},
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

test('fetchFootage pads a short query list from the whitelist', async () => {
  const seen = [];
  const outDir = mkdtempSync(join(tmpdir(), 'bf-footage-'));
  await fetchFootage({
    queries: ['abstract digital particles'], count: 3, outDir, keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => {
      if (url.startsWith('https://api.pexels.com')) {
        seen.push(decodeURIComponent(new URL(url).searchParams.get('query')));
        return pexelsResponse([]);
      }
      return {ok: false, status: 404};
    },
  });
  assert.equal(seen.length, 3);
  assert.equal(seen[0], 'abstract digital particles');
  assert.ok(FALLBACK_QUERIES.includes(seen[1]));
});

test('queryFromTitle strips filler and yields a searchable phrase', () => {
  const q = queryFromTitle('How does RAG retrieval actually work?');
  assert.match(q, /rag/);
  assert.doesNotMatch(q, /\bhow\b|\bdoes\b/);
});

test('people queries are rejected — the page is faceless', async () => {
  const {isPeopleQuery} = await import('./fetch-footage.mjs');
  // YÜZ/KİŞİ/KALABALIK: sayfanın yüzsüz kimliği bunlardan korunuyor.
  for (const q of ['developer typing laptop', 'woman using phone', 'team meeting office',
    'portrait of a girl', 'crowd walking street']) {
    assert.ok(isPeopleQuery(q), q);
  }
  for (const q of ['server room data center', 'circuit board macro', 'rain on glass at night']) {
    assert.ok(!isPeopleQuery(q), q);
  }
  // ⚠ 2026-08-09 DEĞİŞTİ: "el" artık engellenmiyor. Güzellik/bakım nişinde ürünün
  // KULLANILDIĞI an (kremi süren el, serumu damlatan el) en çok işleyen çekim ve hâlâ
  // yüzsüz. Eskiden `hands?|typing|working|sitting|thinking|smiling` de engelliydi;
  // liste fazla genişti ve nişin ana çekimini kapatıyordu.
  for (const q of ['close up hands keyboard', 'hands applying cream close up',
    'hand holding serum dropper']) {
    assert.equal(isPeopleQuery(q), false, `el çekimi engellenmemeli: ${q}`);
  }
  assert.ok(FALLBACK_QUERIES.every(q => !isPeopleQuery(q)), 'yedek havuzda insan olmamalı');
});

test('fetchFootage swaps a people query for a safe whitelist topic', async () => {
  const {mkdtempSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const seen = [];
  await fetchFootage({
    queries: ['empty data center aisle', 'developer typing at desk'], count: 2,
    outDir: mkdtempSync(join(tmpdir(), 'bf-footage-')), keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => {
      seen.push(decodeURIComponent(new URL(url).searchParams.get('query')));
      return {ok: true, status: 200, json: async () => ({videos: []})};
    },
  });
  assert.equal(seen[0], 'empty data center aisle');
  assert.ok(!seen.some(q => /developer/.test(q)), 'insanlı sorgu kullanılmamalı');
  assert.equal(seen.length, 2);
});

test('footage queries are locked to the people-free whitelist', async () => {
  const {toSafeQuery, SAFE_FOOTAGE_QUERIES, isPeopleQuery} = await import('./fetch-footage.mjs');
  assert.equal(toSafeQuery('circuit board macro'), 'circuit board macro');
  assert.ok(SAFE_FOOTAGE_QUERIES.includes(toSafeQuery('server racks blinking blue lights', 0)));
  assert.ok(SAFE_FOOTAGE_QUERIES.includes(toSafeQuery('developer typing at desk', 3)));
  assert.ok(SAFE_FOOTAGE_QUERIES.every(q => !isPeopleQuery(q)));
  assert.equal(new Set(SAFE_FOOTAGE_QUERIES).size, SAFE_FOOTAGE_QUERIES.length, 'tekrar olmasın');
});

test('fetchFootage maps off-list queries onto distinct whitelist topics', async () => {
  const {mkdtempSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {SAFE_FOOTAGE_QUERIES} = await import('./fetch-footage.mjs');
  const seen = [];
  await fetchFootage({
    queries: ['server racks blinking blue lights', 'developer typing', 'circuit board macro'],
    count: 4, outDir: mkdtempSync(join(tmpdir(), 'bf-footage-')), keys: {PEXELS_API_KEY: 'k'},
    fetchFn: async url => {
      seen.push(decodeURIComponent(new URL(url).searchParams.get('query')));
      return {ok: true, status: 200, json: async () => ({videos: []})};
    },
  });
  assert.equal(seen.length, 4);
  assert.equal(new Set(seen).size, 4, 'aynı konu iki kez kullanılmamalı');
  assert.ok(seen.every(q => SAFE_FOOTAGE_QUERIES.includes(q)), seen.join(', '));
  assert.ok(seen.includes('circuit board macro'), 'listedeki sorgu korunmalı');
});

// ── GÜNLÜK KÜMESİ (docs/plan/kizlarkodu-merak-acigi.md, Faz 1.9/1.11) ──────────────────────
// @kizlar.kodu artık kumaş makrosuna değil günlük hayat çekimlerine düşmeli (yastık, sabah
// uyanma, saç tarama…). Kumaş/tekstil terimleri KESİNLİKLE geçmemeli — bu kümenin varlık
// nedeni tam olarak kumaş b-roll'ünden kaçmak.
test('footageSetFor("gunluk") en az 12 sorgu döndürür ve kumaş terimi içermez', async () => {
  const {footageSetFor, SAFE_FOOTAGE_QUERIES} = await import('./fetch-footage.mjs');
  const gunluk = footageSetFor('gunluk');
  // tech'e sessizce düşmediğini de kilitle — aksi halde bu test "bilinmeyen ad → tech"
  // davranışını yanlışlıkla "gunluk küme var" sanıp yanlış yeşil verir.
  assert.notDeepEqual(gunluk, SAFE_FOOTAGE_QUERIES, 'gunluk küme tanımsız, tech\'e düşmüş');
  assert.ok(gunluk.length >= 12, `en az 12 sorgu bekleniyor, gelen: ${gunluk.length}`);
  assert.ok(gunluk.some(q => /pillow|waking up|morning/i.test(q)), 'günlük hayat çekimi yok');
  const fabricDeseni = /\b(fabric|denim|wool|cotton|silk|garment)\b/i;
  for (const q of gunluk) assert.doesNotMatch(q, fabricDeseni, `kumaş terimi sızmış: ${q}`);
});

test('footageSetFor bilinmeyen adda hâlâ tech\'e düşer (mevcut davranış kilidi)', async () => {
  const {footageSetFor, SAFE_FOOTAGE_QUERIES} = await import('./fetch-footage.mjs');
  assert.deepEqual(footageSetFor('bilinmeyen-kume'), SAFE_FOOTAGE_QUERIES);
});
