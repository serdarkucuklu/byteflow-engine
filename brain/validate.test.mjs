import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';

test('valid example spec passes', () => {
  const spec = JSON.parse(readFileSync(new URL('../scene-spec.example.json', import.meta.url)));
  const res = validateSpec(spec);
  assert.equal(res.valid, true, JSON.stringify(res.errors));
});

test('missing title fails', () => {
  const res = validateSpec({scenes: [], caption: 'x', hashtags: ['#a']});
  assert.equal(res.valid, false);
});

test('scene with <2 nodes fails', () => {
  const spec = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [{layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}], steps: [{from: 'a', to: 'a', packet: 'X', status: 's'}]}]
  };
  assert.equal(validateSpec(spec).valid, false);
});
