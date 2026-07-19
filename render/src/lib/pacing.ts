// Duration governor: turns a spec's shape into per-phase animation durations
// so total runtime lands in the 15-20s band regardless of content density.
// PURE — no @motion-canvas import (must stay node-testable).
//
// Philosophy: never fill time by slowing a packet to a crawl. Solve per-step
// motion to hit the target directly, clamped to a pleasant range. Sparse specs
// that hit the slow cap get a longer "read the finished diagram" hold + a recap
// burst; dense specs that hit the fast floor are accepted as-is.
//
// The fixed sub-beats below MUST mirror explainer.tsx's progressive build-up,
// or the estimate drifts from real render time. Build-up choreography per
// diagram scene: heading fade-in → BUILD (node[0] pop, then per next node:
// grow incoming connector(s), pop node) → DATA (per step: status fade-in,
// packet fade-in/fly/fade-out + target stroke flash + governed hold +0.5s
// readability hold + stroke reset) → optional recap dots → final +0.5s hold
// + fade-out. Calibrated 2026-07-19 against real `npm run render` output
// (ffprobe duration) for 3-node/2-step, 6-node/3-step and a 2-scene spec.

export interface SpecShape {
  scenes: number;
  totalNodes: number;
  totalSteps: number;
}

export interface Pacing {
  enter: number;      // per-node entrance duration
  lines: number;      // connector reveal duration
  step: number;       // per-packet flight duration (the moving part)
  hold: number;       // dwell after each step (reading time)
  recap: number;      // quick "whole flow" replay burst per scene (0 = skip)
  finalDwell: number; // hold the finished diagram before it fades, per scene
  stagger: number;    // resolved delay between staggered node entrances
}

// Intro (hook + title-in) + outro (title-out + takeaway + sign + tag + hold) —
// constant, not governed, untouched by the build-up rewrite. The literal
// per-tween sum of that (untouched) code is ~5.05s; this constant is kept at
// 4.0 by convention (pre-existing, still asserted by pacing.test.mjs) — the
// governor's internal target therefore runs ~1.05s "hot" versus the true
// fixed overhead, which is exactly why BUILDUP_WEIGHT=1 (motionTarget≈17.5s,
// see explainer.tsx) is picked well inside the 15-20s band rather than at its
// edge: the real measured render lands ~1s above whatever this model predicts.
export const FIXED_SEC = 4.0;

const ENTER = 0.5;   // per-node pop-in (build phase)
const LINES = 0.32;  // per-node incoming-connector grow (build phase)
// Fixed sub-beats present regardless of the governed durations (mirror explainer):
const HEADING_IN = 0.4;   // scene heading fade-in
const FINAL_FIXED = 1.0;  // +0.5s extra final hold + 0.5s container/status fade-out
const SCENE_FIXED = HEADING_IN + FINAL_FIXED; // 1.4 — everything per-scene beyond build/step/finalDwell
// status fade-in .25 + packet fade-in .18 + (packet fade-out/stroke-flash, concurrent) .2
// + stroke reset .3 + the mandated +0.5s readability hold = 1.43 per step, beyond flight+hold.
const STEP_FIXED = 1.43;
const RECAP_FIXED = 0.35; // recap dots opacity in (0.15) + out (0.2)

const DWELL_MIN = 0.8;
const DWELL_MAX = 3.0;
// Per-step total (incl. STEP_FIXED) is solved to the target, then clamped here.
// Must clear STEP_FIXED (1.43) with room for a non-crawling flight+hold, or
// motionPer goes negative — hence a higher floor than the old preset era.
const PERSTEP_MIN = 2.1;  // snappy floor (dense specs)
const PERSTEP_MAX = 3.6;  // deliberate cap (sparse specs) — no crawl
const MOTION_MIN = 0.05;  // absolute floor for pathological density
const ENTER_MIN = 0.02;   // build phase floor when scenes×nodes get dense
const LINES_MIN = 0.02;
const COMPRESS_TARGET = 18.6;

export function specShape(spec: {scenes: {nodes?: unknown[]; steps?: unknown[]}[]}): SpecShape {
  const scenes = spec.scenes.length;
  let totalNodes = 0, totalSteps = 0;
  for (const s of spec.scenes) {
    totalNodes += s.nodes?.length ?? 0;
    totalSteps += s.steps?.length ?? 0;
  }
  return {scenes, totalNodes, totalSteps};
}

export function computePacing(shape: SpecShape, targetSec: number): Pacing {
  const scenes = Math.max(shape.scenes, 1);
  const steps = Math.max(shape.totalSteps, 1);
  // Node-count-aware build phase: node[0] just pops; every other node grows
  // its incoming connector(s) (batched per target, so still one LINES beat)
  // then pops — totalNodes ENTERs, (totalNodes - scenes) LINES beats.
  const totalNodes = Math.max(shape.totalNodes, scenes);
  const buildEdges = Math.max(totalNodes - scenes, 0);
  const recap = scenes === 1 && steps <= 4 ? 0.9 : 0;

  let enter = ENTER, lines = LINES;
  let buildPhase = totalNodes * enter + buildEdges * lines;

  // Everything that doesn't scale with the per-step budget or final hold.
  const fixed = FIXED_SEC
    + buildPhase
    + scenes * SCENE_FIXED
    + scenes * (recap > 0 ? recap + RECAP_FIXED : 0);

  // Solve per-step total (incl. STEP_FIXED) to hit the target, reserving min dwell.
  const avail = targetSec - fixed - scenes * DWELL_MIN;
  const perStep = clamp(avail / steps, PERSTEP_MIN, PERSTEP_MAX);
  let motionPer = perStep - STEP_FIXED; // flight + hold
  let step = motionPer * 0.68;
  let hold = motionPer * 0.32;

  let finalDwell = DWELL_MIN;
  let total = estimate(buildPhase, scenes, steps, {step, hold, recap, finalDwell});

  // Sparse (per-step hit its slow cap) and still short → grow the read-hold.
  if (total < targetSec) {
    finalDwell = clamp(DWELL_MIN + (targetSec - total) / scenes, DWELL_MIN, DWELL_MAX);
    total = estimate(buildPhase, scenes, steps, {step, hold, recap, finalDwell});
  }

  // Over the ceiling (dense: many scenes/nodes/steps) → drop fillers, floor
  // the read-hold, compress the build phase toward its floor (still a
  // visible pop/grow, just snappy), then squeeze per-step motion toward the
  // absolute floor. The per-scene/per-step fixed sub-beats (SCENE_FIXED,
  // STEP_FIXED) are literal explainer.tsx durations and cannot compress
  // further — pathologically dense specs the pipeline never produces may
  // still run a little long, but stay bounded.
  if (total > 20) {
    finalDwell = DWELL_MIN;
    enter = ENTER_MIN;
    lines = LINES_MIN;
    buildPhase = totalNodes * enter + buildEdges * lines;
    const fixedNoRecap = FIXED_SEC + buildPhase + scenes * SCENE_FIXED + scenes * DWELL_MIN;
    motionPer = clamp((COMPRESS_TARGET - fixedNoRecap) / steps - STEP_FIXED, MOTION_MIN, motionPer);
    step = motionPer * 0.68;
    hold = motionPer * 0.32;
    return finish(enter, lines, {step, hold, recap: 0, finalDwell});
  }

  return finish(enter, lines, {step, hold, recap, finalDwell});
}

export function estimateTotalSec(shape: SpecShape, p: Pacing): number {
  const scenes = Math.max(shape.scenes, 1);
  const totalNodes = Math.max(shape.totalNodes, scenes);
  const buildPhase = totalNodes * p.enter + Math.max(totalNodes - scenes, 0) * p.lines;
  return FIXED_SEC
    + buildPhase
    + scenes * SCENE_FIXED
    + scenes * (p.recap > 0 ? p.recap + RECAP_FIXED : 0)
    + shape.totalSteps * (p.step + p.hold + STEP_FIXED)
    + scenes * p.finalDwell;
}

// Internal estimate given the governed knobs (build phase already resolved).
function estimate(buildPhase: number, scenes: number, steps: number,
  k: {step: number; hold: number; recap: number; finalDwell: number}): number {
  return FIXED_SEC
    + buildPhase
    + scenes * SCENE_FIXED
    + scenes * (k.recap > 0 ? k.recap + RECAP_FIXED : 0)
    + steps * (k.step + k.hold + STEP_FIXED)
    + scenes * k.finalDwell;
}

function finish(enter: number, lines: number,
  k: {step: number; hold: number; recap: number; finalDwell: number}): Pacing {
  return {
    enter: round(enter),
    lines: round(lines),
    step: round(k.step),
    hold: round(k.hold),
    recap: round(k.recap),
    finalDwell: round(k.finalDwell),
    stagger: 0, // each preset supplies its own stagger; this is the governed default
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number): number {
  return Math.round(v * 100) / 100;
}
