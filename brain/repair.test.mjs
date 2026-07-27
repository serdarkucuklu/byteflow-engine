import {test} from 'node:test';
import assert from 'node:assert/strict';
import {repairSpec} from './repair.mjs';
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
  assert.equal(fixed.scenes[0].nodes[0].label.length, 18);
  assert.equal(fixed.scenes[0].steps[0].packet, 'TOOLON');
  assert.equal(fixed.scenes[0].steps[0].status.length, 40);
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
