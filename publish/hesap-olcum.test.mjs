import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hesapAnlik, hesapMetrikleri, gunuEkle, bugun} from './hesap-olcum.mjs';
import {takipciAtfi, eksenOzeti} from './takipci-raporu.mjs';

test('bugun TR gününü verir (UTC gece yarısı taşması dahil)', () => {
  assert.equal(bugun(new Date('2026-08-02T22:30:00Z')), '2026-08-03');
});

test('hesapAnlik takipçi ve post sayısını okur', async () => {
  const fakeFetch = async (url) => {
    assert.match(url, /fields=followers_count,media_count/);
    return {ok: true, json: async () => ({followers_count: 1240, media_count: 17})};
  };
  assert.deepEqual(await hesapAnlik({igUserId: '9', token: 't', fetchFn: fakeFetch}),
    {followers: 1240, mediaCount: 17});
});

test('bir metrik düşerse diğerleri yaşar ve düşen HATA olarak döner', async () => {
  // Tam olarak `plays` faciasının tekrarı: tek istekte olsaydı hepsi kaybolurdu.
  const fakeFetch = async (url) => {
    if (url.includes('metric=profile_views')) {
      return {ok: false, status: 400, text: async () => 'metric no longer supported'};
    }
    return {ok: true, json: async () => ({data: [{values: [{value: 42}]}]})};
  };
  const {metrikler, hatalar} = await hesapMetrikleri({igUserId: '9', token: 't', fetchFn: fakeFetch});
  assert.equal(metrikler.reach, 42, 'sağlam metrik hayatta kalmalı');
  assert.equal(metrikler.profile_views, undefined);
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /profile_views.*400/);
});

test('total_value biçimli metrik de okunur', async () => {
  const fakeFetch = async () => ({ok: true, json: async () => ({data: [{total_value: {value: 7}}]})});
  const {metrikler} = await hesapMetrikleri({igUserId: '9', token: 't', fetchFn: fakeFetch,
    metrikler: [{ad: 'follows_and_unfollows', params: 'period=day&metric_type=total_value'}]});
  assert.equal(metrikler.follows_and_unfollows, 7);
});

test('gunuEkle aynı günü üzerine yazar ve sırayı korur', () => {
  const out = gunuEkle([{date: '2026-08-01', followers: 10}, {date: '2026-08-02', followers: 20}],
    {date: '2026-08-01', followers: 99});
  assert.deepEqual(out.map(k => [k.date, k.followers]), [['2026-08-01', 99], ['2026-08-02', 20]]);
});

const GUNLER = [
  {date: '2026-08-02', followers: 1000},
  {date: '2026-08-03', followers: 1030},
  {date: '2026-08-04', followers: 1075},
];

test('takipciAtfi yayın gününden pencere sonuna farkı alır', () => {
  const history = [{date: '2026-08-02', postedAt: '2026-08-02T16:40:00+0000', title: 'A',
    pillar: 'para-degeri', twist: 'para', insights: {views: 1500, saved: 12}}];
  const [s] = takipciAtfi({history, gunler: GUNLER});
  assert.equal(s.delta, 75, '1075 − 1000');
  assert.equal(s.izlenmeBasina, 20, '1500 izlenme / 75 takip');
});

test('ölçüm yoksa delta UYDURULMAZ (null döner)', () => {
  const history = [{date: '2026-08-09', postedAt: '2026-08-09T16:40:00+0000', title: 'B'}];
  const [s] = takipciAtfi({history, gunler: GUNLER});
  assert.equal(s.delta, null);
  assert.equal(s.izlenmeBasina, null);
});

test('pencere günü ölçülmemişse sonraki güne düşer (koşu atlanmış olabilir)', () => {
  const gunler = [{date: '2026-08-02', followers: 1000}, {date: '2026-08-05', followers: 1090}];
  const history = [{date: '2026-08-02', postedAt: '2026-08-02T16:40:00+0000', title: 'A'}];
  assert.equal(takipciAtfi({history, gunler})[0].delta, 90);
});

test('yayınlanmamış kayıt rapora hiç girmez', () => {
  assert.equal(takipciAtfi({history: [{date: '2026-08-02', title: 'taslak'}], gunler: GUNLER}).length, 0);
});

test('eksenOzeti gaf eksenine göre toplar ve takipçiye göre sıralar', () => {
  const satirlar = [
    {twist: 'para', delta: 50, views: 1000}, {twist: 'zaman', delta: 10, views: 900},
    {twist: 'para', delta: 30, views: 800}, {twist: 'itiraf', delta: null, views: 500},
  ];
  assert.deepEqual(eksenOzeti(satirlar, 'twist').map(g => [g.anahtar, g.post, g.takipci]),
    [['para', 2, 80], ['zaman', 1, 10]], 'ölçülmemiş satır toplama girmemeli');
});

// ── Canlı doğrulanmış metrik biçimleri (2026-08-03, @byteflowlabs) ────────────
test('profile_views ve reach metric_type=total_value ile istenir', async () => {
  // Onsuz Meta HTTP 400 döndürüyor ("should be specified with parameter metric_type").
  const gorulen = [];
  const fakeFetch = async (url) => {
    gorulen.push(url);
    return {ok: true, json: async () => ({data: [{total_value: {value: 1}}]})};
  };
  await hesapMetrikleri({igUserId: '9', token: 't', fetchFn: fakeFetch});
  const profil = gorulen.find(u => u.includes('metric=profile_views'));
  const erisim = gorulen.find(u => u.includes('metric=reach'));
  assert.match(profil, /metric_type=total_value/);
  assert.match(erisim, /metric_type=total_value/);
});

test('boş dönebilen metrik boş gelince UYARI ÜRETMEZ', async () => {
  // follows_and_unfollows küçük hesaplarda boş dizi dönüyor — hata değil. Her koşuda
  // sahte uyarı basarsa gerçek bozulma gürültüde kaybolur.
  const fakeFetch = async (url) => ({ok: true, json: async () =>
    (url.includes('follows_and_unfollows') ? {data: []} : {data: [{total_value: {value: 5}}]})});
  const {metrikler, hatalar} = await hesapMetrikleri({igUserId: '9', token: 't', fetchFn: fakeFetch});
  assert.deepEqual(hatalar, [], 'boş kırılım hata sayılmamalı');
  assert.equal(metrikler.follows_and_unfollows, undefined);
  assert.equal(metrikler.reach, 5, 'diğer metrikler yine dolmalı');
});

test('boş dönmesi BEKLENMEYEN metrik boş gelirse hata verir', async () => {
  const fakeFetch = async () => ({ok: true, json: async () => ({data: []})});
  const {hatalar} = await hesapMetrikleri({igUserId: '9', token: 't', fetchFn: fakeFetch,
    metrikler: [{ad: 'reach', params: 'period=day&metric_type=total_value'}]});
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /değer yok/);
});
