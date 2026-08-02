import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_META, MOTION_NAMES, pickMotion, motionTarget, weightOf, selectMotion} from './motion-registry.mjs';

// Serdar 2026-08-02: "5 farklı kareografi olsun, mevcuttan da iyi."
test('beş kareografi kayıtlı ve adları tekil', () => {
  assert.equal(MOTION_META.length, 5);
  assert.deepEqual(MOTION_NAMES, ['buildup', 'spotlight', 'camera', 'cascade', 'ripple']);
  assert.equal(new Set(MOTION_NAMES).size, 5);
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
  assert.equal(pickMotion(5).name, 'buildup');   // 5 kareografi → tur başa döner
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
