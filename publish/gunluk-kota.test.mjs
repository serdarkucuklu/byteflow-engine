import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bugunYayinVarMi, bugunkuYayin, yayinGunu} from './gunluk-kota.mjs';

const AN = new Date('2026-08-03T13:00:00Z');   // 16:00 TR

test('yayinGunu TR gününü verir; UTC gecesi ertesi TR gününe düşer', () => {
  assert.equal(yayinGunu('2026-08-02T16:35:51.358Z'), '2026-08-02');
  assert.equal(yayinGunu('2026-08-02T21:30:00.000Z'), '2026-08-03');
});

test('bugün yayın varsa üretim kapanır', () => {
  const history = [{title: 'A', postedAt: '2026-08-03T08:00:00.000Z'}];
  assert.equal(bugunYayinVarMi(history, AN), true);
  assert.equal(bugunkuYayin(history, AN).title, 'A');
});

test('dünkü yayın bugünü kapatmaz', () => {
  assert.equal(bugunYayinVarMi([{title: 'A', postedAt: '2026-08-02T16:35:00.000Z'}], AN), false);
});

test('onayda bekleyen taslak (postedAt yok) yayın sayılmaz', () => {
  // Serdar'ın senaryosu: dün üretildi, onaylanmadı → bugün hâlâ yayınlanabilir olmalı.
  assert.equal(bugunYayinVarMi([{title: 'bekleyen', date: '2026-08-02'}], AN), false);
});

test('Serdar senaryosu: dünden kalan bugün yayınlandıysa bugünün yenisi pas geçilir', () => {
  const history = [
    {title: 'dünkü üretim', date: '2026-08-02', postedAt: '2026-08-03T09:15:00.000Z'},
  ];
  assert.equal(bugunYayinVarMi(history, AN), true,
    'üretim günü dün olsa da YAYIN bugün → bugünün kotası dolu');
});

test('boş geçmişte üretim serbest', () => {
  assert.equal(bugunYayinVarMi([], AN), false);
  assert.equal(bugunkuYayin([], AN), null);
});
