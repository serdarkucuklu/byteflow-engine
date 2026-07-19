import {test} from 'node:test';
import assert from 'node:assert/strict';
import {specShape, computePacing, estimateTotalSec, FIXED_SEC} from './pacing.ts';

const shape = (scenes, stepsPerScene, nodesPerScene = 3) => ({
  scenes,
  totalNodes: scenes * nodesPerScene,
  totalSteps: scenes * stepsPerScene,
});

test('specShape counts scenes, nodes, steps', () => {
  const spec = {scenes: [{nodes: [1, 2, 3], steps: [1, 2]}, {nodes: [1, 2], steps: [1]}]};
  assert.deepEqual(specShape(spec), {scenes: 2, totalNodes: 5, totalSteps: 3});
});

test('specShape treats a code scene (no nodes/steps) as zero nodes/steps but counts the scene', () => {
  const shape = specShape({scenes: [
    {nodes: [{}, {}], steps: [{}]},              // diagram scene
    {kind: 'code', code: 'x = 1'},               // code scene: no nodes/steps
  ]});
  assert.equal(shape.scenes, 2);
  assert.equal(shape.totalNodes, 2);
  assert.equal(shape.totalSteps, 1);
});

// The real content envelope (see brain/seed-backlog.json): always 1 scene, 2-4 steps,
// 3 nodes. Gemini may emit up to 3 scenes. These are the shapes that MUST land in band.
// Target 26.5 = motionTarget(0), the base of the 25-30s band real renders use.
test('realistic content shapes land total in [25,30]s', () => {
  for (const [sc, st] of [[1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [3, 2]]) {
    const s = shape(sc, st);
    const p = computePacing(s, 26.5);
    const total = estimateTotalSec(s, p);
    assert.ok(total >= 25 && total <= 30, `scenes=${sc} steps/scene=${st} → ${total.toFixed(2)}s out of band`);
  }
});

// A degenerate 1-scene/1-step spec cannot pleasantly fill 25s (a single packet would
// have to crawl). Seeds never produce it; we pad with a read-hold and accept ~20s.
test('degenerate 1-step spec stays pleasant (no crawl), bounded', () => {
  const p = computePacing(shape(1, 1), 26.5);
  const total = estimateTotalSec(shape(1, 1), p);
  assert.ok(p.step <= 3.2, `single-step flight must not crawl: ${p.step}`);
  assert.ok(total >= 15 && total <= 27, `${total.toFixed(2)}s`);
});

// Pathologically dense specs (12+ steps — the pipeline never produces these;
// seeds are 1 scene / 2-4 steps) compress to the motion floor. Each step's
// unavoidable fixed sub-beats (~0.7s) make sub-20s impossible past ~8 steps,
// but the governor drops all fillers and floors motion so it stays bounded.
test('pathologically dense specs floor motion and drop fillers', () => {
  for (const [sc, st] of [[3, 4], [3, 6]]) {
    const s = shape(sc, st);
    const p = computePacing(s, 16.5);
    assert.ok(p.step <= 0.4, `dense → floored flight, got ${p.step}`);
    assert.equal(p.recap, 0, 'recap dropped when dense');
    assert.equal(p.finalDwell, 0.8, 'dwell floored when dense');
  }
});

test('more steps → shorter per-step (never below floor)', () => {
  const few = computePacing(shape(1, 2), 16.5);
  const many = computePacing(shape(1, 6), 16.5);
  assert.ok(many.step <= few.step, 'denser spec should compress per-step');
  assert.ok(many.step >= 0.4, 'per-step must not collapse below 0.4s floor');
});

test('all pacing fields are non-negative finite numbers', () => {
  const p = computePacing(shape(1, 3), 16.5);
  for (const k of ['enter', 'lines', 'step', 'hold', 'recap', 'finalDwell', 'stagger']) {
    assert.ok(Number.isFinite(p[k]) && p[k] >= 0, `${k}=${p[k]}`);
  }
});

test('FIXED_SEC is the constant intro/outro overhead', () => {
  assert.equal(FIXED_SEC, 4.0);
});
