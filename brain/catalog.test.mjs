import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pickCatalogSubject, unusedCatalog} from './catalog.mjs';
import {pillarsFor} from './pillars.mjs';
import {clashingSubject} from './subjects.mjs';

const C = [
  {subject: 'dikkat körlüğü', pillar: 'erkek-farki', ipucu: 'a'},
  {subject: 'çözüm refleksi', pillar: 'erkek-farki', ipucu: 'b'},
  {subject: 'ferritin', pillar: 'eksiklikler', ipucu: 'c'},
];

test('yasaklı özne katalogdan düşer, kalan kilitlenir', () => {
  const hit = pickCatalogSubject(C, ['dikkat körlüğü']);
  assert.equal(hit.subject, 'çözüm refleksi');
});

test('bugünkü pillar bitmemişse o pillar\'dan seçer', () => {
  const hit = pickCatalogSubject(C, [], null, 'eksiklikler');
  assert.equal(hit.subject, 'ferritin');
});

test('bugünkü pillar tükenmişse başka taze özneye düşer', () => {
  const hit = pickCatalogSubject(C, ['ferritin'], null, 'eksiklikler');
  assert.ok(hit);
  assert.notEqual(hit.subject, 'ferritin');
});

test('hepsi yasaksa null — serbest üretime düşülsün', () => {
  assert.equal(pickCatalogSubject(C, C.map(e => e.subject)), null);
  assert.deepEqual(unusedCatalog(C, C.map(e => e.subject)), []);
});

test('seçici verilirse havuzdan o seçer', () => {
  const hit = pickCatalogSubject(C, [], arr => arr[arr.length - 1]);
  assert.equal(hit.subject, 'ferritin');
});

function loadCatalog(slug) {
  return JSON.parse(readFileSync(new URL(`../brands/catalogs/${slug}.json`, import.meta.url), 'utf8'));
}

for (const [slug, setName] of [['kizlarkodu', 'kizlar-tr'], ['ciltkodu', 'beauty-tr']]) {
  test(`${slug} kataloğu geniş, tekil, pillar havuzuna bağlı`, () => {
    const cat = loadCatalog(slug);
    const keys = pillarsFor(setName).map(p => p.key);
    assert.ok(cat.length >= 40, `${slug}: katalog dar (${cat.length}) — birkaç günde biter`);
    const subjects = cat.map(e => e.subject);
    assert.equal(new Set(subjects).size, subjects.length, `${slug}: tekrarlayan özne`);
    for (const e of cat) {
      assert.ok(e.subject && e.subject.split(/\s+/).length <= 4, `özne 1-4 kelime: ${e.subject}`);
      assert.ok(keys.includes(e.pillar), `${slug}: bilinmeyen pillar "${e.pillar}" (${e.subject})`);
      assert.ok(e.ipucu?.length > 30, `${slug}: ${e.subject} ipucu çok kısa — az bilinen mekanizma yok`);
    }
    for (let i = 0; i < cat.length; i++) {
      for (let j = i + 1; j < cat.length; j++) {
        assert.equal(clashingSubject(cat[i].subject, [cat[j].subject]), null,
          `${slug}: "${cat[i].subject}" ~ "${cat[j].subject}"`);
      }
    }
  });
}

test('kizlar kataloğu cilt ürününe kaymaz', () => {
  const metin = JSON.stringify(loadCatalog('kizlarkodu')).toLowerCase();
  for (const yasak of ['retinol', 'niasinamid', 'gözenek', 'serum', 'güneş kremi']) {
    assert.ok(!metin.includes(yasak), `kizlar kataloğuna kardeş konu sızmış: ${yasak}`);
  }
});

test('cilt kataloğu ilişki psikolojisine kaymaz', () => {
  const metin = JSON.stringify(loadCatalog('ciltkodu')).toLowerCase();
  for (const yasak of ['görüldü bırakma', 'son görülme', 'kıskançlık dm', 'iyiyim kalkanı']) {
    assert.ok(!metin.includes(yasak), `cilt kataloğuna kardeş konu sızmış: ${yasak}`);
  }
});
