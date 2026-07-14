# ByteFlow Motion Preset System — Design

**Date:** 2026-07-14
**Status:** Approved (brainstorming → spec)
**Repo:** `16-byteflow-engine` (`feat/motion-presets`)

## Problem

ByteFlow renders one animated explainer Reel per day. Visual variety currently comes
from two rotating axes chosen in `run-daily.mjs` by history length `n`:

- **layout** (4): `nodes-flow`, `vertical-stack`, `hub-spoke`, `cycle` — spatial composition.
- **theme** (6 accent colors).

But the **motion language** — how nodes enter, how packets travel, how scenes transition,
what easing is used — is a single hardcoded choreography inside `render/src/scenes/explainer.tsx`:
nodes `scale(easeOutBack)`, packets linear `easeInOutCubic` flight, scenes crossfade. Every
video moves the same way. We want the *playback style* itself to vary.

## Goal

- **≥10 distinct motion presets** (we ship 12), each a bundled choreography (entrance × packet
  flight × scene transition × easing, plus optional ambient flourish).
- **Sequential rotation** each run, like layout/theme — orthogonal new axis.
- **User-pleasing visuals**, drawn from established motion-design idioms.
- **Duration 15–20s** reliably, regardless of content density (currently ~9–13s).
- **Fully CI-safe**: all presets run under the autonomous GitHub Actions headless xvfb pipeline;
  deterministic (no `Math.random`), pure Motion Canvas primitives, no new deps.

## Decisions (from brainstorming)

1. **Orthogonal axis** — motion preset is a 3rd independent rotation. Layout (4) + theme (6)
   stay untouched. Every preset must render correctly under every layout.
2. **Auto pacing governor** — measure the spec, stretch/compress body timings to land total in
   [15, 20]s (~17s target). Intro/outro fixed; body budget divided across steps.
3. **All presets CI-safe / lightweight** — bounded particle counts, deterministic variation
   derived from index (not RNG), no heavy filters that break headless rendering.

## Architecture

Three new units + refactors to two existing files. Each unit has one purpose, a typed
interface, and is independently testable.

### 1. `render/src/lib/motion.ts` — Preset registry (single source of truth)

```ts
import type {Rect, Txt, Line, Layout, View2D} from '@motion-canvas/2d';
import type {ThreadGenerator} from '@motion-canvas/core';

// Timing multipliers computed by the pacing governor and passed into every hook.
export interface Pacing {
  enter: number;   // per-node entrance duration
  lines: number;   // connector reveal duration
  step: number;    // per-packet flight duration
  hold: number;    // dwell after each step
}

export interface MotionCtx {
  accent: string;                 // resolved per-step color
  colors: typeof import('./spec').COLORS;
  pacing: Pacing;
}

export interface MotionPreset {
  name: string;
  stagger: number;                                     // delay between node entrances (0 = simultaneous)
  weight: number;                                      // relative pacing weight (governor input)
  enter(box: Rect, i: number, count: number, ctx: MotionCtx): ThreadGenerator;
  drawLines(lines: Line[], ctx: MotionCtx): ThreadGenerator;
  flight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx): ThreadGenerator;
  exit(container: Layout, view: View2D, ctx: MotionCtx): ThreadGenerator;
  ambient?(view: View2D, ctx: MotionCtx): void;        // optional camera/background flourish (sync setup)
}

export const MOTION_PRESETS: MotionPreset[] = [ /* 12 entries */ ];
export const MOTION_NAMES = MOTION_PRESETS.map(p => p.name);
export function pickMotion(n: number): MotionPreset { return MOTION_PRESETS[n % MOTION_PRESETS.length]; }
```

**The 12 presets** (all deterministic, xvfb-safe):

| # | name | entrance | packet flight | scene transition |
|---|------|----------|---------------|------------------|
| 0 | `classic`   | scale-pop `easeOutBack`            | straight glide `easeInOutCubic`       | crossfade   |
| 1 | `terminal`  | typewriter decode (label tween)    | marching-ants line + running dot      | glitch-wipe |
| 2 | `spring`    | elastic bounce `easeOutElastic`    | parabolic arc (quadratic bezier)      | zoom-punch  |
| 3 | `cascade`   | staggered slide-in (dir by index)  | comet-trail (bounded ghost copies)    | slide/push  |
| 4 | `pulse`     | blur-in focus pull (`filters.blur`)| glow wave travelling the wire         | crossfade   |
| 5 | `burst`     | scale-pop                          | multi-particle stream (fixed N=5)     | zoom        |
| 6 | `cinematic` | fade + Ken Burns drift (`ambient`) | arc                                   | crossfade   |
| 7 | `neon`      | glow scale-in                      | comet                                 | glitch      |
| 8 | `blueprint` | outline line-draw (stroke, no fill)| dash-runner dot along connector       | slide       |
| 9 | `matrix`    | decode + falling settle            | falling packet (gravity ease)         | fade        |
| 10| `punch`     | anticipation → overshoot           | fast straight `easeOutQuad`           | zoom-punch  |
| 11| `wave`      | sequential wave scale (stagger)    | pulse-wave                            | crossfade   |

Implementation notes for the trickier hooks (all achievable with core primitives):
- **typewriter/decode**: tween a `0→len` signal, set `txt.text(label.slice(0, k))`.
- **arc**: tween `t:0→1`, position = quadratic bezier of from/mid/to; `mid` lifted perpendicular.
- **comet-trail**: spawn ≤6 ghost `Rect`s at intervals, each fading — bounded, deterministic.
- **glow wave on wire**: a small bright `Rect`/`Circle` tweened along the connector line points.
- **blur-in**: `box.filters.blur(24)` → `blur(0)`; verify perf under xvfb (fallback: opacity+scale).
- **glitch-wipe**: brief deterministic x-jitter (index-seeded offsets) + 2 offset color copies, ≤0.3s.
- **Ken Burns**: `ambient` sets `view.scale(1.0→1.06)` slow tween spawned in background.
- **multi-particle**: fixed 5 small rects along the path with staggered delays.

Every hook is written to be **layout-agnostic** — it reads `from.position()`/`to.position()` at
runtime, so it works whether nodes are in a row, stack, hub, or cycle.

### 2. `render/src/lib/pacing.ts` — Duration governor

```ts
export interface SpecShape { scenes: number; totalNodes: number; totalSteps: number; }
export function computePacing(shape: SpecShape, weight: number): Pacing;
```

- Fixed overhead (intro+title+outro) ≈ constant `FIXED ≈ 5.5s`.
- Target total `TARGET = 17s` → `BODY = TARGET − FIXED`.
- Per-step budget `step = clamp((BODY − sceneSetup) / max(totalSteps,1), 0.7, 2.2)`.
- `enter`, `lines`, `hold` derived proportionally; `weight` nudges the split so slower presets
  (e.g. `cinematic`) breathe and faster ones (`punch`) stay snappy — all still inside [15,20]s.
- Pure function → unit-testable at extreme shapes (1 node/1 step … 3 scenes/max steps).

### 3. `render/src/scenes/explainer.tsx` — Refactor

- Read `spec.motion` (name); resolve via `MOTION_NAMES.indexOf` → preset (fallback `classic`).
- Compute `Pacing` once from spec shape via `computePacing`.
- Replace hardcoded blocks:
  - node entrance loop → `preset.enter` with `preset.stagger` (use `sequence`/`delay` when >0).
  - connector reveal → `preset.drawLines`.
  - per-step packet → `preset.flight`.
  - scene teardown → `preset.exit`.
  - call `preset.ambient?.(view, ctx)` once after title.
- Brand intro/title/outro remain (they are brand-consistent; only body choreography varies).

### 4. `run-daily.mjs` — Rotation wiring

- Import/duplicate `MOTION_NAMES` (kept in sync with `motion.ts`, mirroring existing `LAYOUTS`
  duplication pattern — a `motion.test.mjs` assertion guards the sync).
- `const motion = MOTION_NAMES[n % MOTION_NAMES.length];`
- `spec.motion = motion;` written into both spec JSON files.
- History entry gains `motion`.
- Layout stays `n % 4`. Note: since 4 | 12, `motion i` always pairs with `layout (i%4)` — a fixed
  but non-repeating-within-12 pairing; theme still rotates independently. Acceptable; a stride
  offset can decorrelate later if desired.

### 5. Untouched

Gemini schema/prompt (`motion` is post-injected like `layout`/`theme`; `additionalProperties:true`
already permits it), `fetch/`, `publish/`, `.github/workflows/daily.yml`, theme palette,
brand intro/outro.

## Testing

- `render/src/lib/motion.test.mjs` — every preset has all required hooks; `MOTION_NAMES`
  matches the list duplicated in `run-daily.mjs` (sync guard); names unique; ≥12 presets.
- `render/src/lib/pacing.test.mjs` — `computePacing` yields total in [15,20]s across shape
  extremes and all preset weights; monotonic (more steps → shorter per-step, never negative).
- Existing `render/src/lib/spec.test.mjs` and `brain/*.test.mjs` stay green.
- **Behavioral verification**: render 2–3 presets locally (headed) and eyeball the mp4 +
  confirm duration ∈ [15,20]s before claiming done (per verification-before-completion).

## Error handling / edge cases

- Unknown/missing `spec.motion` → fallback `classic` (never crash the autonomous pipeline).
- `filters.blur` unsupported/slow under xvfb → `pulse`/`neon` degrade to opacity+scale (guarded).
- Particle/ghost counts are hard-capped constants — no unbounded spawn.
- Missing node id in a step already handled (`continue`) — preserved.

## Out of scope (YAGNI)

- Letting Gemini choose the motion (post-injection is simpler and keeps variety deterministic).
- Per-scene different presets (one preset per video is enough variety with layout×theme).
- Audio-reactive / beat-synced motion.
- Configurable target duration UI.
