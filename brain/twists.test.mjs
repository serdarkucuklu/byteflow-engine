import {test} from 'node:test';
import assert from 'node:assert/strict';
import {twistsFor, selectTwist, twistByKey, TWIST_SETS} from './twists.mjs';

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

// ── ERKEK GAFI (docs/plan/kizlarkodu-erkek-gaf.md, Faz 1) ──────────────────────────────────
test('twistByKey bilinmeyen anahtarda throw ediyor — sessiz fallback yasak', () => {
  const T = twistsFor('moda-tr');
  assert.throws(() => twistByKey('yok-boyle-bir-sey', T), /bilinmeyen gaf anahtarı/);
  assert.equal(twistByKey('erkek-dolabi', T).key, 'erkek-dolabi');
});

test('erkek-dolabi moda-tr içinde, kime ve focus dolu, focus YASAK satırı içeriyor', () => {
  const twist = twistsFor('moda-tr').find(t => t.key === 'erkek-dolabi');
  assert.ok(twist, 'erkek-dolabi moda-tr havuzunda bulunamadı');
  assert.ok(twist.kime?.length > 10, 'kime alanı boş/çok kısa');
  assert.ok(twist.focus?.length > 40, 'focus alanı boş/çok kısa');
  assert.match(twist.focus, /YASAK/);
});

// ── ERKEK GAFI (docs/plan/kizlarkodu-erkek-gaf.md, Faz 2.3) ────────────────────────────────
// `kumanda-imparatorlugu` 2.5 ölçümünde SIZINTI kapısını 2/2'de geçemediği için havuzdan
// silindi (bkz. brain/twists.mjs — "⚠ SİLİNDİ" yorumu). Geriye 3 erkek twist'i kaldı.
const ERKEK_TWIST_KEYS = ['erkek-dolabi', 'yikama-cesareti', 'yon-inadi'];

test('moda-tr anahtarları tekil ve yeterince geniş', () => {
  const T = twistsFor('moda-tr');
  assert.equal(new Set(T.map(t => t.key)).size, T.length, 'anahtarlar tekil olmalı');
  assert.ok(T.length >= 20, 'az sayıda gaf = birkaç günde tekrar');
});

test('4 erkek twistinin kime alanı dolu', () => {
  const T = twistsFor('moda-tr');
  for (const key of ERKEK_TWIST_KEYS) {
    const twist = T.find(t => t.key === key);
    assert.ok(twist, `${key} moda-tr havuzunda bulunamadı`);
    assert.ok(twist.kime?.length > 10, `${key}: kime alanı boş/çok kısa`);
  }
});

test('4 erkek twistinin focus metninde aşağılayıcı kelime ve cinsiyet geneli kalıbı yok', () => {
  // Kapsam kasıtlı olarak 4 erkek twist'iyle sınırlı: BEAUTY_TR'deki "aile-tavsiyesi" gibi
  // eski gaflar "Kimseyi aptal yerine koymadan" der — kelimeyi YASAKLAMAK için kullanır,
  // aşağılamak için değil. Geniş taramada bu yanlış kırmızı üretir (bkz. plan REVİZYON NOTU 2 §6
  // dersinin aynısı: kelime-eşleşmesi bağlamı ayırt etmez).
  //
  // Her 4 erkek twist'i kendi focus'unda ⛔ YASAK satırı + "böyle değil" örneğinde AÇIKÇA
  // "erkek beyni" / "...zaten anlamaz" gibi kalıpları TIRNAK İÇİNDE gösterir — modelin
  // KAÇINMASI gereken örnek olarak (aynı Faz 1 deseni, generate-spec.mjs:85-89 dersi: model
  // kuralı değil örneği taklit eder). Bu yüzden tarama tırnak içindeki demonstratif alıntıları
  // hariç tutar; asıl kontrol edilen şey focus'un KENDİ SESİYLE (tırnak dışında) bir genelleme
  // YAPMAMASI / aşağılama İÇERMEMESİ.
  const stripQuoted = (s) => s.replace(/"[^"]*"/g, '');
  const AGIR_KELIMELER = /aptal|salak|beceriksiz|ezik|işe yaramaz/i;
  const GENELLEME_KALIPLARI = /erkek beyni|erkekler hep/i;
  const T = twistsFor('moda-tr');
  for (const key of ERKEK_TWIST_KEYS) {
    const twist = T.find(t => t.key === key);
    const disiSes = stripQuoted(twist.focus);
    assert.doesNotMatch(disiSes, AGIR_KELIMELER, `${key}: aşağılayıcı kelime (tırnak dışında)`);
    assert.doesNotMatch(disiSes, GENELLEME_KALIPLARI, `${key}: genelleme kalıbı (tırnak dışında)`);
  }
});
