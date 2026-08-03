import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_META, MOTION_NAMES, pickMotion, motionTarget, weightOf, selectMotion, motionsFor} from './motion-registry.mjs';

// Serdar 2026-08-02: "5 farklı kareografi olsun, mevcuttan da iyi."
// 2026-08-03: kareografi MARKA BAŞINA havuzlandı — "5 farklı" kuralı artık defterin
// tamamı için değil HER SAYFANIN havuzu için geçerli (sayfalar birbirine benzemesin).
test('her markanın havuzunda en az beş kareografi var ve adlar tekil', () => {
  assert.equal(new Set(MOTION_NAMES).size, MOTION_NAMES.length, 'adlar tekil olmalı');
  for (const kume of ['ortak', 'kizlar']) {
    const havuz = motionsFor(kume).map(m => m.name);
    assert.ok(havuz.length >= 5, `${kume} havuzunda beşten az kareografi var`);
    assert.equal(new Set(havuz).size, havuz.length, `${kume} havuzunda tekrar var`);
  }
  // @cilt.kodu'nun hareket dili DEĞİŞMEDİ: yeni kareografiler oraya sızmamalı.
  assert.deepEqual(motionsFor('ortak').map(m => m.name),
    ['buildup', 'spotlight', 'camera', 'cascade', 'ripple']);
});

// Kayıt defteri scenes/choreo.tsx ile SENKRON olmalı: burada olup orada olmayan bir ad
// render'da sessizce buildup'a düşer ve "5 farklı" iddiası kâğıt üstünde kalır.
test('kayıt defteri choreo.tsx ile senkron', async () => {
  const {readFileSync} = await import('node:fs');
  const src = readFileSync(new URL('../scenes/choreo.tsx', import.meta.url), 'utf8');
  const exported = src.match(/export const CHOREOS[^{]*\{([^}]*)\}/)?.[1] ?? '';
  for (const name of MOTION_NAMES) {
    assert.match(src, new RegExp(`key: '${name}'`), `choreo.tsx'te ${name} tanımı yok`);
    assert.match(exported, new RegExp(`\\b${name}\\b`), `${name} CHOREOS haritasında değil`);
  }
});

test('every meta entry has name/stagger/weight of correct types', () => {
  for (const m of MOTION_META) {
    assert.equal(typeof m.name, 'string');
    assert.ok(m.name.length > 0);
    assert.equal(typeof m.stagger, 'number');
    assert.ok(m.stagger >= 0);
    assert.equal(typeof m.weight, 'number');
  }
});

test('pickMotion her indekste havuzun içinde kalır', () => {
  for (const i of [0, 5, 12, -1]) assert.ok(MOTION_NAMES.includes(pickMotion(i).name));
  assert.equal(pickMotion(0).name, 'buildup');
  // Tur başa döner. Sabit sayı YAZMA: defter büyüdükçe (yeni marka hattı eklendikçe)
  // sarma noktası kayıyor; sınanan şey sayı değil DAVRANIŞ.
  assert.equal(pickMotion(MOTION_META.length).name, pickMotion(0).name);
  assert.equal(pickMotion(MOTION_META.length * 3).name, pickMotion(0).name);
});

test('weightOf bilinmeyen adı varsayılana düşürür', () => {
  assert.equal(weightOf('cascade'), 1.5);
  assert.equal(weightOf('olmayan'), MOTION_META[0].weight);
  assert.equal(weightOf(undefined), MOTION_META[0].weight);
});

test('selectMotion son kullanılanları atlar', () => {
  const picked = selectMotion(['buildup', 'spotlight'], 0);
  assert.ok(!['buildup', 'spotlight'].includes(picked.name));
});

test('selectMotion hepsi kullanıldıysa kilitlenmez', () => {
  const picked = selectMotion(MOTION_NAMES, 3);
  assert.ok(MOTION_NAMES.includes(picked.name));
});

test('motionTarget stays inside the 25-30s band', () => {
  for (const m of MOTION_META) {
    const t = motionTarget(m.weight);
    assert.ok(t >= 25 && t <= 30, `${m.name} → ${t}`);
  }
  assert.equal(motionTarget(-100), 25);
  assert.equal(motionTarget(100), 30);
});

// ── MARKA BAŞINA HAREKET HAVUZU (2026-08-03) ──────────────────────────────────
// Serdar: "@kizlar.kodu'nun animasyonları cilt.kodu'ya göre farklılaşsın."
test('markanın hareket havuzu ayrı — kizlar kendi kareografilerini kullanır', () => {
  const kizlar = motionsFor('kizlar').map(m => m.name);
  const ortak = motionsFor('ortak').map(m => m.name);
  for (const yeni of ['sketch', 'flip', 'orbit']) {
    assert.ok(kizlar.includes(yeni), `kizlar havuzunda eksik: ${yeni}`);
    assert.ok(!ortak.includes(yeni), `yeni kareografi @cilt.kodu'ya sızmış: ${yeni}`);
  }
});

test('bilinmeyen küme ortak havuza düşer (yayın kırılmaz)', () => {
  assert.deepEqual(motionsFor('olmayan-kume').map(m => m.name), motionsFor('ortak').map(m => m.name));
  assert.deepEqual(motionsFor(undefined).map(m => m.name), motionsFor('ortak').map(m => m.name));
});

test('selectMotion verilen havuzun DIŞINA çıkmaz', () => {
  const havuz = motionsFor('kizlar');
  const adlar = havuz.map(m => m.name);
  for (let n = 0; n < 12; n++) {
    assert.ok(adlar.includes(selectMotion([], n, havuz).name));
    assert.ok(adlar.includes(selectMotion(['sketch', 'flip'], n, havuz).name));
  }
});
