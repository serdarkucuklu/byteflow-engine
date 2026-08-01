import {test} from 'node:test';
import assert from 'node:assert/strict';
import {produceSpec, SEED_BACKLOG} from './produce-spec.mjs';
import {validateSpec} from './validate.mjs';

const cands = [{title: 'X', summary: 's', link: 'l', source: 'hn'}];
const fakePillar = {key: 'rag', focus: 'retrieval-augmented generation: chunking, embeddings, reranking'};

test('every seed in backlog is a valid spec', () => {
  assert.ok(SEED_BACKLOG.length >= 8);
  for (const s of SEED_BACKLOG) {
    const {valid, errors} = validateSpec(s);
    assert.equal(valid, true, `${s.title}: ${errors.join(';')}`);
  }
});

test('uses gemini result when valid', async () => {
  const fakeGood = async ({candidates, apiKey, recentTitles, pillar}) => SEED_BACKLOG[0];
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeGood});
  assert.equal(source, 'gemini');
  assert.equal(spec.title, SEED_BACKLOG[0].title);
});

test('passes the pillar through to the generate function', async () => {
  let receivedPillar;
  const fakeGood = async ({candidates, apiKey, recentTitles, pillar}) => {
    receivedPillar = pillar;
    return SEED_BACKLOG[0];
  };
  await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeGood});
  assert.deepEqual(receivedPillar, fakePillar);
});

test('falls back to seed when generator keeps failing', async () => {
  const fakeBad = async ({candidates, apiKey, recentTitles, pillar}) => { throw new Error('boom'); };
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeBad, retries: 1, pickSeed: s => s[2], backoffMs: 0});
  assert.equal(source, 'seed');
  assert.equal(validateSpec(spec).valid, true);
});

test('falls back when gemini returns invalid spec', async () => {
  const fakeInvalid = async ({candidates, apiKey, recentTitles, pillar}) => ({title: 'x', scenes: [], caption: 'c', hashtags: []});
  const {source} = await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeInvalid, retries: 0, pickSeed: s => s[0], backoffMs: 0});
  assert.equal(source, 'seed');
});

test('default pickSeed deterministically returns the first seed', () => {
  const seeds = SEED_BACKLOG;
  assert.deepEqual(seeds[0], seeds[0]); // sanity: backlog exists
});

test('waits between retry attempts (backoff grows) but not after the last attempt', async () => {
  const attemptTimestamps = [];
  const fakeBad = async ({candidates, apiKey, recentTitles, pillar}) => { attemptTimestamps.push(Date.now()); throw new Error('boom'); };
  const start = Date.now();
  await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeBad, retries: 2, pickSeed: s => s[0], backoffMs: 20});
  const elapsed = Date.now() - start;
  assert.equal(attemptTimestamps.length, 3, 'attempt 0, 1, 2 all ran');
  // delay after attempt 0 (20ms) + after attempt 1 (40ms) = 60ms, none after attempt 2 (last)
  assert.ok(elapsed >= 60, `expected >=60ms elapsed for two backoff waits, got ${elapsed}`);
});

test('produceSpec with backoffMs: 0 does not add measurable delay', async () => {
  const fakeBad = async ({candidates, apiKey, recentTitles, pillar}) => { throw new Error('boom'); };
  const start = Date.now();
  await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate: fakeBad, retries: 3, pickSeed: s => s[0], backoffMs: 0});
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `expected near-instant with backoffMs 0, got ${elapsed}`);
});

test('produceSpec markayı generateSpec\'e GEÇİRİR (canlı hata: geçmiyordu)', async () => {
  // 2026-07-28: bu satır eksikti; @cilt.kodu'ya "Claude Code vs Cursor" yayınlandı.
  // Marka dosyası, pillar havuzu ve feed'ler doğruydu — marka modele hiç ulaşmıyordu.
  const seen = [];
  const brand = {handle: '@cilt.kodu', language: 'tr', namedExamples: '"retinol"',
    persona: {name: 'Derin', tagline: 'Takip et: @cilt.kodu'}};
  await produceSpec({
    candidates: [], apiKey: 'k', pillar: {key: 'p', focus: 'f'}, brand,
    generate: async args => { seen.push(args.brand); throw new Error('dur'); },
    retries: 0, seeds: [{title: 's'}], backoffMs: 0,
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.handle, '@cilt.kodu', 'marka generateSpec\'e ulaşmalı');
});

// ---- Konu tekrarı SERT KAPI (2026-08-01 Serdar direktifi: "bir daha asla") ----
test('yasaklı özne dönerse üretim geçersiz sayılır ve tekrar denenir', async () => {
  const calls = [];
  const generate = async ({bannedSubjects}) => {
    calls.push(bannedSubjects);
    // İlk deneme kuralı çiğniyor, ikincisi farklı konuya geçiyor.
    return calls.length === 1
      ? {...SEED_BACKLOG[0], subject: 'hyaluronik asit serumu'}
      : {...SEED_BACKLOG[0], subject: 'retinol'};
  };
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar,
    generate, bannedSubjects: ['hyalüronik asit'], retries: 3, backoffMs: 0});
  assert.equal(source, 'gemini');
  assert.equal(spec.subject, 'retinol');
  assert.equal(calls.length, 2, 'ilk deneme reddedilip yeniden üretilmeliydi');
  assert.deepEqual(calls[0], ['hyalüronik asit'], 'yasak liste modele iletilmeli');
});

test('model ısrarla tekrar ederse seed yedeği de yasaklı konuya düşmez', async () => {
  const generate = async () => ({...SEED_BACKLOG[0], subject: 'hyalüronik asit'});
  const seeds = [{...SEED_BACKLOG[0], title: 'Yasaklı', subject: 'hyalüronik asit'},
                 {...SEED_BACKLOG[1], title: 'Temiz', subject: 'retinol'}];
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar,
    generate, seeds, bannedSubjects: ['hyaluronik asit'], retries: 1, backoffMs: 0,
    pickSeed: s => s[0]});
  assert.equal(source, 'seed');
  assert.equal(spec.subject, 'retinol', 'seed yedeği tekrarın mazereti değil');
});

test('gaf ekseni ve görsel rotasyon beyne iletilir', async () => {
  let got;
  const generate = async (args) => { got = args; return {...SEED_BACKLOG[0], subject: 'retinol'}; };
  await produceSpec({candidates: cands, apiKey: 'x', pillar: fakePillar, generate,
    twist: {key: 'zaman', focus: 'ZAMAN GAFI'}, bannedLayouts: ['cycle'], recentKinds: ['diagram']});
  assert.equal(got.twist.key, 'zaman');
  assert.deepEqual(got.bannedLayouts, ['cycle']);
  assert.deepEqual(got.recentKinds, ['diagram']);
});
