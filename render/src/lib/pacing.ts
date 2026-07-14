// Duration governor: turns a spec's shape into per-phase animation durations
// so total runtime lands in the 15-20s band regardless of content density.
// PURE — no @motion-canvas import (must stay node-testable).
//
// Philosophy: never fill time by slowing a packet to a crawl. Sparse specs get
// deliberately slower (but bounded) motion + a longer "read the finished diagram"
// hold + a quick recap burst; dense specs get compressed toward pleasant floors.

export interface SpecShape {
  scenes: number;
  totalNodes: number;
  totalSteps: number;
}

export interface Pacing {
  enter: number;      // per-node entrance duration
  lines: number;      // connector reveal duration
  step: number;       // per-packet flight duration (the moving part)
  hold: number;       // dwell + fade after each step (reading time)
  recap: number;      // quick "whole flow" replay burst per scene (0 = skip)
  finalDwell: number; // hold the finished diagram before it fades, per scene
  stagger: number;    // resolved delay between staggered node entrances
}

// Intro (brand) + title + outro — constant, not governed.
export const FIXED_SEC = 4.0;

const ENTER = 0.6;
const LINES = 0.4;
const DWELL_MIN = 0.8;
const DWELL_MAX = 3.0;
const COMPRESS_TARGET = 19.5; // squeeze dense specs to just under the ceiling

export function specShape(spec: {scenes: {nodes: unknown[]; steps: unknown[]}[]}): SpecShape {
  const scenes = spec.scenes.length;
  let totalNodes = 0, totalSteps = 0;
  for (const s of spec.scenes) {
    totalNodes += s.nodes.length;
    totalSteps += s.steps.length;
  }
  return {scenes, totalNodes, totalSteps};
}

export function computePacing(shape: SpecShape, targetSec: number): Pacing {
  const scenes = Math.max(shape.scenes, 1);
  const steps = Math.max(shape.totalSteps, 1);

  // Sparse → slower, deliberate motion; dense → snappier. All bounded so nothing crawls.
  let step = clamp(2.4 - 0.2 * steps, 0.85, 2.0);
  let hold = clamp(1.4 - 0.12 * steps, 0.4, 1.2);
  // A recap burst only reads well for a single, not-too-dense scene.
  let recap = scenes === 1 && steps <= 4 ? 0.9 : 0;

  const fixedPart = FIXED_SEC + scenes * (ENTER + LINES) + scenes * recap;
  const motion = steps * (step + hold);

  let finalDwell = DWELL_MIN;
  let total = fixedPart + motion + scenes * finalDwell;

  // Under target → grow the finished-diagram read-hold to fill (bounded).
  if (total < targetSec) {
    finalDwell = clamp(DWELL_MIN + (targetSec - total) / scenes, DWELL_MIN, DWELL_MAX);
    total = fixedPart + motion + scenes * finalDwell;
  }

  // Over the ceiling → drop recap & extra dwell, then solve per-step motion to
  // land at COMPRESS_TARGET. Extreme density may push below the pleasant floors
  // (hard absolute mins), but only for specs the pipeline never actually produces.
  if (total > 20) {
    recap = 0;
    finalDwell = DWELL_MIN;
    const fixed = FIXED_SEC + scenes * (ENTER + LINES) + scenes * finalDwell;
    const perStep = Math.max(0.5, (COMPRESS_TARGET - fixed) / steps);
    step = clamp(perStep * 0.7, 0.35, step);
    hold = clamp(perStep * 0.3, 0.15, hold);
  }

  return {
    enter: ENTER,
    lines: LINES,
    step: round(step),
    hold: round(hold),
    recap: round(recap),
    finalDwell: round(finalDwell),
    stagger: 0, // each preset supplies its own stagger; this is the governed default
  };
}

export function estimateTotalSec(shape: SpecShape, p: Pacing): number {
  const scenes = Math.max(shape.scenes, 1);
  return FIXED_SEC
    + scenes * (p.enter + p.lines)
    + scenes * p.recap
    + shape.totalSteps * (p.step + p.hold)
    + scenes * p.finalDwell;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number): number {
  return Math.round(v * 100) / 100;
}
