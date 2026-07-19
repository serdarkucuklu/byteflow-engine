// PURE metadata for the build-up choreography's duration target. No @motion-canvas
// import so it stays importable by run-daily.mjs (pipeline) and node --test.
// The runtime choreography (progressive build-up) lives in explainer.tsx.
// `weight` nudges the per-video duration target inside the 25-30s band.

export const MOTION_META = [
  {name: 'buildup', stagger: 0, weight: 1},
];

export const MOTION_NAMES = MOTION_META.map(m => m.name);

export function pickMotion(n) {
  const len = MOTION_META.length;
  return MOTION_META[((n % len) + len) % len];
}

export function motionTarget(weight) {
  const t = 26.5 + weight;
  return Math.max(25, Math.min(30, t));
}
