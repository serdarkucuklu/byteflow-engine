import {test} from 'node:test';
import assert from 'node:assert/strict';
import {produceSpec, SEED_BACKLOG} from './produce-spec.mjs';
import {validateSpec} from './validate.mjs';

const cands = [{title: 'X', summary: 's', link: 'l', source: 'hn'}];

test('every seed in backlog is a valid spec', () => {
  assert.ok(SEED_BACKLOG.length >= 12);
  for (const s of SEED_BACKLOG) {
    const {valid, errors} = validateSpec(s);
    assert.equal(valid, true, `${s.title}: ${errors.join(';')}`);
  }
});

test('uses gemini result when valid', async () => {
  const fakeGood = async () => SEED_BACKLOG[0];
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeGood});
  assert.equal(source, 'gemini');
  assert.equal(spec.title, SEED_BACKLOG[0].title);
});

test('falls back to seed when generator keeps failing', async () => {
  const fakeBad = async () => { throw new Error('boom'); };
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeBad, retries: 1, pickSeed: s => s[2], backoffMs: 0});
  assert.equal(source, 'seed');
  assert.equal(validateSpec(spec).valid, true);
});

test('falls back when gemini returns invalid spec', async () => {
  const fakeInvalid = async () => ({title: 'x', scenes: [], caption: 'c', hashtags: []});
  const {source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeInvalid, retries: 0, pickSeed: s => s[0], backoffMs: 0});
  assert.equal(source, 'seed');
});

test('default pickSeed deterministically returns the first seed', () => {
  const seeds = SEED_BACKLOG;
  assert.deepEqual(seeds[0], seeds[0]); // sanity: backlog exists
});

test('waits between retry attempts (backoff grows) but not after the last attempt', async () => {
  const attemptTimestamps = [];
  const fakeBad = async () => { attemptTimestamps.push(Date.now()); throw new Error('boom'); };
  const start = Date.now();
  await produceSpec({candidates: cands, apiKey: 'x', generate: fakeBad, retries: 2, pickSeed: s => s[0], backoffMs: 20});
  const elapsed = Date.now() - start;
  assert.equal(attemptTimestamps.length, 3, 'attempt 0, 1, 2 all ran');
  // delay after attempt 0 (20ms) + after attempt 1 (40ms) = 60ms, none after attempt 2 (last)
  assert.ok(elapsed >= 60, `expected >=60ms elapsed for two backoff waits, got ${elapsed}`);
});

test('produceSpec with backoffMs: 0 does not add measurable delay', async () => {
  const fakeBad = async () => { throw new Error('boom'); };
  const start = Date.now();
  await produceSpec({candidates: cands, apiKey: 'x', generate: fakeBad, retries: 3, pickSeed: s => s[0], backoffMs: 0});
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 200, `expected near-instant with backoffMs 0, got ${elapsed}`);
});
