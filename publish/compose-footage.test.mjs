import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSegments, xfadeChain, normalizeClip, composeFootageVideo, XF} from './compose-footage.mjs';

const recorder = () => {
  const calls = [];
  return {calls, run: (bin, args) => calls.push({bin, args: args.map(String)})};
};
const argOf = (call, flag) => call.args[call.args.indexOf(flag) + 1];

test('planSegments preserves total duration through the xfade overlaps', () => {
  for (const [total, n] of [[27, 4], [18.5, 3], [31, 2], [22, 1]]) {
    const {durations} = planSegments({total, clipCount: n});
    const visible = durations.reduce((a, b) => a + b, 0) - (n - 1) * XF;
    assert.ok(Math.abs(visible - total) < 0.001, `${total}s / ${n} klip → ${visible}`);
  }
});

test('planSegments keeps the hook and outro bright and the teaching body dark', () => {
  const {dims} = planSegments({total: 27, clipCount: 4});
  assert.equal(dims.length, 4);
  assert.ok(dims[0] < 0.4, 'hook footage görünür kalmalı');
  assert.ok(dims[1] >= dims[0] + 0.15 && dims[1] < 0.6, 'gövde okunacak kadar koyu, çamur değil');
  assert.equal(dims[1], dims[2]);
  assert.ok(dims[3] < dims[1], 'outro yeniden açılmalı');
});

test('planSegments never emits a segment shorter than the transition', () => {
  const {durations} = planSegments({total: 12, clipCount: 4});
  for (const d of durations) assert.ok(d > XF, `segment ${d}s < xfade ${XF}s`);
});

test('normalizeClip crops to 1080x1920, pans, and burns in the scrim', () => {
  const {calls, run} = recorder();
  normalizeClip({src: 'a.mp4', outPath: 'o.mp4', seconds: 6, panDir: 1, dim: 0.62, run});
  const vf = argOf(calls[0], '-vf');
  assert.match(vf, /crop=1080:1920/);
  assert.match(vf, /gblur=sigma=/);
  assert.match(vf, /drawbox=.*black@0\.62/);
  assert.match(vf, /vignette/);
  // Kısa klip 6sn'ye uzasın diye sonsuz loop girişte olmalı.
  assert.deepEqual(calls[0].args.slice(0, 4), ['-y', '-stream_loop', '-1', '-i']);
});

test('normalizeClip pans a different direction per index', () => {
  const vfs = [0, 1, 2, 3].map(panDir => {
    const {calls, run} = recorder();
    normalizeClip({src: 'a.mp4', outPath: 'o.mp4', seconds: 5, panDir, run});
    return argOf(calls[0], '-vf');
  });
  assert.equal(new Set(vfs).size, 4, 'her yön farklı bir kamera hareketi üretmeli');
});

test('xfadeChain offsets each transition at the end of the running segment', () => {
  const {calls, run} = recorder();
  xfadeChain({clips: ['0.mp4', '1.mp4', '2.mp4'], durations: [4, 10, 6], outPath: 'bg.mp4', run});
  const fc = argOf(calls[0], '-filter_complex');
  const offsets = [...fc.matchAll(/offset=([\d.]+)/g)].map(m => Number(m[1]));
  assert.deepEqual(offsets, [4 - XF, 4 + 10 - 2 * XF]);
  assert.match(fc, /xfade=transition=/);
});

test('xfadeChain copies straight through for a single clip', () => {
  const {calls, run} = recorder();
  xfadeChain({clips: ['only.mp4'], durations: [20], outPath: 'bg.mp4', run});
  assert.ok(calls[0].args.includes('copy'));
});

test('composeFootageVideo reuses clips across segments and overlays the alpha frames', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [{path: 'c0.mp4'}, {path: 'c1.mp4'}],
    framesDir: '/frames', frames: 1620, tmpDir: '/tmp/x', outPath: 'out.mp4', run,
  });
  // 2 klip → planSegments 2 segment ister; her segment normalize edilir.
  const normalizes = calls.filter(c => c.args.includes('-stream_loop'));
  assert.equal(normalizes.length, 2);
  assert.deepEqual(normalizes.map(c => argOf(c, '-i')), ['c0.mp4', 'c1.mp4']);

  const overlay = calls.at(-1);
  assert.match(argOf(overlay, '-filter_complex'), /overlay=0:0/);
  assert.ok(overlay.args.includes('/frames/%06d.png'));
  assert.equal(argOf(overlay, '-t'), '27.00');            // 1620 kare / 60fps
  assert.equal(argOf(overlay, '-start_number'), '0');     // MC kareleri 000000'dan başlar
});

test('composeFootageVideo falls back to a moving gradient when no clip downloaded', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [], framesDir: '/frames', frames: 600, tmpDir: '/tmp/x',
    outPath: 'out.mp4', accent: '#bc8cff', run,
  });
  const lavfi = calls.find(c => c.args.includes('lavfi'));
  assert.ok(lavfi, 'klip yoksa üretilmiş hareketli arka plan olmalı');
  assert.match(argOf(lavfi, '-i'), /gradients=.*0xbc8cff.*speed=/);
});

test('findFramesDir locates the PNG directory even when MC nests it', async () => {
  const {mkdtempSync, mkdirSync, writeFileSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {findFramesDir} = await import('./compose-footage.mjs');
  const root = mkdtempSync(join(tmpdir(), 'bf-frames-'));
  const nested = join(root, 'project', 'explainer');
  mkdirSync(nested, {recursive: true});
  writeFileSync(join(nested, '000000.png'), 'x');
  assert.equal(findFramesDir(root), nested);
  assert.equal(findFramesDir(join(root, 'nope')), null);
});
