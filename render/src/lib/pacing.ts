// Duration governor: turns a spec's shape into per-phase animation durations
// so total runtime lands in the 15-20s band regardless of content density.
// PURE — no @motion-canvas import (must stay node-testable).
//
// Philosophy: never fill time by slowing a packet to a crawl. Solve per-step
// motion to hit the target directly, clamped to a pleasant range. Sparse specs
// that hit the slow cap get a longer "read the finished diagram" hold + a recap
// burst; dense specs that hit the fast floor are accepted as-is.
//
// The fixed sub-beats below MUST mirror explainer.tsx, or the estimate drifts
// from real render time (measured: each classic step carries ~0.7s of opacity
// in/out + stroke flash beyond `step`; each scene ~0.9s of container fade + exit).

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

// Intro (brand) + title + outro — constant, not governed. Measured ~3.9s.
export const FIXED_SEC = 4.0;

const ENTER = 0.6;
const LINES = 0.4;
// Fixed sub-beats present regardless of the governed durations (mirror explainer):
const SCENE_FIXED = 0.9; // container fade-in (0.4) + preset exit (0.5)
const STEP_FIXED = 0.7;  // packet opacity in (0.2) + out (0.2) + stroke flash (0.3)
const RECAP_FIXED = 0.35; // recap dots opacity in (0.15) + out (0.2)

const DWELL_MIN = 0.8;
const DWELL_MAX = 3.0;
// Per-step total (incl. STEP_FIXED) is solved to the target, then clamped here.
const PERSTEP_MIN = 1.2;  // snappy floor (dense specs)
const PERSTEP_MAX = 3.3;  // deliberate cap (sparse specs) — no crawl
const MOTION_MIN = 0.15;  // absolute floor for pathological density
const COMPRESS_TARGET = 19.5;

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
  const recap = scenes === 1 && steps <= 4 ? 0.9 : 0;

  // Everything that doesn't scale with the per-step budget or final hold.
  const fixed = FIXED_SEC
    + scenes * (ENTER + LINES + SCENE_FIXED)
    + scenes * (recap > 0 ? recap + RECAP_FIXED : 0);

  // Solve per-step total (incl. STEP_FIXED) to hit the target, reserving min dwell.
  const avail = targetSec - fixed - scenes * DWELL_MIN;
  const perStep = clamp(avail / steps, PERSTEP_MIN, PERSTEP_MAX);
  let motionPer = perStep - STEP_FIXED; // flight + hold
  let step = motionPer * 0.68;
  let hold = motionPer * 0.32;

  let finalDwell = DWELL_MIN;
  let total = estimate(scenes, steps, {step, hold, recap, finalDwell});

  // Sparse (per-step hit its slow cap) and still short → grow the read-hold.
  if (total < targetSec) {
    finalDwell = clamp(DWELL_MIN + (targetSec - total) / scenes, DWELL_MIN, DWELL_MAX);
    total = estimate(scenes, steps, {step, hold, recap, finalDwell});
  }

  // Over the ceiling (dense) → drop the fillers and squeeze motion toward the
  // absolute floor. Very dense specs the pipeline never produces may still run
  // a little long — STEP_FIXED per step is unavoidable — but stay bounded.
  if (total > 20) {
    finalDwell = DWELL_MIN;
    const fixedNoRecap = FIXED_SEC + scenes * (ENTER + LINES + SCENE_FIXED) + scenes * DWELL_MIN;
    motionPer = clamp((COMPRESS_TARGET - fixedNoRecap) / steps - STEP_FIXED, MOTION_MIN, motionPer);
    step = motionPer * 0.68;
    hold = motionPer * 0.32;
    return finish(scenes, steps, {step, hold, recap: 0, finalDwell});
  }

  return finish(scenes, steps, {step, hold, recap, finalDwell});
}

export function estimateTotalSec(shape: SpecShape, p: Pacing): number {
  const scenes = Math.max(shape.scenes, 1);
  return FIXED_SEC
    + scenes * (p.enter + p.lines + SCENE_FIXED)
    + scenes * (p.recap > 0 ? p.recap + RECAP_FIXED : 0)
    + shape.totalSteps * (p.step + p.hold + STEP_FIXED)
    + scenes * p.finalDwell;
}

// Internal estimate given the four governed knobs (enter/lines are constant).
function estimate(scenes: number, steps: number,
  k: {step: number; hold: number; recap: number; finalDwell: number}): number {
  return FIXED_SEC
    + scenes * (ENTER + LINES + SCENE_FIXED)
    + scenes * (k.recap > 0 ? k.recap + RECAP_FIXED : 0)
    + steps * (k.step + k.hold + STEP_FIXED)
    + scenes * k.finalDwell;
}

function finish(_scenes: number, _steps: number,
  k: {step: number; hold: number; recap: number; finalDwell: number}): Pacing {
  return {
    enter: ENTER,
    lines: LINES,
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
