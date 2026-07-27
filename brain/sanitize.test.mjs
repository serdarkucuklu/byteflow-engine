import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stripMarkdown} from './sanitize.mjs';

test('strips emphasis from on-screen text fields', () => {
  const out = stripMarkdown({
    title: 'Why *RAG* Fails', hook: 'Your LLM isn\'t safe **by default**.',
    takeaway: 'External guardrails are your *real* safety net.',
    scenes: [{
      layout: 'nodes-flow', heading: '*Input* guardrails',
      nodes: [{id: 'a', label: '*USER* APP'}],
      steps: [{from: 'a', to: 'b', packet: '*REQ*', status: 'sends the *raw* prompt'}],
    }],
  });
  assert.equal(out.title, 'Why RAG Fails');
  assert.equal(out.hook, "Your LLM isn't safe by default.");
  assert.equal(out.takeaway, 'External guardrails are your real safety net.');
  assert.equal(out.scenes[0].heading, 'Input guardrails');
  assert.equal(out.scenes[0].nodes[0].label, 'USER APP');
  assert.equal(out.scenes[0].steps[0].packet, 'REQ');
  assert.equal(out.scenes[0].steps[0].status, 'sends the raw prompt');
});

test('leaves code scenes untouched (asterisk is a real operator there)', () => {
  const code = 'total = price * qty\nrate = a`b';
  const out = stripMarkdown({title: 'x', scenes: [{layout: 'nodes-flow', kind: 'code', language: 'python', code}]});
  assert.equal(out.scenes[0].code, code);
});

test('does not touch underscores (identifiers stay intact)', () => {
  const out = stripMarkdown({title: 'top_k Explained', scenes: []});
  assert.equal(out.title, 'top_k Explained');
});

test('is a pure function — the input spec is not mutated', () => {
  const spec = {title: '*a*', scenes: [{layout: 'cycle', nodes: [{id: 'n', label: '*L*'}]}]};
  stripMarkdown(spec);
  assert.equal(spec.title, '*a*');
  assert.equal(spec.scenes[0].nodes[0].label, '*L*');
});
