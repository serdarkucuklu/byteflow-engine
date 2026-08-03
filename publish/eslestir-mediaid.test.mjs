import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eslestir, uygula, benzerlik, trTarih, medyaListesi} from './eslestir-mediaid.mjs';

const cap = (t) => `${t}\n\n1. Bir şey — açıklama.\n\nTakip et: @cilt.kodu`;

test('trTarih ISO damgasını TR yerel gününe çevirir (UTC gece yarısı taşması dahil)', () => {
  assert.equal(trTarih('2026-08-02T16:35:00+0000'), '2026-08-02');
  // 22:30 UTC = ertesi gün 01:30 TR — yayın günü TR'ye göre kaymalı.
  assert.equal(trTarih('2026-08-02T22:30:00+0000'), '2026-08-03');
});

test('benzerlik ayırt edici kökleri sayar, herkeste geçen kelimeleri saymaz', () => {
  const kayit = {title: 'Mikroakım Cihazı vs Retinol', subject: 'mikroakım cihazı'};
  const dogru = {caption: cap('Retinol yerine mikroakım cihazına ömür gömenler?')};
  // "serum/cilt/bakım" jenerik kelimeler; tek başlarına puan üretmemeli.
  const yanlis = {caption: cap('Cilt bakım serumu üzerine bir ürün incelemesi.')};
  assert.ok(benzerlik(kayit, dogru) >= 0.5);
  assert.equal(benzerlik(kayit, yanlis), 0);
});

test('eslestir doğru medyayı bulur, mediaId dolu kayda dokunmaz', () => {
  const history = [
    {title: 'Gliserin: Nem Çeken Basit Mucize', subject: 'gliserin', date: '2026-08-02'},
    {title: 'Kapatıcı Neden Çizgilere Dolur?', subject: 'kapatıcı', date: '2026-07-28',
      mediaId: 'ZATEN_VAR'},
  ];
  const medya = [
    {id: 'M_GLISERIN', timestamp: '2026-08-02T16:40:00+0000', caption: cap('Gliserin diye bir mucize var')},
    {id: 'M_ALAKASIZ', timestamp: '2026-08-02T16:45:00+0000', caption: cap('Fondöten öğlen seni satıyor')},
  ];
  const {eslesenler, bossular} = eslestir({history, medya});
  assert.deepEqual(eslesenler.map(e => [e.index, e.mediaId]), [[0, 'M_GLISERIN']]);
  assert.equal(bossular.length, 0, 'dolu kayıt aday listesine hiç girmemeli');
});

test('eslestir tarih penceresi dışındaki medyayı almaz', () => {
  const history = [{title: 'Gliserin Mucizesi', subject: 'gliserin', date: '2026-08-02'}];
  const medya = [{id: 'M1', timestamp: '2026-07-20T16:40:00+0000', caption: cap('Gliserin gliserin')}];
  const {eslesenler, bossular} = eslestir({history, medya});
  assert.equal(eslesenler.length, 0);
  assert.equal(bossular[0].sebep, 'aday yok');
});

test('iki aday birbirine çok yakınsa KARAR VERMEZ (belirsiz)', () => {
  const history = [{title: 'Retinol Kusma Dönemi', subject: 'retinol', date: '2026-08-02'}];
  const medya = [
    {id: 'A', timestamp: '2026-08-02T10:00:00+0000', caption: cap('Retinol kusma dönemi nedir')},
    {id: 'B', timestamp: '2026-08-02T18:00:00+0000', caption: cap('Retinol ve kusma dönemi hakkında')},
  ];
  const {eslesenler, belirsizler} = eslestir({history, medya});
  assert.equal(eslesenler.length, 0, 'tahmin yazmaktansa boş bırak');
  assert.equal(belirsizler.length, 1);
  assert.deepEqual(belirsizler[0].adaylar, ['A', 'B']);
});

test('aynı medyayı iki kayıt isterse yüksek puanlı alır, diğeri boşta kalır', () => {
  const history = [
    {title: 'Niasinamid Hakkında Her Şey', subject: 'niasinamid', date: '2026-08-02'},
    {title: 'Niasinamid', subject: 'niasinamid', date: '2026-08-02'},
  ];
  const medya = [{id: 'TEK', timestamp: '2026-08-02T16:00:00+0000',
    caption: cap('Niasinamid hakkında her şey burada')}];
  const {eslesenler, belirsizler} = eslestir({history, medya});
  assert.equal(eslesenler.length, 1, 'bir medya iki kayda yazılamaz');
  assert.equal(belirsizler.length, 1);
  assert.match(belirsizler[0].sebep, /daha yüksek puanla/);
});

test('uygula girdiyi değiştirmez ve postedAt yalnızca boşsa dolar', () => {
  const history = [{title: 'A', date: '2026-08-02', postedAt: 'ESKI'}, {title: 'B', date: '2026-08-02'}];
  const out = uygula(history, [
    {index: 0, mediaId: 'M0', postedAt: 'YENI'},
    {index: 1, mediaId: 'M1', postedAt: 'YENI'},
  ]);
  assert.equal(history[0].mediaId, undefined, 'girdi dizisi bozulmamalı');
  assert.equal(out[0].postedAt, 'ESKI');
  assert.equal(out[1].postedAt, 'YENI');
});

test('medyaListesi sayfalamayı takip eder ve sayfa sınırında durur', async () => {
  const sayfalar = {
    'ilk': {data: [{id: '1'}], paging: {next: 'iki'}},
    'iki': {data: [{id: '2'}], paging: {next: 'uc'}},
    'uc': {data: [{id: '3'}], paging: {next: 'dort'}},
  };
  let ilk = true;
  const fakeFetch = async (url) => {
    const key = ilk ? (ilk = false, 'ilk') : url;
    return {ok: true, json: async () => sayfalar[key] ?? {data: []}};
  };
  const out = await medyaListesi({igUserId: '1', token: 't', fetchFn: fakeFetch, sayfaSiniri: 2});
  assert.deepEqual(out.map(m => m.id), ['1', '2'], 'sayfa sınırı aşılmamalı');
});

test('medyaListesi hatayı yutmaz', async () => {
  const fakeFetch = async () => ({ok: false, status: 400, text: async () => 'bozuk'});
  await assert.rejects(() => medyaListesi({igUserId: '1', token: 't', fetchFn: fakeFetch}),
    /media HTTP 400/);
});

// ── İKİNCİ GEÇİŞ: tam tarih 1:1 zorlaması ─────────────────────────────────────
// Canlı senaryodan alındı: 07-31 ve 08-01'de arka arkaya iki hyalüronik asit postu var,
// caption'lar birbirine benziyor → caption puanı karar veremiyor ama takvim veriyor.
const HYALU = [
  {title: 'Hyalüronik Asit Neden Cildi Kurutur?', subject: 'hyalüronik asit', date: '2026-07-31'},
  {title: 'Hyalüronik Asit: Parayı Neye Ödüyoruz?', subject: 'hyalüronik asit', date: '2026-08-01'},
];
const HYALU_MEDYA = [
  {id: 'M_31', timestamp: '2026-07-31T16:40:00+0000',
    caption: cap('Hyalüronik asit cildini nemlendirmek yerine kurutuyorsa yalnız değilsin')},
  {id: 'M_01', timestamp: '2026-08-01T16:40:00+0000',
    caption: cap('Hyalüronik asit serumuna bin lira verip aslında su satın alıyor olabilirsin')},
];

test('caption ayırt edemediğinde tam tarih 1:1 eşlemeyi kurtarır', () => {
  const {eslesenler} = eslestir({history: HYALU, medya: HYALU_MEDYA});
  assert.deepEqual(eslesenler.map(e => [e.index, e.mediaId]), [[0, 'M_31'], [1, 'M_01']]);
  assert.ok(eslesenler.every(e => e.kaynak === 'tarih-1e1'), 'ikinci geçişten geldiği işaretlenmeli');
});

test('aynı günde iki boş kayıt varsa tarih zorlaması ÇALIŞMAZ (1:1 değil)', () => {
  const history = [
    {title: 'Birinci Konu Hakkinda', subject: 'gliserin', date: '2026-08-01'},
    {title: 'Ikinci Konu Hakkinda', subject: 'gliserin', date: '2026-08-01'},
  ];
  const medya = [{id: 'TEK', timestamp: '2026-08-01T16:00:00+0000', caption: cap('gliserin üzerine')}];
  assert.equal(eslestir({history, medya}).eslesenler.length, 0);
});

test('aynı günde iki boş medya varsa tarih zorlaması ÇALIŞMAZ', () => {
  const history = [{title: 'Gliserin Hakkinda', subject: 'gliserin', date: '2026-08-01'}];
  const medya = [
    {id: 'A', timestamp: '2026-08-01T09:00:00+0000', caption: cap('gliserin sabah')},
    {id: 'B', timestamp: '2026-08-01T19:00:00+0000', caption: cap('gliserin akşam')},
  ];
  assert.equal(eslestir({history, medya}).eslesenler.length, 0);
});

test('tarih tuttuğu hâlde ortak kök yoksa bağ kurulmaz (yabancı post koruması)', () => {
  // Hesabın eski Noble Vision dönemine ait, alakasız bir postla tarih çakışması.
  const history = [{title: 'Retinol Kusma Donemi', subject: 'retinol', date: '2026-08-01'}];
  const medya = [{id: 'ESKI', timestamp: '2026-08-01T16:00:00+0000',
    caption: cap('Uzayda kesfedilen yeni gezegen hakkinda bilgiler')}];
  assert.equal(eslestir({history, medya}).eslesenler.length, 0);
});

test('ikinci geçiş bağlarsa kayıt belirsiz/boş listelerinde KALMAZ', () => {
  const {eslesenler, belirsizler, bossular} = eslestir({history: HYALU, medya: HYALU_MEDYA});
  const bagli = new Set(eslesenler.map(e => e.index));
  assert.ok(![...belirsizler, ...bossular].some(b => bagli.has(b.index)),
    'aynı kayıt hem eşleşti hem eşleşmedi diye raporlanmamalı');
});
