import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPeopleQuery} from './fetch-footage.mjs';
import {tazeSorgular, gecmisSorgulari} from './broll-tazelik.mjs';

const LISTE = ['cream texture macro', 'serum drop close up', 'cosmetic bottles soft light',
  'marble surface texture', 'clean bathroom tiles light', 'liquid foundation swatch',
  'silk fabric flowing', 'water droplets on glass'];

// ─── İNSAN ENGELİ ────────────────────────────────────────────────────────────
// Güzellik nişinde el/ürün makro çekimleri tam da işleyen şey; eski regex bunları da
// engelliyordu. Yüz/kalabalık engeli KALIYOR (yüzsüz sayfa kimliği).

test('el ve eylem sorguları ARTIK engellenmiyor (güzellik nişinin ana çekimi)', () => {
  for (const q of ['hands applying cream', 'hand holding serum bottle', 'typing on keyboard',
    'working at desk', 'sitting by window', 'smiling reflection']) {
    assert.equal(isPeopleQuery(q), false, `"${q}" engellenmemeli`);
  }
});

test('yüz/kişi/kalabalık HÂLÂ engelleniyor (sayfa yüzsüz kalmalı)', () => {
  for (const q of ['woman face closeup', 'portrait of a girl', 'people in a crowd',
    'young woman smiling', 'person walking', 'team meeting']) {
    assert.equal(isPeopleQuery(q), true, `"${q}" engellenmeli`);
  }
});

// ─── TEKRAR KESİCİ ───────────────────────────────────────────────────────────
// ÖLÇÜLEN SORUN (2026-08-09): @cilt.kodu'nun 21 videosunda "cream texture macro" 11 kez,
// "serum drop close up" 8 kez kullanılmış; 20 ardışık çiftin 14'ünde aynı sorgu tekrar
// ediyor. Sayfayı kaydıran izleyici aynı krem görüntüsünü tekrar tekrar görüyor.

test('gecmisSorgulari: history kayıtlarından "provider:sorgu" ayrıştırır', () => {
  const h = [
    {footage: ['pexels:cream texture macro', 'pexels:serum drop close up']},
    {footage: null},
    {footage: ['pixabay:marble surface texture']},
  ];
  assert.deepEqual(gecmisSorgulari(h, 3),
    ['cream texture macro', 'serum drop close up', 'marble surface texture']);
});

test('gecmisSorgulari: yalnız son N koşuya bakar', () => {
  const h = Array.from({length: 10}, (_, i) => ({footage: [`pexels:q${i}`]}));
  assert.deepEqual(gecmisSorgulari(h, 2), ['q8', 'q9']);
});

test('tazeSorgular: son koşularda kullanılan sorgu DEĞİŞTİRİLİR', () => {
  const out = tazeSorgular({
    istenen: ['cream texture macro', 'serum drop close up'],
    gecmis: ['cream texture macro', 'serum drop close up'],
    liste: LISTE, sec: a => a[0],
  });
  assert.ok(!out.includes('cream texture macro'), out.join(', '));
  assert.ok(!out.includes('serum drop close up'), out.join(', '));
  assert.equal(out.length, 2);
});

test('tazeSorgular: taze sorguya DOKUNMAZ', () => {
  const out = tazeSorgular({
    istenen: ['silk fabric flowing', 'water droplets on glass'],
    gecmis: ['cream texture macro'], liste: LISTE, sec: a => a[0],
  });
  assert.deepEqual(out, ['silk fabric flowing', 'water droplets on glass']);
});

test('tazeSorgular: kendi içinde de tekrar üretmez', () => {
  const out = tazeSorgular({
    istenen: ['cream texture macro', 'cream texture macro', 'cream texture macro'],
    gecmis: ['cream texture macro'], liste: LISTE, sec: a => a[0],
  });
  assert.equal(new Set(out).size, out.length, `tekrar var: ${out.join(', ')}`);
});

test('tazeSorgular: havuz tükenirse yine de sorgu döner (hat kırılmaz)', () => {
  const kucuk = ['a', 'b'];
  const out = tazeSorgular({istenen: ['a', 'b'], gecmis: ['a', 'b'], liste: kucuk, sec: a => a[0]});
  assert.equal(out.length, 2, 'klip indirilemezse video zemini kaybeder — boş dönmemeli');
});

// KAPI: bu test gerçekten kırmızı yanabilir — ardışık iki koşunun kesişimi boş olmalı.
test('KAPI: ardışık iki koşu ortak sorgu KULLANMAZ', () => {
  const kosu1 = tazeSorgular({istenen: ['cream texture macro', 'serum drop close up'],
    gecmis: [], liste: LISTE, sec: a => a[0]});
  const kosu2 = tazeSorgular({istenen: ['cream texture macro', 'serum drop close up'],
    gecmis: kosu1, liste: LISTE, sec: a => a[0]});
  const kesisim = kosu1.filter(q => kosu2.includes(q));
  assert.deepEqual(kesisim, [], `ardışık koşularda ortak sorgu: ${kesisim.join(', ')}`);
});
