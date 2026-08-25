// Faz 3 — RED. enjekteEt henüz brain/sir-enjekte.mjs'te YOK; bu dosya import hatasıyla
// kırmızı olmalı (docs/plan/cilt-insider-sirlar.md, görev 3.1-3.3).
//
// Fetch mock deseni brain/localize.test.mjs / sir-derinlestir.test.mjs ile aynı ailede:
// fetchFn(url, opts) → {ok, status, json: async () => ({candidates:[{content:{parts:[{text}]}}]})}.
//
// SÖZLEŞME (bu test dosyasının VARSAYDIĞI, modül henüz yokken test yazarının kurduğu kontrat):
// model yanıtı JSON metni şu şekli taşır:
//   {
//     narration: [...],                 // TAM uzunlukta dizi (uçlar dahil, JS uçları YOK SAYAR)
//     scenes: [{steps: [{from,to,packet,color,status}, ...]}, ...],  // TAM step objeleri
//     caption: "...",
//   }
// steps'in from/to/packet/color'ını da taşıması bilinçli: 3.2 "byte aynı" kapısını sınamak için
// JS'in kendi kapısını kurması gerekiyor (model şemayı yanlış/kötü niyetli doldursa bile).
import test from 'node:test';
import assert from 'node:assert/strict';
import {enjekteEt} from './sir-enjekte.mjs';
import {loadBrand} from '../brands/load.mjs';

function gemResponse(obj) {
  return {
    ok: true, status: 200,
    json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(obj)}]}}]}),
  };
}
function failResponse(status = 500) {
  return {ok: false, status, text: async () => `hata ${status}`};
}
function promptOf(call) {
  const body = JSON.parse(call.opts.body);
  return body.contents[0].parts[0].text;
}

// --- fixture: ciltkodu tarzı, kinetik format, minWords=7 maxWords=11, minSteps=maxSteps=3 ---
function makeBaseSpec() {
  return {
    subject: 'retinol',
    title: 'Retinol Gecesi Kabusu',
    hook: 'Retinol gecen seni mahvediyor, sen hâlâ nemlendiriciyi suçluyorsun.',
    takeaway: 'Retinolü suçlama, sabırsızlığını suçla.',
    soru: 'Sen de retinolü bir gecede mi bekliyordun?',
    narration: [
      'Retinol gecen bir kabusa dönüşüyor.',
      'Retinol cildindeki hücrelere yavaş yavaş yeni bir düzen öğretir bugün.',
      'Retinol her gece cildi biraz daha sabırla yeniden şekillendirir aslında.',
      'Retinol kutudan çıkar çıkmaz değil haftalar sonra iş görür.',
      'Retinolü suçlama, sabırsızlığını suçla.',
    ],
    caption: 'Retinol seni öğlene kadar mahvetmiyor, sabırsızlığın mahvediyor.\n'
      + 'Retinol iki-üç haftada iş görmeye başlar, hemen sonuç bekleme.\n'
      + 'Yazan: Derin.\n'
      + 'Takip et: @cilt.kodu — güzellik, pazarlama değil.\n'
      + 'Sen de retinolü bir gecede mi bekliyordun?',
    hashtags: ['#ciltbakimi', '#retinol', '#güzellik'],
    scenes: [
      {
        layout: 'nodes-flow',
        heading: 'Retinol gecede ne yapar',
        nodes: [
          {id: 'gun0', icon: '🌙', label: 'GECE 0'},
          {id: 'hafta1', icon: '📅', label: 'HAFTA 1'},
          {id: 'hafta3', icon: '📅', label: 'HAFTA 3'},
        ],
        steps: [
          {from: 'gun0', to: 'hafta1', packet: 'CILT', color: 'accent', status: 'yüzey hafif kızarır, sabır ister'},
          {from: 'hafta1', to: 'hafta3', packet: 'YENI', color: 'accent', status: 'hücre yenilenmesi hızlanır'},
          {from: 'hafta3', to: 'gun0', packet: 'SONUC', color: 'good', status: 'cilt dokusu belirgin düzelir'},
        ],
      },
    ],
  };
}

const brand = loadBrand('ciltkodu');

// sir sabit (fotoizomerizasyon = tek gerçek mekanizma kelimesi + birkaç yan token)
const SIR_FOTO = {
  konu: 'retinol', tur: 2,
  sir: 'Retinol, ciltte fotoizomerizasyon denen tepkimeyle etkinleşir.',
  neden: 'Bu terim çoğu tüketici içeriğinde geçmiyor.',
  googleSorgu: 'retinol fotoizomerizasyon',
};

// sir'in özneden başka HİÇ ayırt edici tokenı yok (yalnız GENERIC/özne kelimeleri) — (o) için
const SIR_TOKENSIZ = {
  konu: 'retinol', tur: 1,
  sir: 'Retinolün asit ve serum ile cilt bakımı.',
  neden: 'Genel bir tanım, mekanizma değil.',
  googleSorgu: 'retinol cilt bakımı',
};

function stepsOf(spec) { return spec.scenes[0].steps; }

function respBody({narration, steps, caption}) {
  return {narration, scenes: [{steps}], caption};
}

// -----------------------------------------------------------------------------------------
test('(a) mutlu yol — gövde + status + caption değişir, uçlar donmuş kalır → tam', async () => {
  const spec = makeBaseSpec();
  const specClone = structuredClone(spec);
  const newNarration = [
    spec.narration[0],
    'Retinol ciltte fotoizomerizasyon denen tepkimeyle hızla etkinleşir.',
    'Retinol bu tepkimeden sonra hücrelere yeni bir mesaj yollar aslında.',
    'Retinol haftalar içinde cildi gözle görülür şekilde değiştirir yine de.',
    spec.narration[4],
  ];
  const newSteps = [
    {...stepsOf(spec)[0], status: 'fotoizomerizasyon tetiklenir'},
    {...stepsOf(spec)[1], status: 'hücre yenilenmesi hızlanır'},
    {...stepsOf(spec)[2], status: 'cilt dokusu belirgin düzelir'},
  ];
  const newCaption = 'Retinol seni öğlene kadar mahvetmiyor, fotoizomerizasyon süreci mahvediyor.\n'
    + 'Retinol iki-üç haftada iş görmeye başlar, hemen sonuç bekleme.\n'
    + 'Yazan: Derin.\n'
    + 'Takip et: @cilt.kodu — güzellik, pazarlama değil.\n'
    + 'Sen de retinolü bir gecede mi bekliyordun?';

  const fetchFn = async () => gemResponse(respBody({narration: newNarration, steps: newSteps, caption: newCaption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});

  assert.equal(result.uygulandi, 'tam');
  assert.equal(result.spec.narration[1], newNarration[1]);
  assert.equal(result.spec.narration[2], newNarration[2]);
  assert.equal(result.spec.narration[3], newNarration[3]);
  assert.equal(result.spec.scenes[0].steps[0].status, 'fotoizomerizasyon tetiklenir');
  assert.equal(result.spec.caption, newCaption);
  // donmuş uçlar
  assert.equal(result.spec.hook, spec.hook);
  assert.equal(result.spec.takeaway, spec.takeaway);
  assert.equal(result.spec.narration[0], spec.narration[0]);
  assert.equal(result.spec.narration[4], spec.narration[4]);
  assert.equal(result.spec.subject, spec.subject);
  assert.deepEqual(result.spec.scenes[0].nodes, spec.scenes[0].nodes);
  // girdi mutasyona uğramadı
  assert.deepEqual(spec, specClone);
});

test('(b) narration sayısı değişirse geri alınır', async () => {
  const spec = makeBaseSpec();
  const brokenNarration = [spec.narration[0], spec.narration[1], spec.narration[2], spec.narration[4]]; // 4 değil 5
  const fetchFn = async () => gemResponse(respBody({narration: brokenNarration, steps: stepsOf(spec), caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.deepEqual(result.spec, spec);
});

test('(c) narration[0] VEYA narration[son] değişirse geri alınır', async () => {
  const spec = makeBaseSpec();
  const tamperedHead = [...spec.narration];
  tamperedHead[0] = 'Retinol bambaşka bir açılış cümlesi oldu birden.';
  const fetchFn1 = async () => gemResponse(respBody({narration: tamperedHead, steps: stepsOf(spec), caption: spec.caption}));
  const r1 = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn: fetchFn1});
  assert.equal(r1.uygulandi, 'geri-alindi');
  assert.equal(r1.spec.narration[0], spec.narration[0]);

  const tamperedTail = [...spec.narration];
  tamperedTail[4] = 'Retinolü artık suçlamıyorum, tamamen başka bir final.';
  const fetchFn2 = async () => gemResponse(respBody({narration: tamperedTail, steps: stepsOf(spec), caption: spec.caption}));
  const r2 = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn: fetchFn2});
  assert.equal(r2.uygulandi, 'geri-alindi');
  assert.equal(r2.spec.narration[4], spec.narration[4]);
});

test('(d) gövde cümlesi 6 kelimeye düşerse (minWords=7) geri alınır', async () => {
  const spec = makeBaseSpec();
  const shortNarration = [...spec.narration];
  shortNarration[1] = 'Retinol cilde yavaşça yeni bir düzen verir.'; // 7 -> hedef 6 kelimeye indir
  // tam 6 kelimeye indir:
  shortNarration[1] = 'Retinol cilde yavaşça yeni düzen verir.'; // Retinol,cilde,yavasca,yeni,duzen,verir = 6
  const fetchFn = async () => gemResponse(respBody({narration: shortNarration, steps: stepsOf(spec), caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.equal(result.spec.narration[1], spec.narration[1]);
});

test('(e) hook/takeaway girdiyle byte birebir aynı kalır (model bunları da değiştirmeye çalışsa bile)', async () => {
  const spec = makeBaseSpec();
  const newSteps = [
    {...stepsOf(spec)[0], status: 'fotoizomerizasyon tetiklenir'},
    stepsOf(spec)[1],
    stepsOf(spec)[2],
  ];
  const newNarration = [...spec.narration];
  newNarration[1] = 'Retinol ciltte fotoizomerizasyon denen tepkimeyle hızla etkinleşir.';
  const malicious = {
    ...respBody({narration: newNarration, steps: newSteps, caption: spec.caption}),
    hook: 'HACKLENMİŞ HOOK METNİ',
    takeaway: 'HACKLENMİŞ TAKEAWAY METNİ',
  };
  const fetchFn = async () => gemResponse(malicious);
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.spec.hook, spec.hook);
  assert.equal(result.spec.takeaway, spec.takeaway);
});

test('(f) status 41 karakter olursa steps geri alınır (limit 40)', async () => {
  const spec = makeBaseSpec();
  const longStatus = 'x'.repeat(41);
  assert.equal(longStatus.length, 41);
  const brokenSteps = [{...stepsOf(spec)[0], status: longStatus}, stepsOf(spec)[1], stepsOf(spec)[2]];
  const fetchFn = async () => gemResponse(respBody({narration: spec.narration, steps: brokenSteps, caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.deepEqual(result.spec.scenes[0].steps, stepsOf(spec));
});

test('(g) packet/from/to değişirse steps geri alınır', async () => {
  const spec = makeBaseSpec();
  const brokenSteps = [
    {...stepsOf(spec)[0], packet: 'BASKA', status: 'fotoizomerizasyon tetiklenir'},
    stepsOf(spec)[1],
    stepsOf(spec)[2],
  ];
  const fetchFn = async () => gemResponse(respBody({narration: spec.narration, steps: brokenSteps, caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.deepEqual(result.spec.scenes[0].steps, stepsOf(spec));
});

test('(h) tagline düşerse caption geri alınır', async () => {
  const spec = makeBaseSpec();
  const newNarration = [...spec.narration];
  newNarration[1] = 'Retinol ciltte fotoizomerizasyon denen tepkimeyle hızla etkinleşir.';
  const newSteps = [{...stepsOf(spec)[0], status: 'fotoizomerizasyon tetiklenir'}, stepsOf(spec)[1], stepsOf(spec)[2]];
  const captionNoTagline = 'Retinol beklediğinden yavaş çalışır, sabırsızlık suçlu.\n'
    + 'Yazan: Derin.\n'
    + 'Sen de retinolü bir gecede mi bekliyordun?'; // tagline satırı yok
  const fetchFn = async () => gemResponse(respBody({narration: newNarration, steps: newSteps, caption: captionNoTagline}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.spec.caption, spec.caption, 'tagline eksikse caption orijinaline dönmeli');
});

test('(i) İngilizce çıktı → looksLocalized false → tamamı geri alınır', async () => {
  const spec = makeBaseSpec();
  const englishNarration = [
    spec.narration[0],
    'Retinol triggers photoisomerization in the skin quickly today.',
    'Retinol then sends a fresh signal to skin cells now.',
    'Retinol visibly changes skin texture within a few weeks.',
    spec.narration[4],
  ];
  const englishSteps = [
    {...stepsOf(spec)[0], status: 'photoisomerization triggers fast'},
    {...stepsOf(spec)[1], status: 'cell renewal speeds up'},
    {...stepsOf(spec)[2], status: 'skin texture clearly improves'},
  ];
  const fetchFn = async () => gemResponse(respBody({narration: englishNarration, steps: englishSteps, caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.deepEqual(result.spec, spec);
});

test('(j) fetch hatası → girdi AYNEN + geri-alindi', async () => {
  const spec = makeBaseSpec();
  const fetchFn = async () => failResponse(500);
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn, retries: 0});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.deepEqual(result.spec, spec);
});

test('(k) çıktı girdiyle aynıysa → geri-alindi', async () => {
  const spec = makeBaseSpec();
  const fetchFn = async () => gemResponse(respBody({narration: spec.narration, steps: stepsOf(spec), caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
});

test('(l) yalnız caption geri alınıp gövde kabul edilirse → kismi', async () => {
  const spec = makeBaseSpec();
  const newNarration = [...spec.narration];
  newNarration[1] = 'Retinol ciltte fotoizomerizasyon denen tepkimeyle hızla etkinleşir.';
  const newSteps = [{...stepsOf(spec)[0], status: 'fotoizomerizasyon tetiklenir'}, stepsOf(spec)[1], stepsOf(spec)[2]];
  const captionNoTagline = 'Retinol beklediğinden yavaş çalışır, sabırsızlık suçlu.\n'
    + 'Yazan: Derin.\n'
    + 'Sen de retinolü bir gecede mi bekliyordun?';
  const fetchFn = async () => gemResponse(respBody({narration: newNarration, steps: newSteps, caption: captionNoTagline}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'kismi');
  assert.equal(result.spec.narration[1], newNarration[1], 'gövde kabul edilmiş olmalı');
  assert.equal(result.spec.caption, spec.caption, 'caption geri alınmış olmalı');
});

// --- İZ KAPISI (m,n,o) ---------------------------------------------------------------------
// FIXTURE KURULUMU (kritik nokta): gövde CANLI koşulun aynısı — özne ("retinol") HER cümlede
// geçiyor (video zaten o özne hakkında olduğu için doğal olarak geçer). subjectsClash bu yüzden
// kullanılamaz: özne her iki tarafta da geçtiği için hep true dönerdi. Test bunun yerine, sırrın
// TEK gerçek ayırt edici tokenı olan "fotoizomerizasyon"un gövde+status'ta HİÇ geçmediği bir
// gövde kuruyor — bu, kapı olmasaydı yeşil yanacak (bayt değişti diye 'tam'/'kismi' dönecek) tam
// da canlıdaki kusurlu senaryo.
test("(m) gövde özneyi içerir ama sırrın mekanizma kelimesini içermezse → geri-alindi, sebep 'iz-yok'", async () => {
  const spec = makeBaseSpec();
  const narrationOzneVarIzYok = [
    spec.narration[0],
    'Retinol cildin en dış katmanında hafifçe iş görmeye başlar hemen.',
    'Retinol her hafta cildi biraz daha görünür şekilde tazeler yine.',
    'Retinol ilk günlerde hafif pullanma dışında belirti göstermez genelde.',
    spec.narration[4],
  ];
  const stepsIzYok = [
    {...stepsOf(spec)[0], status: 'ilk günler hafif kızarıklık görülür'},
    {...stepsOf(spec)[1], status: 'hücre döngüsü haftalar içinde hızlanır'},
    {...stepsOf(spec)[2], status: 'cilt dokusu belirgin şekilde düzelir'},
  ];
  const captionValid = 'Retinol seni öğlene kadar mahvetmiyor, beklentin mahvediyor.\n'
    + 'Retinol haftalar içinde iş görür, hemen sonuç bekleme.\n'
    + 'Yazan: Derin.\n'
    + 'Takip et: @cilt.kodu — güzellik, pazarlama değil.\n'
    + 'Sen de retinolü bir gecede mi bekliyordun?';
  const fetchFn = async () => gemResponse(respBody({narration: narrationOzneVarIzYok, steps: stepsIzYok, caption: captionValid}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.equal(result.sebep, 'iz-yok');
  assert.deepEqual(result.spec, spec, 'yapısal olarak geçerli caption bile TÜMÜYLE geri alınmalı');
});

test('(n) sırrın tek mekanizma kelimesi eklenince iz kapısı geçer', async () => {
  const spec = makeBaseSpec();
  const narrationIzVar = [
    spec.narration[0],
    'Retinol cildin en dış katmanında fotoizomerizasyon ile başlar hemen.', // mekanizma kelimesi eklendi
    'Retinol her hafta cildi biraz daha görünür şekilde tazeler yine.',
    'Retinol ilk günlerde hafif pullanma dışında belirti göstermez genelde.',
    spec.narration[4],
  ];
  const stepsIzVar = [
    {...stepsOf(spec)[0], status: 'ilk günler hafif kızarıklık görülür'},
    {...stepsOf(spec)[1], status: 'hücre döngüsü haftalar içinde hızlanır'},
    {...stepsOf(spec)[2], status: 'cilt dokusu belirgin şekilde düzelir'},
  ];
  const captionValid = 'Retinol seni öğlene kadar mahvetmiyor, beklentin mahvediyor.\n'
    + 'Retinol haftalar içinde iş görür, hemen sonuç bekleme.\n'
    + 'Yazan: Derin.\n'
    + 'Takip et: @cilt.kodu — güzellik, pazarlama değil.\n'
    + 'Sen de retinolü bir gecede mi bekliyordun?';
  const fetchFn = async () => gemResponse(respBody({narration: narrationIzVar, steps: stepsIzVar, caption: captionValid}));
  const result = await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn});
  assert.notEqual(result.uygulandi, 'geri-alindi');
  assert.notEqual(result.sebep, 'iz-yok');
  assert.equal(result.spec.narration[1], narrationIzVar[1]);
});

test("(o) sır özneden başka ayırt edici token taşımıyorsa → 'iz-yok' (gövde geçerli olsa bile)", async () => {
  const spec = makeBaseSpec();
  const newNarration = [...spec.narration];
  newNarration[1] = 'Retinol her sabah cildi biraz daha görünür şekilde tazeler bugün.';
  const newSteps = [stepsOf(spec)[0], stepsOf(spec)[1], stepsOf(spec)[2]];
  const fetchFn = async () => gemResponse(respBody({narration: newNarration, steps: newSteps, caption: spec.caption}));
  const result = await enjekteEt({spec, sir: SIR_TOKENSIZ, brand, apiKey: 'k', fetchFn});
  assert.equal(result.uygulandi, 'geri-alindi');
  assert.equal(result.sebep, 'iz-yok');
});

// --- izolasyon (p) --------------------------------------------------------------------------
test('(p) izolasyon — ciltkodu promptunda kizlarkodu domain kelimeleri yok', async () => {
  const spec = makeBaseSpec();
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({url, opts}); return failResponse(500); };
  await enjekteEt({spec, sir: SIR_FOTO, brand, apiKey: 'k', fetchFn, retries: 0});
  assert.ok(calls.length >= 1, 'en az bir çağrı yapılmalı');
  const prompt = calls.map(promptOf).join('\n');
  assert.ok(!/kumaş|moda|RAG|LLM|MCP/i.test(prompt), 'ciltkodu promptunda kizlarkodu/byteflow domain kelimeleri OLMAMALI');
});

test('(p) izolasyon — kizlarkodu promptunda ciltkodu domain kelimeleri yok', async () => {
  const kkBrand = loadBrand('kizlarkodu');
  const kkSpec = {
    subject: 'kumaş',
    title: 'Tişört Beşinci Yıkamada Terk Ediyor',
    hook: 'O siyah tişört beşinci yıkamada seni terk ediyor, sen hâlâ deterjanı suçluyorsun.',
    takeaway: 'Kumaş suçlu değil, etiketi okumayan biziz.',
    soru: 'Sen de siyahın griye döndüğünü fark ettin mi?',
    narration: [
      'Tişört beşinci yıkamada seni terk ediyor.',
      'Kumaş her yıkamada biraz daha yüzeyini kaybediyor aslında.',
      'Kumaş suyla temas ettikçe boyasının bir kısmını bırakıyor yine.',
      'Kumaş birkaç ay içinde ilk günkü tonunu tamamen kaybediyor.',
      'Kumaş suçlu değil, etiketi okumayan biziz.',
    ],
    caption: 'Siyah tişörtün neden griye döndüğü, adım adım.\n'
      + 'Kumaş suçlu değil, etiketi okumayan biziz.\n'
      + 'Yazan: Ece.\n'
      + 'Takip et: @kizlar.kodu — her şeyin bir sebebi var.\n'
      + 'Sen de siyahın griye döndüğünü fark ettin mi?',
    hashtags: ['#giyim', '#kumaş', '#moda'],
    scenes: [{
      layout: 'nodes-flow',
      heading: 'Tişört neden griye döner',
      nodes: [
        {id: 'yikama1', icon: '🧺', label: 'YIKAMA 1'},
        {id: 'yikama5', icon: '🧺', label: 'YIKAMA 5'},
        {id: 'ay3', icon: '📅', label: '3. AY'},
      ],
      steps: [
        {from: 'yikama1', to: 'yikama5', packet: 'BOYA', color: 'warn', status: 'yüzey boyası suya karışır'},
        {from: 'yikama5', to: 'ay3', packet: 'TON', color: 'warn', status: 'ton bir basamak aşağı kayar'},
        {from: 'ay3', to: 'yikama1', packet: 'SONUC', color: 'good', status: 'griye dönüş netleşir'},
      ],
    }],
  };
  const kkSir = {
    konu: 'kumaş', tur: 1,
    sir: 'Polyester karışımlı siyah kumaşta boya lifin üstünde durur, içine işlemez.',
    neden: 'Etiket bunu söylemez.', googleSorgu: 'polyester boya migrasyonu',
  };
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({url, opts}); return failResponse(500); };
  await enjekteEt({spec: kkSpec, sir: kkSir, brand: kkBrand, apiKey: 'k', fetchFn, retries: 0});
  assert.ok(calls.length >= 1, 'en az bir çağrı yapılmalı');
  const prompt = calls.map(promptOf).join('\n');
  assert.ok(!/retinol|gözenek|SPF/i.test(prompt), 'kizlarkodu promptunda ciltkodu domain kelimeleri OLMAMALI');
});
