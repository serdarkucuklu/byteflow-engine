// Faz 1 — RED. sirBul henüz brain/sir-derinlestir.mjs'te YOK; bu dosya import hatasıyla
// kırmızı olmalı. Fetch mock deseni brain/localize.test.mjs'ten alındı (fetchFn: async () =>
// ({ok, status, text: async () => ...})); istek gövdesi şekli brain/generate-spec.mjs'in
// generateSpec()'i ile aynıdır (contents[0].parts[0].text — Gemini generateContent).
import test from 'node:test';
import assert from 'node:assert/strict';
import {sirBul} from './sir-derinlestir.mjs';

function gemResponse(obj) {
  return {
    ok: true,
    status: 200,
    json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(obj)}]}}]}),
    text: async () => JSON.stringify(obj),
  };
}

function failResponse(status = 500) {
  return {ok: false, status, text: async () => `hata ${status}`};
}

function promptOf(call) {
  const body = JSON.parse(call.opts.body);
  return body.contents[0].parts[0].text;
}

const brand = {
  handle: '@cilt.kodu',
  language: 'tr',
  namedExamples: '"retinol", "niasinamid"',
  examples: {domain: 'skincare AND makeup, explained at the mechanism level'},
};
const pillar = {key: 'actives', focus: 'etken madde mekanizmaları'};

test('(a) tam turSayisi kadar fetch çağrısı yapılır', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({url, opts});
    return gemResponse({sir: `sir-${calls.length}`, neden: 'çünkü', googleSorgu: `sorgu-${calls.length}`});
  };
  const sonuc = await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 3, butceMs: 40000, fetchFn});
  assert.equal(calls.length, 3, 'tam turSayisi kadar fetch çağrılmalı');
  assert.ok(sonuc);
});

test('(b) SON tur (en derini) döner', async () => {
  const cevaplar = [
    {sir: 'yüzeysel bilgi', neden: 'çünkü yüzeysel', googleSorgu: 'yüzey sorgu'},
    {sir: 'derin mekanizma', neden: 'çünkü derin', googleSorgu: 'derin sorgu'},
  ];
  let i = 0;
  const fetchFn = async () => gemResponse(cevaplar[i++]);
  const sonuc = await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 2, butceMs: 40000, fetchFn});
  assert.equal(sonuc.sir, 'derin mekanizma', 'ilk tur değil son tur dönmeli');
  assert.equal(sonuc.tur, 2);
});

test("(c) tur 2 promptu tur 1'in sir ve googleSorgu metnini içerir", async () => {
  const calls = [];
  const cevaplar = [
    {sir: 'MEKANIZMA_TUR1_XYZ', neden: 'çünkü', googleSorgu: 'GOOGLE_SORGU_TUR1_ABC'},
    {sir: 'MEKANIZMA_TUR2', neden: 'çünkü', googleSorgu: 'GOOGLE_SORGU_TUR2'},
  ];
  const fetchFn = async (url, opts) => {
    calls.push({url, opts});
    return gemResponse(cevaplar[calls.length - 1]);
  };
  await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 2, butceMs: 40000, fetchFn});
  assert.equal(calls.length, 2);
  const tur2Prompt = promptOf(calls[1]);
  assert.ok(tur2Prompt.includes('MEKANIZMA_TUR1_XYZ'), "tur1'in sirri tur2 promptunda geçmeli");
  assert.ok(tur2Prompt.includes('GOOGLE_SORGU_TUR1_ABC'), "tur1'in googleSorgusu tur2 promptunda geçmeli");
});

test('(d) 2 ardışık fetch hatası → null (throw yok)', async () => {
  const fetchFn = async () => failResponse(500);
  const sonuc = await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 2, butceMs: 40000, fetchFn});
  assert.equal(sonuc, null);
});

test('(e) bütçe aşımı erken durdurur ve eldekini döner', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({url, opts});
    return gemResponse({sir: 'tek-tur', neden: 'çünkü', googleSorgu: 'sorgu'});
  };
  const sonuc = await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 3, butceMs: -1, fetchFn});
  assert.equal(calls.length, 1, 'bütçe zaten aşılmış olduğu için 2. tura hiç geçilmemeli');
  assert.equal(sonuc.sir, 'tek-tur');
  assert.equal(sonuc.tur, 1);
});

test('(f) 1. tur hatalıysa 2. tur yine koşar', async () => {
  let n = 0;
  const fetchFn = async () => {
    n++;
    if (n === 1) return failResponse(500);
    return gemResponse({sir: 'tur2-basarili', neden: 'çünkü', googleSorgu: 'sorgu-2'});
  };
  const sonuc = await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 2, butceMs: 40000, fetchFn});
  assert.equal(n, 2, 'tek izole hata ikinci turu engellememeli');
  assert.ok(sonuc, 'iki tur da denenmiş, ikincisi başarılı — null dönmemeli');
  assert.equal(sonuc.sir, 'tur2-basarili');
});

test("(g1) brief verilince acilis/kapanis metinleri prompt'ta birebir geçer", async () => {
  const brief = {acilis: 'AÇILIŞ_MARKER_QWE9', kapanis: 'KAPANIŞ_MARKER_RTY8', status: ['adım 1', 'adım 2', 'adım 3']};
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({url, opts});
    return gemResponse({sir: 'sir', neden: 'çünkü', googleSorgu: 'sorgu'});
  };
  await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, brief, turSayisi: 1, butceMs: 40000, fetchFn});
  const prompt = promptOf(calls[0]);
  assert.ok(prompt.includes(brief.acilis), 'acilis metni prompt içinde byte birebir geçmeli');
  assert.ok(prompt.includes(brief.kapanis), 'kapanis metni prompt içinde byte birebir geçmeli');
});

test('(g2) brief verilmezse acilis/kapanis bloğu hiç yok', async () => {
  const brief = {acilis: 'AÇILIŞ_MARKER_QWE9', kapanis: 'KAPANIŞ_MARKER_RTY8', status: ['adım 1', 'adım 2', 'adım 3']};
  const briefliCalls = [];
  const briefsizCalls = [];
  const fetchFnBriefli = async (url, opts) => {
    briefliCalls.push({url, opts});
    return gemResponse({sir: 's', neden: 'ç', googleSorgu: 'g'});
  };
  const fetchFnBriefsiz = async (url, opts) => {
    briefsizCalls.push({url, opts});
    return gemResponse({sir: 's', neden: 'ç', googleSorgu: 'g'});
  };

  await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, brief, turSayisi: 1, butceMs: 40000, fetchFn: fetchFnBriefli});
  await sirBul({konu: 'retinol', pillar, apiKey: 'k', brand, turSayisi: 1, butceMs: 40000, fetchFn: fetchFnBriefsiz});

  const promptBriefli = promptOf(briefliCalls[0]);
  const promptBriefsiz = promptOf(briefsizCalls[0]);
  assert.ok(!promptBriefsiz.includes(brief.acilis), 'brief yoksa acilis metni asla geçemez');
  assert.ok(!promptBriefsiz.includes(brief.kapanis), 'brief yoksa kapanis metni asla geçemez');
  assert.ok(promptBriefli.length > promptBriefsiz.length, 'brief bloğu eklenince prompt uzunluğu ölçülebilir şekilde artmalı');
});
