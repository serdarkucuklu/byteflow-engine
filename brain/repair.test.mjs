import {test} from 'node:test';
import assert from 'node:assert/strict';
import {repairSpec, kirp} from './repair.mjs';
import {validateSpec} from './validate.mjs';

const base = {
  title: 'Claude Code Ships Background Agents',
  caption: 'x', hashtags: ['#claudecode'],
  hook: 'It runs while you sleep.', takeaway: 'Agents are loops with tools.',
};
const diagram = {
  layout: 'nodes-flow', kind: 'diagram',
  nodes: [{id: 'a', label: 'USER'}, {id: 'b', label: 'AGENT'}, {id: 'c', label: 'REPO'}],
  steps: [{from: 'a', to: 'b', packet: 'TASK', status: 'you describe the change'}],
};

test('a code scene with no code body becomes a valid spec instead of a seed fallback', () => {
  const broken = {...base, scenes: [diagram, {layout: 'vertical-stack', kind: 'code', language: 'python', steps: []}]};
  assert.equal(validateSpec(broken).valid, false, 'ham hâli geçersiz olmalı');
  const fixed = repairSpec(broken);
  assert.equal(validateSpec(fixed).valid, true, validateSpec(fixed).errors?.join('; '));
  assert.equal(fixed.scenes.length, 1, 'onarılamayan kod sahnesi düşürülür');
});

test('a code scene WITH code survives untouched', () => {
  const spec = {...base, scenes: [{layout: 'nodes-flow', kind: 'code', language: 'python',
    code: 'agent.run(task)\nagent.verify()', reveal: 'typing'}]};
  const fixed = repairSpec(spec);
  assert.equal(validateSpec(fixed).valid, true);
  assert.equal(fixed.scenes[0].code, 'agent.run(task)\nagent.verify()');
});

test('over-long labels, packets and statuses are trimmed to the schema limits', () => {
  const spec = {...base, scenes: [{
    layout: 'cycle',
    heading: 'x'.repeat(60),
    nodes: [{id: 'a', label: 'A VERY LONG NODE LABEL HERE'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    steps: [{from: 'a', to: 'b', packet: 'TOOLONGPACKET', status: 'y'.repeat(80)}],
  }]};
  const fixed = repairSpec(spec);
  assert.equal(validateSpec(fixed).valid, true, validateSpec(fixed).errors?.join('; '));
  // Sınırı aşmamalı AMA kelimenin ortasından da kesmemeli: "A VERY LONG NODE LABEL HERE"
  // 18 karaktere ham kesilse "A VERY LONG NODE L" olurdu — son tam kelimede durur.
  assert.ok(fixed.scenes[0].nodes[0].label.length <= 18);
  assert.equal(fixed.scenes[0].nodes[0].label, 'A VERY LONG NODE');
  // Boşluksuz tek kelime: kesecek sınır yok, ham kırpma meşru.
  assert.equal(fixed.scenes[0].steps[0].packet, 'TOOLON');
  assert.ok(fixed.scenes[0].steps[0].status.length <= 40);
});

test('hook ve takeaway sınırı aşarsa KIRPILMAZ — yeniden üretilsin diye geçersiz kalır', () => {
  // Gerçek olay (2026-08-08 @cilt.kodu): ham kesme punchline'ı "…etiketlenmeye her z"
  // yapmıştı. Artık kırpmak yerine spec geçersiz kalır ve produceSpec yeniden dener.
  const uzunTakeaway = 'Mendille silip yatarsan, o flaşlı fotoğrafta mum gibi eriyip etiketlenmeye her zaman hazırsın';
  const spec = {...base, takeaway: uzunTakeaway, scenes: [diagram]};
  const fixed = repairSpec(spec);
  assert.equal(fixed.takeaway, uzunTakeaway, 'takeaway dokunulmadan bırakılmalı');
  assert.equal(validateSpec(fixed).valid, false, 'taşan takeaway geçersiz sayılmalı');
});

test('sınır içindeki hook ve takeaway aynen korunur', () => {
  const spec = {...base, hook: 'O siyah tişört beşinci yıkamada seni terk ediyor.',
    takeaway: 'Kumaş suçlu değil, etiketi okumayan biziz.', scenes: [diagram]};
  const fixed = repairSpec(spec);
  assert.equal(fixed.hook, spec.hook);
  assert.equal(fixed.takeaway, spec.takeaway);
  assert.equal(validateSpec(fixed).valid, true, validateSpec(fixed).errors?.join('; '));
});

test('kirp: kelime ortasından kesmez, sondaki yarım noktalamayı temizler', () => {
  assert.equal(kirp('bir iki üç dört', 11), 'bir iki üç');
  assert.equal(kirp('bir iki, üç', 9), 'bir iki');       // sondaki virgül düşer
  assert.equal(kirp('kısa', 20), 'kısa');                 // sınır altındaysa dokunmaz
  assert.equal(kirp('tekcokuzunkelime', 6), 'tekcok');    // boşluk yoksa ham kesme
});

test('steps pointing at a non-existent node are dropped', () => {
  const spec = {...base, scenes: [{...diagram, steps: [
    {from: 'a', to: 'b', packet: 'OK', status: 'real edge'},
    {from: 'a', to: 'ghost', packet: 'BAD', status: 'node does not exist'},
  ]}]};
  const fixed = repairSpec(spec);
  assert.equal(fixed.scenes[0].steps.length, 1);
  assert.equal(validateSpec(fixed).valid, true);
});

test('an already-valid spec is returned unchanged in substance', () => {
  const spec = {...base, scenes: [diagram]};
  const fixed = repairSpec(spec);
  assert.equal(validateSpec(fixed).valid, true);
  assert.deepEqual(fixed.scenes[0].nodes, diagram.nodes);
});

test('repairSpec does not mutate its input', () => {
  const spec = {...base, scenes: [{layout: 'nodes-flow', kind: 'code', language: 'python'}]};
  repairSpec(spec);
  assert.equal(spec.scenes[0].kind, 'code');
});

test('over-dense scenes are simplified, not thrown away', () => {
  const many = (n) => Array.from({length: n}, (_, i) => ({id: `n${i}`, label: `NODE ${i}`}));
  const spec = {...base, scenes: [{
    layout: 'nodes-flow', nodes: many(8),
    steps: Array.from({length: 7}, (_, i) => ({from: `n${i}`, to: `n${i + 1}`, packet: 'P', status: 'moves on'})),
  }]};
  assert.equal(validateSpec(spec).valid, false, 'ham hâli 8 node ile geçersiz');
  const fixed = repairSpec(spec);
  assert.equal(validateSpec(fixed).valid, true, validateSpec(fixed).errors?.join('; '));
  assert.equal(fixed.scenes[0].nodes.length, 5);
  assert.ok(fixed.scenes[0].steps.length <= 4);
  // kırpılan node'lara giden adımlar da düşmeli
  const ids = new Set(fixed.scenes[0].nodes.map(n => n.id));
  assert.ok(fixed.scenes[0].steps.every(st => ids.has(st.from) && ids.has(st.to)));
});

test('a third scene is dropped — 30s cannot teach three diagrams', () => {
  const sc = (h) => ({layout: 'cycle', heading: h, nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    steps: [{from: 'a', to: 'b', packet: 'P', status: 's'}]});
  const fixed = repairSpec({...base, scenes: [sc('one'), sc('two'), sc('three')]});
  assert.equal(fixed.scenes.length, 2);
  assert.equal(validateSpec(fixed).valid, true);
});

test('narration is forced to match the beat structure (hook + steps + close)', () => {
  const spec = {...base, narration: ['Only one line'], scenes: [{
    layout: 'nodes-flow',
    nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    steps: [
      {from: 'a', to: 'b', packet: 'P', status: 'the prompt is sent'},
      {from: 'b', to: 'c', packet: 'Q', status: 'the tool answers'},
    ],
  }]};
  const fixed = repairSpec(spec);
  assert.equal(fixed.narration.length, 5, 'hook + kurulum + 2 adım + kapanış');
  assert.equal(fixed.narration[0], 'Only one line.', 'nokta eklenir');
  assert.match(fixed.narration[1], /2 steps/, 'kurulum cümlesi üretilir');
  assert.match(fixed.narration[2], /prompt is sent\./);
  assert.match(fixed.narration[4], /\.$/);
});

test('narration keeps a well-formed script untouched', () => {
  const script = ['Hook line.', 'Setup line.', 'Step one.', 'Close it.'];
  const fixed = repairSpec({...base, narration: script, scenes: [{
    layout: 'cycle', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    steps: [{from: 'a', to: 'b', packet: 'P', status: 's'}],
  }]});
  assert.deepEqual(fixed.narration, script);
});

test('hashtags are normalised and topped up — a lone tag costs reach', () => {
  const one = repairSpec({...base, hashtags: ['#Microsoft'], scenes: [diagram]});
  assert.ok(one.hashtags.length >= 6, `az etiket: ${one.hashtags.join(' ')}`);
  assert.equal(one.hashtags[0], '#microsoft', 'modelin verdiği etiket başta kalır');
  assert.ok(one.hashtags.every(t => /^#[a-z0-9_]+$/.test(t)), one.hashtags.join(' '));

  const messy = repairSpec({...base, hashtags: ['AI Agents', '#RAG', '#rag', 'llm!'], scenes: [diagram]});
  assert.ok(messy.hashtags.includes('#aiagents'));
  assert.equal(new Set(messy.hashtags).size, messy.hashtags.length, 'tekrar olmamalı');

  const many = repairSpec({...base, hashtags: Array.from({length: 20}, (_, i) => `#tag${i}`), scenes: [diagram]});
  assert.ok(many.hashtags.length <= 9, 'etiket çorbası olmasın');
});

test('a versus scene keeps its rows and gets one narration line per row', () => {
  const spec = {...base, narration: ['Kanca.'], scenes: [{
    kind: 'versus', layout: 'nodes-flow', left: 'PAHALI SERUM', right: 'MUADİL',
    rows: [
      {label: 'AKTİF MADDE', left: '%10 niasinamid', right: '%10 niasinamid', winner: 'tie'},
      {label: 'FİYAT', left: '420 TL', right: '139 TL', winner: 'right'},
      {label: 'BARİYER DESTEĞİ', left: 'seramid yok', right: '3 seramid', winner: 'right'},
    ],
  }]};
  const fixed = repairSpec(spec);
  assert.equal(validateSpec(fixed).valid, true, validateSpec(fixed).errors?.join('; '));
  assert.equal(fixed.scenes[0].rows.length, 3, 'satırlar korunmalı');
  assert.equal(fixed.narration.length, 6, 'hook + kurulum + 3 satır + kapanış');
  assert.match(fixed.narration[2], /AKTİF MADDE\./i, 'eksik cümle satır etiketinden üretilir');
  assert.equal(fixed.scenes[0].nodes, undefined, 'versus sahnesinde node aranmaz');
});

test('an incomplete versus scene is dropped rather than rendered broken', () => {
  const good = {layout: 'cycle', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    steps: [{from: 'a', to: 'b', packet: 'P', status: 's'}]};
  const fixed = repairSpec({...base, scenes: [good, {kind: 'versus', layout: 'cycle', left: 'A', rows: []}]});
  assert.equal(fixed.scenes.length, 1);
  assert.equal(validateSpec(fixed).valid, true);
});

test('etiketlerde Türkçe harfler korunur', () => {
  // '#güneşbakımı' → '#gnebakm' oluyordu: anlamsız, hiç aranmayan etiket (2026-07-28).
  const out = repairSpec({...base, hashtags: ['#güneşbakımı', '#niasinamid', '#SPF50']});
  assert.ok(out.hashtags.includes('#güneşbakımı'), `Türkçe harf düştü: ${out.hashtags.join(' ')}`);
  assert.ok(out.hashtags.includes('#spf50'));
});

test('eksik etiket tamamlaması MARKADAN gelir, AI etiketi eklenmez', () => {
  // 2026-07-28 canlı: cilt bakımı sayfasının gönderisine '#ai #llm #aiengineering' eklendi
  // ve ilk yorum ilk 3 etiketi yazdığı için yorum da AI etiketleriyle çıktı.
  const out = repairSpec({...base, hashtags: ['#ciltbakimi']},
    {defaultHashtags: ['#ciltbakimi', '#skincare', '#cilt', '#ciltbariyeri', '#aktifler', '#nemlendirici']});
  assert.equal(out.hashtags.length, 6);
  assert.ok(!out.hashtags.some(t => /^#(ai|llm|aiengineering|aiagents|tech|developers)$/.test(t)),
    `AI etiketi sızdı: ${out.hashtags.join(' ')}`);
});
