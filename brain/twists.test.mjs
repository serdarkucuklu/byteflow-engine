import {test} from 'node:test';
import assert from 'node:assert/strict';
import {twistsFor, selectTwist, TWIST_SETS} from './twists.mjs';

const BEAUTY = TWIST_SETS['beauty-tr'];

test('gaf havuzu yeterince geniş ve her gaf tarif edilmiş', () => {
  assert.ok(BEAUTY.length >= 8, 'az sayıda gaf = birkaç günde tekrar');
  for (const t of BEAUTY) {
    assert.match(t.key, /^[a-z-]+$/);
    assert.ok(t.focus.length > 40, `${t.key}: gaf tarifi çok kısa`);
  }
  assert.equal(new Set(BEAUTY.map(t => t.key)).size, BEAUTY.length, 'anahtarlar tekil olmalı');
});

test('bilinmeyen küme sessizce geçmez, kapalı marka null döner', () => {
  assert.equal(twistsFor(), null);
  assert.throws(() => twistsFor('yok-boyle'), /bilinmeyen gaf kümesi/);
  assert.equal(twistsFor('beauty-tr').length, BEAUTY.length);
});

// Serdar 2026-08-01: "para gafı süperdi ama sadece para değil" — ardışık videolar aynı
// esprili açıdan gelmemeli.
test('son kullanılan gaflar tekrar seçilmez', () => {
  const recent = BEAUTY.slice(0, 3).map(t => t.key);
  const picked = selectTwist(recent, BEAUTY);
  assert.ok(!recent.includes(picked.key));
});

test('hepsi kullanıldıysa kilitlenmez, havuza döner', () => {
  const picked = selectTwist(BEAUTY.map(t => t.key), BEAUTY);
  assert.ok(BEAUTY.some(t => t.key === picked.key));
});

test('veri birikince performansa göre ağırlıklı seçer', () => {
  const stats = {sampleSize: 5};
  const picked = selectTwist([], BEAUTY, stats, (keys) => keys[keys.length - 1]);
  assert.equal(picked.key, BEAUTY[BEAUTY.length - 1].key);
});

test('ağırlıklı seçim havuz dışı bir anahtar döndürürse LRU\'ya düşer', () => {
  const picked = selectTwist([], BEAUTY, {sampleSize: 9}, () => 'olmayan-gaf');
  assert.equal(picked.key, BEAUTY[0].key);
});

// ── SEÇİM KİLİDİ (2026-08-03 canlı hata) ──────────────────────────────────────
test('ölçüm YOKKEN de gaf ekseni döner — listenin ilkine çakılmaz', () => {
  const T = twistsFor('moda-tr');
  const bosIstatistik = {sampleSize: 0, groups: new Map(), global: 0};
  // pickWeighted'ın ölçümsüz hâli: tekdüze rastgele. Burada sahte bir seçici yeter.
  let sira = 0;
  const secici = keys => keys[(sira++) % keys.length];
  const cikan = new Set();
  for (let i = 0; i < T.length; i++) cikan.add(selectTwist([], T, bosIstatistik, secici).key);
  assert.equal(cikan.size, T.length, 'her eksen erişilebilir olmalı');
});

test('seçici verilmezse davranış belirlenimci kalır', () => {
  const T = twistsFor('moda-tr');
  assert.equal(selectTwist([], T).key, T[0].key);
});

test('moda-tr para gafı markanın gider tablosunu YASAKLAR', () => {
  // Üç videoda da "kumaş → dikim → kira → marka primi" merdiveni çıktı; odak metni
  // birebir onu davet ediyordu.
  const para = twistsFor('moda-tr').find(t => t.key === 'para');
  assert.match(para.focus, /YASAK/);
  assert.match(para.focus, /gider tablosu/);
  assert.doesNotMatch(para.focus, /kumaşın kilo fiyatı/);
});
