# ByteFlow Motion Presets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rotating library of 12 distinct motion presets (choreography styles) as a third variety axis alongside layout and theme, with a duration governor that lands every render in 15–20s.

**Architecture:** Split into a PURE metadata layer (`motion-registry.mjs`, node-importable) consumed by the daily pipeline and unit tests, and a RUNTIME choreography layer (`motion.ts`, vite-only) consumed by the Motion Canvas scene. A pure pacing governor (`pacing.ts`) computes per-phase durations from the spec shape + preset weight. `explainer.tsx` is refactored to drive its body animation through the selected preset + governor instead of hardcoded tweens.

**Tech Stack:** Motion Canvas 3.17 (`@motion-canvas/2d`, `@motion-canvas/core`), Node 22.18 (native TS type-stripping for `.ts` imports in `.mjs` tests), `node --test`.

## Global Constraints

- **Node ≥ 22.18** — tests import `.ts` via native type-stripping; do not add a TS loader.
- **`@motion-canvas/core` and `@motion-canvas/2d` are NOT node-importable** (directory-import error). Any module a `*.test.mjs` imports MUST NOT import them, even transitively. Runtime choreography lives only in `motion.ts` (vite-only) — never unit-tested directly; verified by rendering.
- **Deterministic only** — no `Math.random()`, no `Date.now()` inside presets. Variation derives from node/step index. (CI reproducibility + the render must be stable.)
- **CI = headless xvfb + headed chromium**, `RENDER_HEADED=1`. No new npm deps. Pure Motion Canvas primitives only. Bounded particle/ghost counts (hard-coded caps, ≤6).
- **Duration target 15–20s**, ~17s nominal. Brand intro/title/outro are fixed and unchanged; only the per-scene body is governed.
- **Fallback safety** — unknown/missing `spec.motion` resolves to `classic`; the autonomous pipeline must never crash on a bad preset name.
- **Existing tests stay green:** `render/src/lib/spec.test.mjs`, `brain/*.test.mjs`, `fetch/*.test.mjs`, `publish/*.test.mjs`.
- **Run tests from the `render/` dir** for render-lib tests: `cd render && node --test src/lib/`. Root tests: `node --test` from repo root.

## File Structure

- **Create** `render/src/lib/pacing.ts` — pure governor: `specShape(spec)`, `computePacing(shape, targetSec)`, `Pacing`/`SpecShape` types. No motion-canvas import.
- **Create** `render/src/lib/pacing.test.mjs` — governs duration invariant across spec shapes.
- **Create** `render/src/lib/motion-registry.mjs` — pure metadata: `MOTION_META` (name/stagger/weight), `MOTION_NAMES`, `MOTION_TARGET(weight)`, `pickMotion(n)`. No motion-canvas import.
- **Create** `render/src/lib/motion.test.mjs` — validates the registry contract. Imports ONLY `motion-registry.mjs`.
- **Create** `render/src/lib/motion.ts` — runtime: `MotionPreset`, `MotionCtx`, `HOOKS` (12 bundles), `MOTION_PRESETS`, `resolvePreset(name)`. Imports `@motion-canvas/core`, type-only from `@motion-canvas/2d`, and `MOTION_META` from `motion-registry.mjs`. Vite-only.
- **Modify** `render/src/scenes/explainer.tsx` — consume `resolvePreset` + `computePacing`; replace hardcoded body tweens.
- **Modify** `run-daily.mjs` — import `MOTION_NAMES`/`pickMotion` from `motion-registry.mjs`, rotate, write `spec.motion`, record in history.

---

## Task 1: Pacing governor (pure)

**Files:**
- Create: `render/src/lib/pacing.ts`
- Test: `render/src/lib/pacing.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SpecShape { scenes: number; totalNodes: number; totalSteps: number }`
  - `interface Pacing { enter: number; lines: number; step: number; hold: number; stagger: number }`
  - `function specShape(spec: {scenes: {nodes: unknown[]; steps: unknown[]}[]}): SpecShape`
  - `function computePacing(shape: SpecShape, targetSec: number): Pacing`
  - `const FIXED_SEC = 4.0` (intro+title+outro, not governed)
  - `function estimateTotalSec(shape: SpecShape, p: Pacing): number` (used by tests + governor)

- [ ] **Step 1: Write the failing test**

Create `render/src/lib/pacing.test.mjs`:

```js
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

test('realistic shapes land total in [15,20]s', () => {
  for (const [sc, st] of [[1, 1], [1, 2], [1, 3], [2, 2], [3, 2]]) {
    const s = shape(sc, st);
    const p = computePacing(s, 17);
    const total = estimateTotalSec(s, p);
    assert.ok(total >= 15 && total <= 20, `scenes=${sc} steps/scene=${st} → ${total.toFixed(1)}s out of band`);
  }
});

test('more steps → shorter per-step (never below floor)', () => {
  const few = computePacing(shape(1, 2), 17);
  const many = computePacing(shape(1, 6), 17);
  assert.ok(many.step <= few.step, 'denser spec should compress per-step');
  assert.ok(many.step >= 0.4, 'per-step must not collapse below 0.4s floor');
});

test('all pacing fields are positive finite numbers', () => {
  const p = computePacing(shape(1, 3), 17);
  for (const k of ['enter', 'lines', 'step', 'hold', 'stagger']) {
    assert.ok(Number.isFinite(p[k]) && p[k] >= 0, `${k}=${p[k]}`);
  }
});

test('FIXED_SEC is the constant intro/outro overhead', () => {
  assert.equal(FIXED_SEC, 4.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd render && node --test src/lib/pacing.test.mjs`
Expected: FAIL — `Cannot find module './pacing.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `render/src/lib/pacing.ts`:

```ts
// Duration governor: turns a spec's shape into per-phase animation durations
// so total runtime lands in the 15-20s band regardless of content density.
// PURE — no @motion-canvas import (must stay node-testable).

export interface SpecShape {
  scenes: number;
  totalNodes: number;
  totalSteps: number;
}

export interface Pacing {
  enter: number;   // per-node entrance duration
  lines: number;   // connector reveal duration
  step: number;    // per-packet flight duration (the moving part)
  hold: number;    // dwell + fade after each step
  stagger: number; // resolved delay between staggered node entrances
}

// Intro (brand) + title + outro — constant, not governed.
export const FIXED_SEC = 4.0;

// Per-scene setup that isn't per-step: container fade + node entrances + lines + fade-out.
const SCENE_SETUP_SEC = 1.3;
const STEP_FLOOR = 0.4;
const STEP_CEIL = 2.2;

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
  const steps = Math.max(shape.totalSteps, 1);
  const body = targetSec - FIXED_SEC - shape.scenes * SCENE_SETUP_SEC;
  // Per-step budget covers flight + a fraction of dwell.
  let step = clamp(body / steps, STEP_FLOOR + 0.2, STEP_CEIL);
  const flight = step * 0.72;
  const hold = step * 0.28;
  return {
    enter: 0.5,
    lines: 0.4,
    step: round(flight),
    hold: round(hold),
    stagger: 0, // preset overrides via MotionCtx; default simultaneous
  };
}

export function estimateTotalSec(shape: SpecShape, p: Pacing): number {
  return FIXED_SEC
    + shape.scenes * SCENE_SETUP_SEC
    + shape.totalSteps * (p.step + p.hold);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number): number {
  return Math.round(v * 100) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd render && node --test src/lib/pacing.test.mjs`
Expected: PASS (5 tests). If a shape lands outside [15,20], tune `SCENE_SETUP_SEC` / the `step` clamp bounds until green — do not weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add render/src/lib/pacing.ts render/src/lib/pacing.test.mjs
git commit -m "feat(byteflow): duration governor for 15-20s pacing"
```

---

## Task 2: Motion registry metadata (pure)

**Files:**
- Create: `render/src/lib/motion-registry.mjs`
- Test: `render/src/lib/motion.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MOTION_META: {name: string, stagger: number, weight: number}[]` (length 12)
  - `MOTION_NAMES: string[]`
  - `function pickMotion(n: number): {name, stagger, weight}` — `MOTION_META[n % 12]`
  - `function motionTarget(weight: number): number` — nominal 16.5 + weight, clamped [15, 19.5]

- [ ] **Step 1: Write the failing test**

Create `render/src/lib/motion.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_META, MOTION_NAMES, pickMotion, motionTarget} from './motion-registry.mjs';

test('exactly 12 presets, names unique', () => {
  assert.equal(MOTION_META.length, 12);
  assert.equal(MOTION_NAMES.length, 12);
  assert.equal(new Set(MOTION_NAMES).size, 12);
});

test('classic exists (fallback preset)', () => {
  assert.ok(MOTION_NAMES.includes('classic'));
});

test('every meta entry has name/stagger/weight of correct types', () => {
  for (const m of MOTION_META) {
    assert.equal(typeof m.name, 'string');
    assert.ok(m.name.length > 0);
    assert.equal(typeof m.stagger, 'number');
    assert.ok(m.stagger >= 0);
    assert.equal(typeof m.weight, 'number');
  }
});

test('pickMotion rotates by index and wraps', () => {
  assert.equal(pickMotion(0).name, MOTION_NAMES[0]);
  assert.equal(pickMotion(12).name, MOTION_NAMES[0]);
  assert.equal(pickMotion(13).name, MOTION_NAMES[1]);
});

test('motionTarget stays inside the 15-19.5s band', () => {
  for (const m of MOTION_META) {
    const t = motionTarget(m.weight);
    assert.ok(t >= 15 && t <= 19.5, `${m.name} → ${t}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd render && node --test src/lib/motion.test.mjs`
Expected: FAIL — `Cannot find module './motion-registry.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `render/src/lib/motion-registry.mjs`:

```js
// PURE metadata for the motion-preset rotation. No @motion-canvas import so it
// is importable by run-daily.mjs (pipeline) and node --test. The runtime
// choreography for each name lives in motion.ts (vite-only).
// weight nudges the per-video duration target: calmer presets breathe longer,
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
  return MOTION_META[((n % MOTION_META.length) + MOTION_META.length) % MOTION_META.length];
}

export function motionTarget(weight) {
  const t = 16.5 + weight;
  return Math.max(15, Math.min(19.5, t));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd render && node --test src/lib/motion.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add render/src/lib/motion-registry.mjs render/src/lib/motion.test.mjs
git commit -m "feat(byteflow): motion preset registry (12 names + rotation)"
```

---

## Task 3: Runtime framework + `classic` preset, wire into scene (parity)

Prove the new architecture end-to-end with ONE preset that reproduces today's look, governed to 15-20s. No new visual style yet — this is the refactor + parity gate.

**Files:**
- Create: `render/src/lib/motion.ts`
- Modify: `render/src/scenes/explainer.tsx`

**Interfaces:**
- Consumes: `MOTION_META` from `./motion-registry.mjs`; `Pacing`, `computePacing`, `specShape`, `FIXED_SEC` from `./pacing.ts`; `COLORS`, `resolveColor` from `./spec`.
- Produces (from `motion.ts`):
  - `interface MotionCtx { accent: string; colors: typeof COLORS; pacing: Pacing }`
  - `interface MotionPreset { name: string; stagger: number; enter(box, i, count, ctx): ThreadGenerator; drawLines(lines, ctx): ThreadGenerator; flight(from, to, packet, container, ctx): ThreadGenerator; exit(container, view, ctx): ThreadGenerator; ambient?(view, ctx): void; }`
  - `function resolvePreset(name: string | undefined): MotionPreset` — falls back to `classic`.

- [ ] **Step 1: Create `render/src/lib/motion.ts` with the framework + `classic`**

```ts
import {Rect, Txt, Line, Layout, View2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutBack, waitFor, type ThreadGenerator} from '@motion-canvas/core';
import {COLORS} from './spec';
import type {Pacing} from './pacing';
import {MOTION_META} from './motion-registry.mjs';

export interface MotionCtx {
  accent: string;
  colors: typeof COLORS;
  pacing: Pacing;
}

export interface MotionPreset {
  name: string;
  stagger: number;
  enter(box: Rect, i: number, count: number, ctx: MotionCtx): ThreadGenerator;
  drawLines(lines: Line[], ctx: MotionCtx): ThreadGenerator;
  flight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx): ThreadGenerator;
  exit(container: Layout, view: View2D, ctx: MotionCtx): ThreadGenerator;
  ambient?(view: View2D, ctx: MotionCtx): void;
}

// ---- Shared building blocks reused across presets ----
function* fadeExit(container: Layout, dur = 0.4): ThreadGenerator {
  yield* container.opacity(0, dur);
}

// ---- Hook bundles keyed by preset name (must cover every MOTION_META entry) ----
type Hooks = Omit<MotionPreset, 'name' | 'stagger'>;

const HOOKS: Record<string, Hooks> = {
  classic: {
    *enter(box, _i, _c, ctx) {
      yield* box.scale(1, ctx.pacing.enter, easeOutBack);
    },
    *drawLines(lines, ctx) {
      if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
    },
    *flight(from, to, packet, _container, ctx) {
      yield* packet.opacity(1, 0.2);
      yield* all(
        packet.x(to.x(), ctx.pacing.step, easeInOutCubic),
        packet.y(to.y(), ctx.pacing.step, easeInOutCubic),
      );
      yield* all(packet.opacity(0, 0.2), to.stroke(ctx.accent, 0.2));
      yield* waitFor(ctx.pacing.hold);
      yield* to.stroke(ctx.colors.stroke, 0.3);
    },
    *exit(container) {
      yield* fadeExit(container);
    },
  },
};

// Guard: every registry name must have a hook bundle, else fail loudly at render.
for (const m of MOTION_META) {
  if (!HOOKS[m.name]) throw new Error(`motion.ts: no hooks for preset "${m.name}"`);
}

export const MOTION_PRESETS: MotionPreset[] = MOTION_META.map(m => ({
  name: m.name,
  stagger: m.stagger,
  ...HOOKS[m.name],
}));

export function resolvePreset(name: string | undefined): MotionPreset {
  return MOTION_PRESETS.find(p => p.name === name) ?? MOTION_PRESETS.find(p => p.name === 'classic')!;
}
```

Note: the Task-2 guard loop throws if any of the other 11 names lack hooks — so this file will THROW until Task 4 adds them. To keep Task 3 independently renderable, temporarily seed the 11 missing names as aliases of `classic` at the end of `HOOKS` construction:

```ts
// TEMPORARY (removed in Task 4): alias not-yet-implemented presets to classic
for (const m of MOTION_META) if (!HOOKS[m.name]) HOOKS[m.name] = HOOKS.classic;
```
Place this alias loop BEFORE the guard loop. Task 4 deletes it as each real preset lands.

- [ ] **Step 2: Refactor `explainer.tsx` to drive body via preset + pacing**

Replace the imports and the per-scene body. New `explainer.tsx`:

```tsx
import {makeScene2D, Rect, Txt, Layout, Line} from '@motion-canvas/2d';
import {all, createRef, waitFor, sequence} from '@motion-canvas/core';
import {COLORS, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import {specShape, computePacing} from '../lib/pacing';
import {resolvePreset} from '../lib/motion';
import {motionTarget} from '../lib/motion-registry.mjs';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';
const ACCENT = spec.theme ?? COLORS.accent;

const preset = resolvePreset((spec as any).motion);
const metaWeight = 0; // pacing target from preset weight is looked up below
const target = motionTarget(
  // weight lives in registry; resolvePreset returns MotionPreset without weight,
  // so recompute target from the preset name's meta via motion-registry:
  (globalThis as any).__nope ?? 0,
);

function connectors(layout: string, count: number): [number, number][] {
  const segs: [number, number][] = [];
  if (layout === 'hub-spoke') {
    for (let i = 1; i < count; i++) segs.push([0, i]);
  } else if (layout === 'cycle') {
    for (let i = 0; i < count; i++) segs.push([i, (i + 1) % count]);
  } else {
    for (let i = 0; i < count - 1; i++) segs.push([i, i + 1]);
  }
  return segs;
}

export default makeScene2D(function* (view) {
  view.fill(COLORS.bg);
  const pacing = computePacing(specShape(spec), pacingTarget);

  // ---- Brand intro (unchanged) ----
  const brand = createRef<Txt>();
  const brandSub = createRef<Txt>();
  view.add(<Txt ref={brand} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={96} fontWeight={800} letterSpacing={12} opacity={0} y={-40} />);
  view.add(<Txt ref={brandSub} text="@byteflowlabs" fill={ACCENT} fontFamily={MONO}
    fontSize={40} letterSpacing={6} opacity={0} y={60} />);
  yield* brand().opacity(1, 0.5);
  yield* brandSub().opacity(1, 0.3);
  yield* waitFor(0.6);
  yield* all(brand().opacity(0, 0.4), brandSub().opacity(0, 0.4));

  // ---- Title (unchanged) ----
  const title = createRef<Txt>();
  view.add(<Txt ref={title} text={spec.title.toUpperCase()} fill={COLORS.muted}
    fontFamily={MONO} fontSize={46} letterSpacing={4} y={-780} opacity={0}
    width={960} textAlign="center" textWrap />);
  yield* title().opacity(1, 0.4);

  const ctx = {accent: ACCENT, colors: COLORS, pacing};
  preset.ambient?.(view, ctx);

  for (const scene of spec.scenes) {
    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={0} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={COLORS.text}
      fontFamily={MONO} fontSize={40} y={-520} opacity={0.9} />);

    const count = scene.nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const iconSize = Math.round(h * 0.34);
    const labelSize = Math.min(28, Math.round(w * 0.11));

    const lines: Line[] = [];
    connectors(scene.layout, count).forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={COLORS.stroke} lineWidth={3} lineDash={[10, 10]} end={0} />,
      );
      lines.push(ln());
    });

    const boxes: Record<string, Rect> = {};
    scene.nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={w} height={h} radius={24} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={pos[i].x} y={pos[i].y} scale={0}>
          {n.icon ? <Txt text={n.icon} fontSize={iconSize} y={-h * 0.16} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={labelSize} y={h * 0.22} />
        </Rect>,
      );
      boxes[n.id] = box();
    });

    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={38} y={560} />);

    // Scene appears → node entrances (staggered per preset) → connectors
    yield* container().opacity(1, 0.4);
    const entrances = scene.nodes.map((n, i) => preset.enter(boxes[n.id], i, count, ctx));
    if (preset.stagger > 0) yield* sequence(preset.stagger, ...entrances);
    else yield* all(...entrances);
    yield* preset.drawLines(lines, ctx);

    for (const step of scene.steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent', ACCENT);
      const packet = createRef<Rect>();
      container().add(
        <Rect ref={packet} width={100} height={58} radius={13} fill={col}
          x={from.x()} y={from.y()} opacity={0}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={24} fontWeight={700} />
        </Rect>,
      );
      status().text(step.status);
      status().fill(col);
      const stepCtx = {...ctx, accent: col};
      yield* preset.flight(from, to, packet(), container(), stepCtx);
    }

    yield* waitFor(0.4);
    yield* preset.exit(container(), view, ctx);
    container().remove();
  }

  // ---- Brand outro (unchanged) ----
  yield* title().opacity(0, 0.3);
  const outro = createRef<Txt>();
  const cta = createRef<Txt>();
  view.add(<Txt ref={outro} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={88} fontWeight={800} letterSpacing={12} opacity={0} y={-30} />);
  view.add(<Txt ref={cta} text="follow @byteflowlabs for more" fill={ACCENT}
    fontFamily={MONO} fontSize={38} opacity={0} y={60} />);
  yield* all(outro().opacity(1, 0.5), cta().opacity(1, 0.5));
  yield* waitFor(1.2);
});
```

- [ ] **Step 3: Fix the pacing-target wiring (clean it up)**

The draft above has a placeholder `pacingTarget`/`metaWeight` mess. Resolve it cleanly: export the weight from `resolvePreset` by returning the meta too. Change `motion.ts` `resolvePreset` to also attach `weight`:

In `motion.ts`, add `weight: number` to `MotionPreset` and include `weight: m.weight` in the `MOTION_PRESETS` map. Then in `explainer.tsx` replace the broken target block with:

```tsx
import {motionTarget} from '../lib/motion-registry.mjs';
// ...
const preset = resolvePreset((spec as any).motion);
const pacingTarget = motionTarget(preset.weight);
```
Delete the `metaWeight`/`target`/`__nope` lines entirely.

- [ ] **Step 4: Render and verify parity + duration**

Ensure a spec exists: `cp scene-spec.generated.json render/scene-spec.json` (or use the current `render/scene-spec.json`). Set `"motion": "classic"` in it.

Run: `cd render && set RENDER_HEADED=1&& npm run render` (PowerShell: `$env:RENDER_HEADED='1'; npm run render`)
Expected: `render/output/project.mp4` produced. Then check duration:

Run: `node -e "const{execFileSync}=require('child_process');console.log(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nk=1:nw=1','render/output/project.mp4']).toString())"`
Expected: a number in **[15, 20]**. Visually: nodes pop, packets glide, scenes crossfade — same look as before, just paced longer.

If duration is short (governor not stretching): confirm `computePacing` is actually driving `step`/`hold`. If a `.ts`→`.mjs` import error appears in vite, confirm `motion-registry.mjs` path is exactly `./motion-registry.mjs`.

- [ ] **Step 5: Commit**

```bash
git add render/src/lib/motion.ts render/src/scenes/explainer.tsx
git commit -m "feat(byteflow): preset-driven scene architecture + classic parity"
```

---

## Task 4: Implement the remaining 11 presets

Add each preset's hook bundle to `HOOKS` in `motion.ts`, deleting its `classic` alias. Work in small groups; render-verify a sample per group. All deterministic, all bounded.

**Files:**
- Modify: `render/src/lib/motion.ts`

**Interfaces:**
- Consumes: everything from Task 3. Add easing/util imports as needed:
  `import {all, sequence, delay, waitFor, tween, easeInOutCubic, easeOutBack, easeOutElastic, easeOutBounce, easeInOutQuad, easeOutQuad, easeInQuad, linear, Vector2, type ThreadGenerator} from '@motion-canvas/core';`
- Produces: `HOOKS` covering all 12 names; delete the temporary alias loop from Task 3.

**Per-preset choreography spec** (implement each as a `Hooks` bundle). Three archetypes are given in full; the rest follow the same primitives.

**Archetype A — `spring`** (elastic entrance + parabolic arc packet + zoom-punch exit):

```ts
spring: {
  *enter(box, _i, _c, ctx) {
    yield* box.scale(1, ctx.pacing.enter * 1.4, easeOutElastic);
  },
  *drawLines(lines, ctx) {
    if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
  },
  *flight(from, to, packet, _container, ctx) {
    const a = new Vector2(from.x(), from.y());
    const b = new Vector2(to.x(), to.y());
    const mid = a.add(b).scale(0.5).addY(-Math.abs(b.x - a.x) * 0.4 - 120); // lift the arc
    yield* packet.opacity(1, 0.15);
    yield* tween(ctx.pacing.step, t => {
      const e = easeInOutCubic(t);
      // quadratic bezier a→mid→b
      const p = a.lerp(mid, e).lerp(mid.lerp(b, e), e);
      packet.position(p);
    });
    yield* all(packet.opacity(0, 0.2), to.stroke(ctx.accent, 0.2));
    yield* waitFor(ctx.pacing.hold);
    yield* to.stroke(ctx.colors.stroke, 0.3);
  },
  *exit(container, _view, _ctx) {
    yield* all(container.scale(1.15, 0.35, easeInQuad), container.opacity(0, 0.35));
  },
},
```

**Archetype B — `terminal`** (typewriter label decode + marching-ants line with running dot + glitch exit):

```ts
terminal: {
  *enter(box, _i, _c, ctx) {
    // find the label Txt child (last child) and type it out
    const label = box.children().at(-1) as Txt;
    const full = label.text();
    label.text('');
    yield* box.scale(1, 0.2);
    yield* tween(ctx.pacing.enter, t => {
      const k = Math.round(easeInOutQuad(t) * full.length);
      label.text(full.slice(0, k));
    });
    label.text(full);
  },
  *drawLines(lines, ctx) {
    if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
    // animate the dash offset a little for a "live wire" feel
    yield* all(...lines.map(l => l.lineDashOffset(-40, ctx.pacing.lines * 1.5, linear)));
  },
  *flight(from, to, packet, container, ctx) {
    // hide the box packet; run a small dot along the connector instead
    packet.opacity(0);
    const dot = new (packet.constructor as any)({
      width: 26, height: 26, radius: 13, fill: ctx.accent,
      x: from.x(), y: from.y(),
    });
    container.add(dot);
    yield* all(dot.x(to.x(), ctx.pacing.step, easeInOutCubic), dot.y(to.y(), ctx.pacing.step, easeInOutCubic));
    yield* all(dot.opacity(0, 0.2), to.stroke(ctx.accent, 0.2));
    dot.remove();
    yield* waitFor(ctx.pacing.hold);
    yield* to.stroke(ctx.colors.stroke, 0.3);
  },
  *exit(container, _view, _ctx) {
    // deterministic glitch: 3 quick index-seeded x jitters, then fade
    for (const dx of [14, -10, 6]) {
      yield* container.x(dx, 0.05);
    }
    yield* all(container.x(0, 0.05), container.opacity(0, 0.25));
  },
},
```

**Archetype C — `pulse`** (blur-in focus pull + glow wave along wire + crossfade):

```ts
pulse: {
  *enter(box, _i, _c, ctx) {
    box.filters.blur(24);
    yield* all(box.scale(1, ctx.pacing.enter), box.filters.blur(0, ctx.pacing.enter));
  },
  *drawLines(lines, ctx) {
    if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
  },
  *flight(from, to, packet, container, ctx) {
    packet.opacity(0);
    const glow = new (packet.constructor as any)({
      width: 40, height: 40, radius: 20, fill: ctx.accent,
      x: from.x(), y: from.y(), shadowColor: ctx.accent, shadowBlur: 30, opacity: 0,
    });
    container.add(glow);
    yield* glow.opacity(1, 0.15);
    yield* all(glow.x(to.x(), ctx.pacing.step, easeInOutQuad), glow.y(to.y(), ctx.pacing.step, easeInOutQuad));
    yield* all(glow.opacity(0, 0.25), to.stroke(ctx.accent, 0.2));
    glow.remove();
    yield* waitFor(ctx.pacing.hold);
    yield* to.stroke(ctx.colors.stroke, 0.3);
  },
  *exit(container) { yield* container.opacity(0, 0.5); },
},
```

**Remaining 8 — implement from the same primitives** (each a `Hooks` bundle):

- **`cascade`**: `enter` = slide-in from off-canvas edge chosen by `i%2` (`box.position.x(box.x()±600→box.x())`) with `easeOutBack`, relies on `stagger`. `flight` = comet-trail: spawn ≤5 ghost rects along path at `delay(i*0.05)` each fading. `exit` = `all(container.x(-400), container.opacity(0))` push-left.
- **`burst`**: `enter` = classic scale-pop. `flight` = 5 small particle rects streamed along the path with staggered `delay`, main packet hidden. `exit` = `container.scale(0.85)+opacity(0)` zoom-out.
- **`cinematic`**: `ambient(view)` = spawn a slow `view.scale(1→1.06)` over ~18s via `view.scale(1.06, 18, linear)` started with `view` (Ken Burns). `enter` = fade `box.opacity(0→1)` + slight `scale(0.9→1)`. `flight` = arc (reuse `spring` arc math). `exit` = crossfade.
- **`neon`**: `enter` = scale-pop with `box.shadowBlur(0→24)` glow. `flight` = comet (reuse cascade's trail) in accent with shadow. `exit` = glitch (reuse `terminal` glitch).
- **`blueprint`**: `enter` = draw box as outline first: set `box.fill(null)` then `box.scale(1)` + after entrances restore `fill` via `box.fill(COLORS.card, 0.3)`. `flight` = dash-runner: a small dot travels while `to.stroke` pulses. `exit` = slide.
- **`matrix`**: `enter` = box drops from `y-200` with `easeOutBounce` + label decode (reuse terminal typewriter). `flight` = packet falls: move to target with `easeInQuad` (gravity feel). `exit` = fade.
- **`punch`**: `enter` = anticipation: `box.scale(0→0.85, 0.12)` then `scale(1.0, 0.18, easeOutBack)`. `flight` = fast straight with `easeOutQuad` at `pacing.step*0.8`. `exit` = zoom-punch (reuse spring exit).
- **`wave`**: `enter` = scale-pop, relies on large `stagger` for a wave. `flight` = pulse-wave (reuse `pulse` glow). `exit` = crossfade.

- [ ] **Step 1: Remove the temporary alias loop**, then add the 3 archetype bundles (`spring`, `terminal`, `pulse`) to `HOOKS`.

- [ ] **Step 2: Render-verify the archetypes.** For each of `spring`, `terminal`, `pulse`: set `"motion"` in `render/scene-spec.json`, run `npm run render` (headed), confirm mp4 renders without error, duration ∈ [15,20], and the style visibly differs. Fix any Motion Canvas API mismatch (e.g. `filters.blur`, `lineDashOffset`, `Vector2` methods) against `@motion-canvas/2d` types before moving on.

- [ ] **Step 3: Implement the remaining 8 bundles** (`cascade`, `burst`, `cinematic`, `neon`, `blueprint`, `matrix`, `punch`, `wave`) per the spec above.

- [ ] **Step 4: Render-verify a sample** (`cascade`, `cinematic`, `blueprint`, `punch`) the same way. Confirm no preset throws under headed chromium and all land in the duration band.

- [ ] **Step 5: Run the full unit suite** to confirm nothing regressed:

Run: `cd render && node --test src/lib/` then from repo root `node --test`
Expected: all PASS (pacing, motion-registry, spec, brain, fetch, publish).

- [ ] **Step 6: Commit**

```bash
git add render/src/lib/motion.ts
git commit -m "feat(byteflow): 11 additional motion presets (spring, terminal, pulse, cascade, burst, cinematic, neon, blueprint, matrix, punch, wave)"
```

---

## Task 5: Wire rotation into the daily pipeline + end-to-end verification

**Files:**
- Modify: `run-daily.mjs`

**Interfaces:**
- Consumes: `MOTION_NAMES`, `pickMotion` from `render/src/lib/motion-registry.mjs`.
- Produces: `spec.motion` written into both spec JSON files; `motion` recorded in `posted-history.json` entries.

- [ ] **Step 1: Import the registry and rotate**

In `run-daily.mjs`, after the existing `LAYOUTS`/`THEMES` block, add:

```js
import {MOTION_NAMES, pickMotion} from './render/src/lib/motion-registry.mjs';
```
(Place with the other imports at the top.)

Then in the rotation section (after `const n = history.length;`), add:

```js
const motion = pickMotion(n).name; // orthogonal 3rd axis; 12-cycle
spec.motion = motion;
```
Add `motion` to the console log and the history entry:

```js
console.log(`✓ spec (${source}): ${spec.title} [${layout} / ${motion} / ${theme}]`);
// ...
history.push({title: spec.title, layout, motion, theme, source, date: new Date().toISOString().slice(0, 10)});
```

- [ ] **Step 2: Verify `run-daily.mjs` imports the `.mjs` cleanly under plain node**

Run: `node -e "import('./render/src/lib/motion-registry.mjs').then(m=>console.log('names:',m.MOTION_NAMES.length,'pick3:',m.pickMotion(3).name))"`
Expected: `names: 12 pick3: cascade` (no import error — proves the pipeline can load it).

- [ ] **Step 3: Dry-run the spec-writing half of the pipeline**

Temporarily confirm the rotation writes `motion` by running the pre-render logic. Simplest: run the full daily with a guard, OR manually verify by adding a throwaway node check:

Run: `node -e "import('./render/src/lib/motion-registry.mjs').then(({pickMotion})=>{for(let n=0;n<13;n++)process.stdout.write(pickMotion(n).name+' ')}).then(()=>console.log())"`
Expected: prints the 12 names in order then wraps to `classic` at n=12.

- [ ] **Step 4: Full end-to-end render for two consecutive `n` values**

Simulate two runs to confirm different presets render back-to-back. For `n = current history length` and `n+1`, set `render/scene-spec.json`'s `"motion"` to `pickMotion(n).name` and `pickMotion(n+1).name` respectively, render each, and confirm both produce a valid mp4 in [15,20]s with visibly different motion.

(If `GEMINI_API_KEY` is set in `.env`, a true end-to-end `node --env-file=.env run-daily.mjs` is the strongest check — but it costs an API call and renders; the two-render simulation above is sufficient and free.)

- [ ] **Step 5: Update the design-doc note & the render/scene-spec.json committed sample**

Ensure `render/scene-spec.json` and `scene-spec.generated.json` either carry a `motion` field or omit it (fallback handles both). No code change needed; just confirm the fallback path by rendering a spec with NO `motion` key → must render as `classic`.

Run: remove `"motion"` from `render/scene-spec.json`, `npm run render` → expect a valid classic render (proves fallback).

- [ ] **Step 6: Commit**

```bash
git add run-daily.mjs
git commit -m "feat(byteflow): rotate motion preset per run (3rd variety axis)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- ≥10 presets (12) → Tasks 2 (metadata) + 3/4 (hooks). ✅
- Sequential rotation → Task 5 (`pickMotion(n)`). ✅
- Orthogonal to layout/theme → Task 5 keeps `layout=n%4`, adds `motion=pickMotion(n)`. ✅
- 15–20s duration → Task 1 governor + render checks in Tasks 3/4. ✅
- CI-safe/deterministic → Global Constraints + bounded/no-RNG preset specs. ✅
- Fallback on bad name → Task 3 `resolvePreset` + Task 5 Step 5 verification. ✅
- Gemini schema/prompt untouched → not modified in any task; `motion` post-injected. ✅
- Tests stay green → Task 4 Step 5. ✅

**Placeholder scan:** Task 3's draft intentionally flags a messy `pacingTarget` block and Step 3 cleans it — resolved inline, not left as TODO. No "TBD/handle edge cases" remain.

**Type consistency:** `resolvePreset` returns `MotionPreset` which Task 3 Step 3 extends with `weight` (used by `explainer.tsx`). `Pacing` fields (`enter/lines/step/hold/stagger`) are consistent between `pacing.ts` (Task 1), `motion.ts` hooks, and `explainer.tsx`. `MotionCtx` shape identical across `motion.ts` and `explainer.tsx`. Hook signatures `(box,i,count,ctx)` / `(from,to,packet,container,ctx)` match between interface and every bundle.

**Note on Task 4 archetypes:** 3 presets are given as complete code; 8 are specified as precise recompositions of those primitives (exact easing, technique, and reused blocks named). This is deliberate — they share three implementation patterns; the render-verify steps (4.2, 4.4) are the gate that each actually works against the live `@motion-canvas/2d` API.
