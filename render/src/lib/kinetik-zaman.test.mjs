import {test} from 'node:test';
import assert from 'node:assert/strict';
import {perKelime, girisBitis, kapakAni, GIRIS_CARPAN, PER_KELIME_TAVAN, PER_KELIME_TABAN}
  from './kinetik-zaman.mjs';

// ESKİ FORMÜL — regresyon bekçisi. renderKinetik ilk sürümde bunu kullanıyordu ve
// kapak karesi cümlenin ORTASINDAN kesiliyordu ("Yumuşatıcı yazlık giysini tek").
const eskiPerKelime = (n, sure) => Math.min(0.13, Math.max(0.45, sure * 0.55) / Math.max(n, 1));

test('ESKİ formül sözleşmeyi ihlal ediyor — bu testin varlık sebebi', () => {
  // Tipik beat: 4 sn, 14 kelime.
  const n = 14, sure = 4;
  const eskiBitis = n * eskiPerKelime(n, sure) * GIRIS_CARPAN;
  assert.ok(eskiBitis > sure * 0.5,
    `eski formül girişi ${eskiBitis.toFixed(2)}s'de bitiriyor, beat'in yarısı ${sure * 0.5}s ` +
    '— kapak yarım cümle gösteriyordu');
});

test('giriş beat\'in İLK YARISINDA biter (kapak sözleşmesi)', () => {
  for (const n of [3, 8, 14, 22]) {
    for (const sure of [2.6, 3.4, 4.2, 5.5]) {
      const bitis = girisBitis(n, sure);
      assert.ok(bitis <= sure * 0.5 + 1e-9,
        `${n} kelime / ${sure}s → giriş ${bitis.toFixed(3)}s, yarı ${sure * 0.5}s`);
    }
  }
});

test('perKelime tavanı aşmaz (kısa cümlede sürünmez)', () => {
  // 3 kelimelik hook 5,5 sn sürerse kelimeler tek tek sürünmemeli.
  assert.ok(perKelime(3, 5.5) <= PER_KELIME_TAVAN);
});

test('yoğun cümlede HIZLI kaskad kabul edilir — taban sözleşmeyi bozmamalı', () => {
  // ⚠ TASARIM KARARI: "kelime animasyonu görünür kalsın" diye anlamlı bir taban
  // (ör. 0,045s) koyulursa, 22 kelime / 2,6sn beat'te giriş beat'in yarısını AŞIYOR ve
  // kapak yine yarım cümle gösteriyor. İki sözleşme aynı anda sağlanamıyor. Kapak
  // doğruluğu seçildi: yoğun cümlede kelimeler hızlı kaskad hâlinde akar (bu zaten
  // enerjik görünüyor), taban yalnız sıfıra/negatife düşmeyi engelleyen bir emniyet.
  assert.ok(perKelime(22, 2.6) < 0.045, 'yoğun cümlede kaskad hızlanmalı');
  assert.ok(perKelime(22, 2.6) > PER_KELIME_TABAN, 'emniyet tabanı pratikte devreye girmemeli');
  // Emniyet tabanı ancak patolojik girdide devreye girer.
  assert.equal(perKelime(400, 1.0), PER_KELIME_TABAN);
});

test('kapakAni: hook beat\'inin girişi bittikten SONRA', () => {
  const beats = [{text: 'Elde yıkama sepetin ömründen iki yıl çalıyor', start: 0.3, dur: 3.0}];
  const t = kapakAni(beats);
  const bitis = girisBitis(7, 3.0);
  assert.ok(t >= 0.3 + bitis, `kapak ${t} < giriş bitişi ${0.3 + bitis}`);
});

test('kapakAni: beat sönmeye başlamadan ÖNCE', () => {
  // renderKinetik beat sonunda 0.22s'lik sönme yapıyor; kapak ona girmemeli.
  const beats = [{text: 'bir iki üç dört beş', start: 0.3, dur: 3.0}];
  const t = kapakAni(beats);
  assert.ok(t <= 0.3 + 3.0 - 0.22, `kapak ${t} sönme penceresine giriyor`);
});

test('kapakAni: uzun cümlede bile sönme penceresine girmez (kırpılır)', () => {
  const uzun = Array.from({length: 30}, (_, i) => `kelime${i}`).join(' ');
  const beats = [{text: uzun, start: 0.2, dur: 2.4}];
  const t = kapakAni(beats);
  assert.ok(t <= 0.2 + 2.4 - 0.22, `kapak ${t} sönme penceresine girdi`);
  assert.ok(t > 0.2, 'kapak beat başlangıcından sonra olmalı');
});

test('kapakAni: beat yoksa makul bir varsayılana düşer', () => {
  assert.ok(kapakAni([]) > 0);
  assert.ok(kapakAni(null) > 0);
});
