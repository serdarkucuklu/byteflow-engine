import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ayiklaSeri, profil, bulgular, SINIR} from './retansiyon-denetci.mjs';

// Yardımcı: sabit fps'te verilen mafd dizisinden seri üretir.
const seri = (mafdler, fps = 30) => mafdler.map((m, i) => [(i + 1) / fps, m]);

test('ayiklaSeri: pts_time + mafd çiftlerini eşler, ilk kareyi atar', () => {
  const cikti = [
    'frame:0    pts:0    pts_time:0',
    'lavfi.scd.mafd=0.000',
    'lavfi.scd.score=0.000',
    'frame:1    pts:512  pts_time:0.033',
    'lavfi.scd.mafd=1.250',
    'frame:2    pts:1024 pts_time:0.066',
    'lavfi.scd.mafd=0.100',
  ].join('\n');
  // İlk kare (0s) atılır — önceki karesi olmadığı için mafd'si anlamsız.
  assert.deepEqual(ayiklaSeri(cikti), [[0.033, 1.25], [0.066, 0.1]]);
});

test('ayiklaSeri: boş çıktı boş seri', () => {
  assert.deepEqual(ayiklaSeri(''), []);
});

test('profil: donmuş ekranı yakalar', () => {
  // 30 sn boyunca mafd ~0 → tamamı donuk
  const p = profil(seri(new Array(900).fill(0.01)));
  assert.equal(p.canliKareOrani, 0);
  assert.equal(p.olayHizi, 0);
  assert.ok(p.enUzunDonukSn >= 29, `en uzun donuk ${p.enUzunDonukSn} olmalı ~30`);
});

test('profil: sürekli hareket eden video canlı sayılır (SAĞLIKLI desen 1)', () => {
  const p = profil(seri(new Array(720).fill(1.0)));  // 24 sn, her kare canlı
  assert.equal(p.canliKareOrani, 1);
  // Tek kare aralığından (1/30 sn) büyük donukluk olmamalı.
  assert.ok(p.enUzunDonukSn <= 0.05, `en uzun donuk ${p.enUzunDonukSn}`);
  assert.deepEqual(bulgular(p), [], 'sürekli hareket eden video sınırları geçmeli');
});

test('profil: sık kesmeli video canlı sayılır (SAĞLIKLI desen 2)', () => {
  // 24 sn, 1,2 sn'de bir tek karelik büyük sıçrama — canlı kare oranı düşük ama olay bol.
  // İlk kesme 0,6 sn'de: gerçek bir hook'ta açılış hareketi hemen başlar.
  const mafd = new Array(720).fill(0.02);
  mafd[18] = 15;
  for (let i = 36; i < 720; i += 36) mafd[i] = 15;
  const p = profil(seri(mafd));
  assert.ok(p.canliKareOrani < 0.25, 'canlı kare oranı düşük olmalı');
  assert.ok(p.olayHizi >= SINIR.olayHizi, `olay hızı ${p.olayHizi} sınırı karşılamalı`);
  assert.deepEqual(bulgular(p), [], 'kesmeli video olay hızıyla geçmeli');
});

test('bulgular: ne hareket ne olay varsa şikâyet eder', () => {
  const mafd = new Array(900).fill(0.05);
  for (let i = 150; i < 900; i += 150) mafd[i] = 1.2;   // 5 sn'de bir olay → 0,2/sn
  const p = profil(seri(mafd));
  const b = bulgular(p);
  assert.ok(b.some(x => x.includes('ne sürekli hareket ne de olay')), b.join(' | '));
  assert.ok(b.some(x => x.includes('en uzun donuk')), b.join(' | '));
});

test('bulgular: donuk kuyruk (kapanış kartı çakılı) yakalanır', () => {
  const mafd = new Array(900).fill(1.0);
  for (let i = 600; i < 900; i++) mafd[i] = 0;   // son 10 sn donuk
  const p = profil(seri(mafd));
  assert.ok(p.enUzunDonukSn >= 9.5, `kuyruk donukluğu ${p.enUzunDonukSn}`);
  assert.ok(bulgular(p).some(x => x.includes('en uzun donuk')));
});

test('bulgular: donuk açılış (hook kilitlenmesi) yakalanır', () => {
  const mafd = new Array(720).fill(1.0);
  for (let i = 0; i < 90; i++) mafd[i] = 0;   // ilk 3 sn donuk
  const p = profil(seri(mafd));
  assert.ok(p.acilisDonukSn >= 2.9, `açılış donukluğu ${p.acilisDonukSn}`);
  assert.ok(bulgular(p).some(x => x.includes('hook kilitleniyor')));
});

test('bulgular: uzun video süre sınırına takılır', () => {
  const p = profil(seri(new Array(45 * 30).fill(1.0)));
  assert.ok(bulgular(p).some(x => x.includes('süre')));
});
