import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localizeSpec, applyTranslation, looksLocalized} from './localize.mjs';
import {validateSpec} from './validate.mjs';

const spec = {
  title: 'Sunscreen Stick Coverage', hook: 'Your sunscreen stick gives zero protection.',
  takeaway: 'Sticks need four passes.', caption: 'Line one.\n\n#a', hashtags: ['#spf'],
  narration: ['One.', 'Two.', 'Three.'],
  scenes: [{
    layout: 'nodes-flow', heading: 'How it fails',
    nodes: [{id: 'a', label: 'SINGLE SWIPE'}, {id: 'b', label: 'THIN FILM'}, {id: 'c', label: '20% SPF'}],
    steps: [{from: 'a', to: 'b', packet: 'GAP', color: 'warn', status: 'leaves micro gaps'}],
  }],
};

test('translation replaces text but never touches structure', () => {
  const out = applyTranslation(spec, {
    title: 'Güneş Kremi Sticki', hook: 'Stick kremin koruma vermiyor.', takeaway: 'Dört kat gerekir.',
    caption: 'Birinci satır.', hashtags: ['#güneşkremi', '#spf'], narration: ['Bir.', 'İki.', 'Üç.'],
    scenes: [{heading: 'Nerede tıkanıyor', labels: ['TEK SÜRÜŞ', 'İNCE FİLM', '%20 SPF'], statuses: ['mikro boşluk bırakır']}],
  });
  assert.equal(out.title, 'Güneş Kremi Sticki');
  assert.deepEqual(out.scenes[0].nodes.map(n => n.id), ['a', 'b', 'c'], 'id değişmemeli');
  assert.equal(out.scenes[0].nodes[0].label, 'TEK SÜRÜŞ');
  assert.equal(out.scenes[0].steps[0].from, 'a', 'bağlantı korunmalı');
  assert.equal(out.scenes[0].steps[0].color, 'warn', 'renk korunmalı');
  assert.equal(out.scenes[0].steps[0].status, 'mikro boşluk bırakır');
  assert.equal(out.scenes[0].layout, 'nodes-flow');
  assert.equal(spec.title, 'Sunscreen Stick Coverage', 'girdi mutasyona uğramamalı');
});

test('a partial or mismatched translation is ignored field by field', () => {
  const out = applyTranslation(spec, {
    title: 'Yeni Başlık', narration: ['Sadece bir cümle'],            // sayı tutmuyor → yoksay
    scenes: [{labels: ['TEK'], statuses: []}],                        // eleman sayısı tutmuyor → yoksay
  });
  assert.equal(out.title, 'Yeni Başlık');
  assert.deepEqual(out.narration, spec.narration, 'cümle sayısı tutmuyorsa çeviri kullanılmaz');
  assert.equal(out.scenes[0].nodes[0].label, 'SINGLE SWIPE');
  assert.equal(validateSpec(out).valid, validateSpec(spec).valid);
});

test('already-localized specs (seeds) are not re-translated', async () => {
  const tr = {...spec, title: 'Retinol cildi hızlandırır', hook: 'Cildini yenilemiyor, sırayı hızlandırıyor.',
    narration: ['Retinol için bir şey.', 'İki.', 'Üç.']};
  assert.equal(looksLocalized(tr, 'tr'), true);
  let called = false;
  const out = await localizeSpec({spec: tr, language: 'tr', apiKey: 'k', fetchFn: async () => { called = true; }});
  assert.equal(called, false, 'seed için API çağrısı yapılmamalı');
  assert.equal(out.title, tr.title);
});

test('a failed translation leaves the spec usable instead of breaking the run', async () => {
  const out = await localizeSpec({spec, language: 'tr', apiKey: 'k', retries: 0,
    fetchFn: async () => ({ok: false, status: 429, text: async () => 'quota'})});
  assert.equal(out.title, spec.title, 'çeviri düşerse yayın yine de çıkar');
});

test('English brands skip localization entirely', async () => {
  let called = false;
  await localizeSpec({spec, language: 'en', apiKey: 'k', fetchFn: async () => { called = true; }});
  assert.equal(called, false);
});
