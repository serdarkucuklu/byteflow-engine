import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {redOku, redEkle, bugunkuRedler, trGunu} from './red-defteri.mjs';

const gecici = () => join(mkdtempSync(join(tmpdir(), 'red-')), 'x-red.json');

test('reddedilen özne deftere yazılır ve okunur', () => {
  const p = gecici();
  assert.deepEqual(redOku(p), []);
  const k = redEkle(p, {subject: 'polyester', twist: 'para', title: 'Polyester Bluz'});
  assert.equal(k.subject, 'polyester');
  assert.equal(redOku(p).length, 1);
});

test('öznesi olmayan deneme deftere girmez', () => {
  const p = gecici();
  assert.equal(redEkle(p, null), null);
  assert.equal(redEkle(p, {title: 'öznesiz'}), null);
  assert.deepEqual(redOku(p), []);
});

test('yalnız BUGÜN reddedilenler yasaklı — dünkü konu serbest', () => {
  const bugun = trGunu();
  const defter = [
    {gun: '2020-01-01', subject: 'gliserin'},
    {gun: bugun, subject: 'polyester'},
    {gun: bugun, subject: 'polyester'},   // aynı gün iki kez reddedildi → tek kayıt
  ];
  assert.deepEqual(bugunkuRedler(defter), ['polyester']);
});

test('bozuk defter üretimi durdurmaz', () => {
  const p = gecici();
  writeFileSync(p, '{bu json değil');
  assert.deepEqual(redOku(p), []);
});

test('defter en fazla 60 kayıt tutar', () => {
  const p = gecici();
  for (let i = 0; i < 65; i++) redEkle(p, {subject: `konu-${i}`});
  const d = redOku(p);
  assert.equal(d.length, 60);
  assert.equal(d[d.length - 1].subject, 'konu-64');
});
