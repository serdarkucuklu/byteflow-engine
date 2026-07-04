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
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeBad, retries: 1, pickSeed: s => s[2]});
  assert.equal(source, 'seed');
  assert.equal(validateSpec(spec).valid, true);
});

test('falls back when gemini returns invalid spec', async () => {
  const fakeInvalid = async () => ({title: 'x', scenes: [], caption: 'c', hashtags: []});
  const {source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeInvalid, retries: 0, pickSeed: s => s[0]});
  assert.equal(source, 'seed');
});
