import {test} from 'node:test';
import assert from 'node:assert/strict';
import {yasakTara} from './dene-spec.mjs';

// TR-aware kapı: 'İpek'.toLowerCase() === 'i̇pek' (nokta kalır) — "ipek" ile eşleşmez ve
// yasaklı kelime sessizce kaçar. toLocaleLowerCase('tr') 'İ'→'i' doğru çevirir.
test('büyük İ ile yazılmış yasaklı kelime hook\'ta yakalanır', () => {
  const spec = {title: '', hook: 'İpek bluz kimseye söylemiyor', subject: ''};
  const hits = yasakTara(spec, ['ipek']);
  assert.ok(hits.some(h => h.kelime === 'ipek' && h.alan === 'hook'));
});

// Diğer yön: TR 'I' (noktasız büyük I) → 'ı' (İngilizce kuralda 'i' olurdu ve "ısı" ile
// eşleşmezdi).
test('noktasız büyük I ile yazılmış yasaklı kelime title\'da yakalanır', () => {
  const spec = {title: 'ISI kaybı burada', hook: '', subject: ''};
  const hits = yasakTara(spec, ['ısı']);
  assert.ok(hits.some(h => h.kelime === 'ısı' && h.alan === 'title'));
});

test('yasaklı kelime yalnız subject alanında geçse de yakalanır', () => {
  const spec = {title: 'başka bir şey', hook: 'ilgisiz', subject: 'polyester karışım'};
  const hits = yasakTara(spec, ['polyester']);
  assert.ok(hits.some(h => h.kelime === 'polyester' && h.alan === 'subject'));
});

test('boş yasak listesi hiçbir şey yakalamaz', () => {
  assert.deepEqual(yasakTara({title: 'polyester', hook: '', subject: ''}, []), []);
});

// Gövde (narration/step.status/caption) yasak taramasının DIŞINDA — yasakTara title/hook/
// subject dışına bakmamalı (bkz. dene-spec.mjs 1.7 yorum, plan Tuzaklar).
test('yasaklı kelime yalnız gövdede (title/hook/subject dışında) geçerse yakalanmaz', () => {
  const spec = {title: 'ilgisiz', hook: 'ilgisiz', subject: 'ilgisiz', narration: ['polyester burada']};
  assert.deepEqual(yasakTara(spec, ['polyester']), []);
});
