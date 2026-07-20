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

test('scene with <3 nodes fails', () => {
  const one = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [{layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}], steps: [{from: 'a', to: 'a', packet: 'X', status: 's'}]}]
  };
  assert.equal(validateSpec(one).valid, false);
  const two = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [{layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}],
      steps: [{from: 'a', to: 'b', packet: 'X', status: 's'}]}]
  };
  assert.equal(validateSpec(two).valid, false);
});

test('scene with >8 nodes fails, 8 passes', () => {
  const mk = (count) => ({
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [{layout: 'cycle',
      nodes: Array.from({length: count}, (_, i) => ({id: `n${i}`, label: `N${i}`})),
      steps: [{from: 'n0', to: 'n1', packet: 'X', status: 's'}]}]
  });
  assert.equal(validateSpec(mk(8)).valid, true, JSON.stringify(validateSpec(mk(8)).errors));
  assert.equal(validateSpec(mk(9)).valid, false);
});

test('step referencing unknown node id fails', () => {
  const spec = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [
      {layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
        steps: [{from: 'a', to: 'b', packet: 'X', status: 's'}]},
      {layout: 'nodes-flow', nodes: [{id: 'x', label: 'X'}, {id: 'y', label: 'Y'}, {id: 'z', label: 'Z'}],
        steps: [{from: 'srv', to: 'y', packet: 'X', status: 's'}]},
    ]
  };
  const res = validateSpec(spec);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => /\/scenes\/1\/steps\/0/.test(e) && /srv/.test(e)),
    JSON.stringify(res.errors));
});

test('duplicate node ids within a scene fails', () => {
  const spec = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [
      {layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}, {id: 'a', label: 'A2'}, {id: 'b', label: 'B'}],
        steps: [{from: 'a', to: 'b', packet: 'X', status: 's'}]},
    ]
  };
  const res = validateSpec(spec);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => /\/scenes\/0/.test(e) && /duplicate/i.test(e)),
    JSON.stringify(res.errors));
});

test('a code scene without nodes/steps is semantically valid', () => {
  const spec = {
    title: 'Retry Loop', caption: 'x', hashtags: ['#llm'],
    scenes: [{kind: 'code', layout: 'nodes-flow', language: 'python', code: 'x = 1'}],
  };
  const {valid, errors} = validateSpec(spec);
  assert.equal(valid, true, JSON.stringify(errors));
});

test('a diagram scene still gets reference-integrity checks', () => {
  const spec = {
    title: 'Bad Ref', caption: 'x', hashtags: ['#llm'],
    scenes: [{layout: 'nodes-flow',
      nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
      steps: [{from: 'a', to: 'ZZZ', packet: 'P', status: 'x'}]}],
  };
  const {valid, errors} = validateSpec(spec);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes('unknown node id "ZZZ"')));
});
