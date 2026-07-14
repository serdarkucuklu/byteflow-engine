import {Rect, Line, Layout, View2D} from '@motion-canvas/2d';
import {all, easeInOutCubic, easeOutBack, waitFor, type ThreadGenerator} from '@motion-canvas/core';
import {COLORS} from './spec';
import type {Pacing} from './pacing';
import {MOTION_META} from './motion-registry.mjs';

export interface MotionCtx {
  accent: string;              // resolved color for the current step
  colors: typeof COLORS;
  pacing: Pacing;
}

export interface MotionPreset {
  name: string;
  stagger: number;
  weight: number;
  enter(box: Rect, i: number, count: number, ctx: MotionCtx): ThreadGenerator;
  drawLines(lines: Line[], ctx: MotionCtx): ThreadGenerator;
  flight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx): ThreadGenerator;
  exit(container: Layout, view: View2D, ctx: MotionCtx): ThreadGenerator;
  ambient?(view: View2D, ctx: MotionCtx): void;
}

type Hooks = Pick<MotionPreset, 'enter' | 'drawLines' | 'flight' | 'exit' | 'ambient'>;

// ---- Shared building blocks reused across presets ----
function* drawLinesDefault(lines: Line[], ctx: MotionCtx): ThreadGenerator {
  if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
}
function* fadeExit(container: Layout, dur = 0.5): ThreadGenerator {
  yield* container.opacity(0, dur);
}

// ---- Hook bundles keyed by preset name ----
const HOOKS: Record<string, Hooks> = {
  classic: {
    *enter(box, _i, _c, ctx) {
      yield* box.scale(1, ctx.pacing.enter, easeOutBack);
    },
    drawLines: drawLinesDefault,
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

// TEMPORARY (removed task-by-task in the 11-preset task): alias not-yet-implemented
// presets to classic so the scene renders end-to-end while the architecture is proven.
for (const m of MOTION_META) if (!HOOKS[m.name]) HOOKS[m.name] = HOOKS.classic;

// Guard: every registry name must have a hook bundle, else fail loudly at render.
for (const m of MOTION_META) {
  if (!HOOKS[m.name]) throw new Error(`motion.ts: no hooks for preset "${m.name}"`);
}

export const MOTION_PRESETS: MotionPreset[] = MOTION_META.map(m => ({
  name: m.name,
  stagger: m.stagger,
  weight: m.weight,
  ...HOOKS[m.name],
}));

export function resolvePreset(name: string | undefined): MotionPreset {
  return MOTION_PRESETS.find(p => p.name === name)
    ?? MOTION_PRESETS.find(p => p.name === 'classic')!;
}
