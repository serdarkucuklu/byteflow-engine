import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PILLARS, selectPillar, pillarsFor} from './pillars.mjs';

test('every pillar has a key and a descriptive focus', () => {
  assert.ok(PILLARS.length >= 8);
  for (const p of PILLARS) {
    assert.ok(p.key && typeof p.key === 'string');
    assert.ok(p.focus && p.focus.length > 10);
  }
});

test('there are at least 2 timely (news) pillars and they mention headlines', () => {
  const timely = PILLARS.filter(p => p.timely);
  assert.ok(timely.length >= 2);
  for (const p of timely) assert.match(p.focus, /headline/i);
});

// %75 kuralı: 4 postluk pencerede 3 timely + 1 evergreen (Serdar direktifi 2026-07).
test('selectPillar picks a timely pillar for exactly 75% of posts', () => {
  let timelyCount = 0;
  for (let n = 0; n < 100; n++) {
    if (selectPillar([], n).timely) timelyCount++;
  }
  assert.equal(timelyCount, 75);
});

test('every 4th post (postCount % 4 === 3) is an evergreen pillar', () => {
  assert.ok(!selectPillar([], 3).timely);
  assert.ok(!selectPillar([], 7).timely);
  assert.ok(selectPillar([], 0).timely);
  assert.ok(selectPillar([], 4).timely);
});

test('selectPillar skips recently used pillars within the chosen group', () => {
  const timelyKeys = PILLARS.filter(p => p.timely).map(p => p.key);
  const picked = selectPillar(timelyKeys.slice(0, 2), 0);
  assert.ok(picked.timely);
  assert.ok(!timelyKeys.slice(0, 2).includes(picked.key));
});

test('selectPillar falls back to the oldest group key when the whole group is recent', () => {
  const timelyKeys = PILLARS.filter(p => p.timely).map(p => p.key);
  // grubun tamamı (ve araya karışmış evergreen'ler) yakın zamanda kullanılmış
  const recent = [timelyKeys[1], 'rag', timelyKeys[0], timelyKeys[2] ?? timelyKeys[0]].filter(Boolean);
  const picked = selectPillar(recent, 0);
  assert.ok(picked.timely);
  assert.equal(picked.key, timelyKeys[1]); // recentKeys içindeki en eski timely
});

test('evergreen slot rotates through non-timely pillars (LRU)', () => {
  const evergreen = PILLARS.filter(p => !p.timely).map(p => p.key);
  assert.equal(selectPillar([], 3).key, evergreen[0]);
  const picked = selectPillar([evergreen[0], evergreen[1]], 3);
  assert.ok(!picked.timely);
  assert.ok(![evergreen[0], evergreen[1]].includes(picked.key));
});

// ── kizlar-tr: üst küme + timely oranı markadan ───────────────────────────────
test('kizlar-tr, moda-tr\'yi KAPSAR (giyim konuları atılmadı, alt küme oldu)', () => {
  const moda = pillarsFor('moda-tr').map(p => p.key);
  const kizlar = pillarsFor('kizlar-tr').map(p => p.key);
  for (const k of moda) assert.ok(kizlar.includes(k), `moda konusu kayboldu: ${k}`);
  assert.ok(kizlar.length > moda.length, 'vücut/günlük hayat ailesi eklenmiş olmalı');
  assert.equal(new Set(kizlar).size, kizlar.length, 'anahtarlar benzersiz olmalı');
});

test('timely payı markadan gelir — varsayılan %75 davranışı korunur', () => {
  const P = pillarsFor('kizlar-tr');
  // Varsayılan: 4 postun 3'ü timely (eski kural birebir).
  assert.ok(selectPillar([], 0, null, null, P).timely);
  assert.ok(selectPillar([], 2, null, null, P).timely);
  assert.ok(!selectPillar([], 3, null, null, P).timely);
  // %25: 4 postun yalnız 1'i timely — merak sayfasında evergreen havuz asıl varlık.
  assert.ok(selectPillar([], 0, null, null, P, 0.25).timely);
  assert.ok(!selectPillar([], 1, null, null, P, 0.25).timely);
  assert.ok(!selectPillar([], 3, null, null, P, 0.25).timely);
});

test('kizlar-tr havuzunda cilt bakımı konusu YOK (kardeş sayfa sınırı)', () => {
  // @cilt.kodu = yüze sürülen ürün. İki sayfa aynı konuyu anlatırsa ikisi de kaybeder.
  const metin = pillarsFor('kizlar-tr').map(p => `${p.key} ${p.focus}`).join(' ').toLowerCase();
  for (const yasak of ['gözenek', 'sivilce', 'serum', 'güneş kremi', 'retinol', 'niasinamid']) {
    assert.ok(!metin.includes(yasak), `kardeş sayfanın konusu sızmış: ${yasak}`);
  }
});
