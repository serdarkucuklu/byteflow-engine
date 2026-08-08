import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secMuzik, KARA_LISTE} from './muzik-sec.mjs';

// Sahte dosya sistemi: {dizin: [dosyalar]}
const fs = (harita) => ({
  varMi: d => Object.prototype.hasOwnProperty.call(harita, d),
  listele: d => harita[d] ?? [],
});

test('marka dizininden seçer', () => {
  const s = secMuzik({
    markaDizin: 'assets/music/ciltkodu', kokDizin: 'assets/music',
    fs: fs({'assets/music/ciltkodu': ['a.mp3', 'b.mp3']}), gecmis: [],
  });
  assert.equal(s.dizin, 'assets/music/ciltkodu');
  assert.ok(['a.mp3', 'b.mp3'].includes(s.dosya));
  assert.equal(s.uyari, null);
});

test('ROTASYON: son kullanılan parça tekrar seçilmez', () => {
  const ortak = {
    markaDizin: 'm', kokDizin: 'k',
    fs: fs({m: ['a.mp3', 'b.mp3', 'c.mp3']}),
  };
  assert.notEqual(secMuzik({...ortak, gecmis: ['a.mp3']}).dosya, 'a.mp3');
  // Son iki koşu a ve b ise c gelmeli.
  assert.equal(secMuzik({...ortak, gecmis: ['b.mp3', 'a.mp3']}).dosya, 'c.mp3');
});

test('ROTASYON: tüm parçalar yakın geçmişte kullanıldıysa yine de bir şey döner', () => {
  const s = secMuzik({
    markaDizin: 'm', kokDizin: 'k', fs: fs({m: ['a.mp3', 'b.mp3']}),
    gecmis: ['a.mp3', 'b.mp3'],
  });
  assert.ok(s.dosya, 'hepsi yasaklıysa bile sessiz video üretilmemeli');
});

test('ZİNCİR FALLBACK: marka dizini boşsa köke düşer ve UYARIR', () => {
  // ⚠ Bu davranış olmadan hat KIRILIYORDU: run-daily.mjs:267 uygun mp3 yoksa
  // process.exit(1) yapıyor. Marka başına dizin ayrılıp dizin boş kalırsa iki sayfa da
  // yayın yapamaz. Fallback zinciri bunu engelliyor.
  const s = secMuzik({
    markaDizin: 'assets/music/ciltkodu', kokDizin: 'assets/music',
    fs: fs({'assets/music': ['ortak.mp3']}), gecmis: [],
  });
  assert.equal(s.dizin, 'assets/music');
  assert.equal(s.dosya, 'ortak.mp3');
  assert.match(s.uyari, /marka dizini/i);
});

test('ZİNCİR FALLBACK: marka dizini hiç yoksa da köke düşer', () => {
  const s = secMuzik({
    markaDizin: 'yok/dizin', kokDizin: 'assets/music',
    fs: fs({'assets/music': ['ortak.mp3']}), gecmis: [],
  });
  assert.equal(s.dosya, 'ortak.mp3');
});

test('hiçbir yerde parça yoksa null döner — çağıran karar versin', () => {
  const s = secMuzik({markaDizin: 'a', kokDizin: 'b', fs: fs({}), gecmis: []});
  assert.equal(s.dosya, null);
  assert.match(s.uyari, /hiç/i);
});

test('_ önekli dosyalar yok sayılır (test/sentetik tonlar)', () => {
  const s = secMuzik({
    markaDizin: 'm', kokDizin: 'k',
    fs: fs({m: ['_test_tone.mp3', 'gercek.mp3']}), gecmis: [],
  });
  assert.equal(s.dosya, 'gercek.mp3');
});

test('KARA LİSTE: kendi sentezlediğimiz drone seçilmez', () => {
  // byteflow-ambient.mp3 ffmpeg sine+tremolo+lowpass ile üretilmiş 32 kbps bir drone.
  // Güzellik sayfasında tek başına "otomatik üretilmiş" sinyali veriyor.
  const s = secMuzik({
    markaDizin: 'm', kokDizin: 'k',
    fs: fs({m: ['byteflow-ambient.mp3', 'gercek.mp3']}), gecmis: [],
  });
  assert.equal(s.dosya, 'gercek.mp3');
  assert.ok(KARA_LISTE.includes('byteflow-ambient.mp3'));
});

test('KARA LİSTE son çare olmaktan çıkmaz: başka parça yoksa yine de kullanılır', () => {
  // Sessiz video ya da çöken hat, kötü müzikten daha kötüdür.
  const s = secMuzik({
    markaDizin: 'm', kokDizin: 'k', fs: fs({m: ['byteflow-ambient.mp3']}), gecmis: [],
  });
  assert.equal(s.dosya, 'byteflow-ambient.mp3');
  assert.match(s.uyari, /kara liste|sentetik/i);
});

test('mp3 olmayan dosyalar elenir', () => {
  const s = secMuzik({
    markaDizin: 'm', kokDizin: 'k',
    fs: fs({m: ['README.md', 'kapak.png', 'iyi.mp3']}), gecmis: [],
  });
  assert.equal(s.dosya, 'iyi.mp3');
});
