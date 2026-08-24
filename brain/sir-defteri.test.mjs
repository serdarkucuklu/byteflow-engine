import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sirOku, sirEkle, bilinenSirlar, sirBenzerMi} from './sir-defteri.mjs';

const gecici = () => join(mkdtempSync(join(tmpdir(), 'sir-')), 'x-sirlar.json');

const kayit = (over = {}) => ({
  gun: '2026-08-25',
  konu: 'retinol',
  sir: 'Retinol geceleri UV ile birleşince cildi tahriş eder ve bozunur.',
  neden: 'Kullanıcılar bunu bilmez.',
  kullanildi: true,
  at: new Date().toISOString(),
  ...over,
});

test('bozuk/yok defter dosyası sirOku boş dizi döner', () => {
  const p = gecici();
  writeFileSync(p, '{bu json değil');
  assert.deepEqual(sirOku(p), []);
  assert.deepEqual(sirOku(join(mkdtempSync(join(tmpdir(), 'sir-')), 'yok.json')), []);
});

test('defter en fazla 200 kayıt tutar (200. kırpma)', () => {
  const p = gecici();
  for (let i = 0; i < 205; i++) sirEkle(p, kayit({konu: `konu-${i}`, sir: `sir metni ${i}`}));
  const d = sirOku(p);
  assert.equal(d.length, 200);
  assert.equal(d[0].konu, 'konu-5');
  assert.equal(d[d.length - 1].konu, 'konu-204');
});

test('sirBenzerMi: aynı konuda benzer sır yakalanır', () => {
  const a = 'Retinol geceleri UV ile birleşince cildi tahriş eder ve bozunur.';
  const b = 'Retinol gece UV ile birleşince cildi tahriş eder ve bozunuyor.';
  assert.equal(sirBenzerMi(a, b), true);
});

test('sirBenzerMi: aynı konuda farklı mekanizma geçer (benzer değil)', () => {
  const a = 'Retinol geceleri UV ile birleşince cildi tahriş eder ve bozunur.';
  const b = 'Retinol aslında D vitamini biyosentezinde kullanılan bir öncül moleküldür ve karaciğerde depolanabilir.';
  assert.equal(sirBenzerMi(a, b), false);
});

test('bilinenSirlar: farklı konudaki benzer kelimeli sır çakışmaz', () => {
  const p = gecici();
  const ortakSir = 'Bu etken madde geceleri UV ile birleşince cildi tahriş eder ve bozunur.';
  sirEkle(p, kayit({konu: 'niasinamid', sir: ortakSir}));
  sirEkle(p, kayit({konu: 'retinol', sir: 'Retinol farklı bir mekanizmayla çalışır.'}));
  const bilinen = bilinenSirlar(sirOku(p), 'retinol');
  assert.equal(bilinen.length, 1);
  assert.equal(bilinen[0], 'Retinol farklı bir mekanizmayla çalışır.');
});

test('kullanildi:false kayıtlar bilinenSirlar’a girmez', () => {
  const p = gecici();
  sirEkle(p, kayit({konu: 'retinol', sir: 'Henuz onaylanmamis sir metni.', kullanildi: false}));
  sirEkle(p, kayit({konu: 'retinol', sir: 'Onaylanmis sir metni.', kullanildi: true}));
  const bilinen = bilinenSirlar(sirOku(p), 'retinol');
  assert.deepEqual(bilinen, ['Onaylanmis sir metni.']);
});
