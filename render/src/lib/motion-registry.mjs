// PURE metadata for the motion-preset rotation. No @motion-canvas import so it
// is importable by run-daily.mjs (pipeline) and node --test. The runtime
// choreography for each name lives in motion.ts (vite-only).
// `weight` nudges the per-video duration target: calmer presets breathe longer,
// punchy ones run shorter — all still inside the 15-20s band.

export const MOTION_META = [
  {name: 'classic',   stagger: 0,    weight: 0},
  {name: 'terminal',  stagger: 0.12, weight: 1},
  {name: 'spring',    stagger: 0.08, weight: 0.5},
  {name: 'cascade',   stagger: 0.18, weight: 1},
  {name: 'pulse',     stagger: 0.1,  weight: 1.5},
  {name: 'burst',     stagger: 0,    weight: 0.5},
  {name: 'cinematic', stagger: 0.15, weight: 2.5},
  {name: 'neon',      stagger: 0.1,  weight: 1},
  {name: 'blueprint', stagger: 0.14, weight: 1.5},
  {name: 'matrix',    stagger: 0.1,  weight: 1},
  {name: 'punch',     stagger: 0.06, weight: -1.5},
  {name: 'wave',      stagger: 0.16, weight: 1.5},
];

export const MOTION_NAMES = MOTION_META.map(m => m.name);

export function pickMotion(n) {
  const len = MOTION_META.length;
  return MOTION_META[((n % len) + len) % len];
}

export function motionTarget(weight) {
  const t = 16.5 + weight;
  return Math.max(15, Math.min(19.5, t));
}
