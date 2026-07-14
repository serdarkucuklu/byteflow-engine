import {Rect, Txt, Line, Layout, View2D} from '@motion-canvas/2d';
import {
  all, delay, waitFor, tween,
  easeInOutCubic, easeOutCubic, easeInQuad, easeOutQuad, easeInOutQuad,
  easeOutBack, easeOutElastic, easeOutBounce, linear,
  Vector2, type ThreadGenerator,
} from '@motion-canvas/core';
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
  ambient?(view: View2D, ctx: MotionCtx): ThreadGenerator | void;
}

type Hooks = Pick<MotionPreset, 'enter' | 'drawLines' | 'flight' | 'exit' | 'ambient'>;

// ================= Shared building blocks =================
// Every flight keeps a fixed ~0.7s budget beyond `step` (in 0.2 + out 0.2 +
// stroke reset 0.3) so pacing.ts's STEP_FIXED estimate stays accurate.

function* drawLinesDefault(lines: Line[], ctx: MotionCtx): ThreadGenerator {
  if (lines.length) yield* all(...lines.map(l => l.end(1, ctx.pacing.lines)));
}
function* drawLinesLive(lines: Line[], ctx: MotionCtx): ThreadGenerator {
  if (!lines.length) return;
  yield* all(...lines.flatMap(l => [
    l.end(1, ctx.pacing.lines),
    l.lineDashOffset(-30, ctx.pacing.lines, linear),
  ]));
}

// Common flight tail: fade the mover out, flash the target, governed hold, reset.
function* land(to: Rect, mover: Rect, ctx: MotionCtx): ThreadGenerator {
  yield* all(mover.opacity(0, 0.2), to.stroke(ctx.accent, 0.2));
  yield* waitFor(ctx.pacing.hold);
  yield* to.stroke(ctx.colors.stroke, 0.3);
}

function makeDot(container: Layout, x: number, y: number, color: string, size = 30, glow = false): Rect {
  const dot = new Rect({
    width: size, height: size, radius: size / 2, fill: color, x, y, opacity: 0,
    ...(glow ? {shadowColor: color, shadowBlur: 28} : {}),
  });
  container.add(dot);
  return dot;
}

function labelOf(box: Rect): Txt | null {
  const txts = box.children().filter((n): n is Txt => n instanceof Txt);
  return txts[txts.length - 1] ?? null; // label is added after the icon
}

// ---- Flight variants ----
function* straightFlight(from: Rect, to: Rect, packet: Rect, ctx: MotionCtx, ease = easeInOutCubic): ThreadGenerator {
  yield* packet.opacity(1, 0.2);
  yield* all(packet.x(to.x(), ctx.pacing.step, ease), packet.y(to.y(), ctx.pacing.step, ease));
  yield* land(to, packet, ctx);
}

function* arcFlight(from: Rect, to: Rect, packet: Rect, ctx: MotionCtx): ThreadGenerator {
  const a = new Vector2(from.x(), from.y());
  const b = new Vector2(to.x(), to.y());
  const lift = Math.max(120, Math.abs(b.x - a.x) * 0.4);
  const mid = a.add(b).scale(0.5).addY(-lift);
  yield* packet.opacity(1, 0.2);
  yield* tween(ctx.pacing.step, t => {
    const e = easeInOutCubic(t);
    packet.position(Vector2.lerp(Vector2.lerp(a, mid, e), Vector2.lerp(mid, b, e), e));
  });
  yield* land(to, packet, ctx);
}

function* fallingFlight(from: Rect, to: Rect, packet: Rect, ctx: MotionCtx): ThreadGenerator {
  yield* packet.opacity(1, 0.2);
  yield* all(
    packet.x(to.x(), ctx.pacing.step, easeInOutQuad),
    packet.y(to.y(), ctx.pacing.step, easeInQuad), // gravity feel
  );
  yield* land(to, packet, ctx);
}

function* runnerFlight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx, glow = false, size = 26): ThreadGenerator {
  packet.opacity(0);
  const dot = makeDot(container, from.x(), from.y(), ctx.accent, size, glow);
  yield* dot.opacity(1, 0.2);
  yield* all(dot.x(to.x(), ctx.pacing.step, easeInOutCubic), dot.y(to.y(), ctx.pacing.step, easeInOutCubic));
  yield* land(to, dot, ctx);
  dot.remove();
}

function* cometFlight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx): ThreadGenerator {
  const a = new Vector2(from.x(), from.y());
  const b = new Vector2(to.x(), to.y());
  const GHOSTS = 5;
  packet.opacity(0);
  const ghosts = Array.from({length: GHOSTS}, (_, i) => makeDot(container, a.x, a.y, ctx.accent, 48 - i * 6, i === 0));
  yield* all(...ghosts.map((g, i) =>
    delay(i * 0.05, all(
      g.opacity(0.55 - i * 0.09, 0.1),
      tween(ctx.pacing.step, t => g.position(Vector2.lerp(a, b, easeInOutCubic(t)))),
      g.opacity(0, 0.2),
    )),
  ));
  ghosts.forEach(g => g.remove());
  yield* to.stroke(ctx.accent, 0.2);
  yield* waitFor(ctx.pacing.hold);
  yield* to.stroke(ctx.colors.stroke, 0.3);
}

function* particleFlight(from: Rect, to: Rect, packet: Rect, container: Layout, ctx: MotionCtx): ThreadGenerator {
  const a = new Vector2(from.x(), from.y());
  const b = new Vector2(to.x(), to.y());
  const N = 5;
  packet.opacity(0);
  const ps = Array.from({length: N}, () => makeDot(container, a.x, a.y, ctx.accent, 18));
  yield* all(...ps.map((p, i) =>
    delay(i * 0.06, all(
      p.opacity(1, 0.1),
      tween(ctx.pacing.step, t => {
        const e = easeOutQuad(t);
        const spread = (i - (N - 1) / 2) * 18 * (1 - e); // spread that converges on arrival
        p.position(Vector2.lerp(a, b, e).addY(spread));
      }),
      p.opacity(0, 0.15),
    )),
  ));
  ps.forEach(p => p.remove());
  yield* to.stroke(ctx.accent, 0.2);
  yield* waitFor(ctx.pacing.hold);
  yield* to.stroke(ctx.colors.stroke, 0.3);
}

// ---- Entrance variants ----
function* enterPop(box: Rect, ctx: MotionCtx): ThreadGenerator {
  yield* box.scale(1, ctx.pacing.enter, easeOutBack);
}
function* enterElastic(box: Rect, ctx: MotionCtx): ThreadGenerator {
  yield* box.scale(1, ctx.pacing.enter * 1.4, easeOutElastic);
}
function* enterSlide(box: Rect, i: number, ctx: MotionCtx): ThreadGenerator {
  const home = box.x();
  box.x(home + (i % 2 === 0 ? -700 : 700));
  box.scale(1);
  yield* box.x(home, ctx.pacing.enter * 1.3, easeOutBack);
}
function* enterFocus(box: Rect, ctx: MotionCtx): ThreadGenerator {
  box.scale(1.3);
  box.opacity(0); // box JSX defaults opacity to 1 — start hidden so the focus-pull reads
  yield* all(box.scale(1, ctx.pacing.enter, easeOutCubic), box.opacity(1, ctx.pacing.enter));
}
function* enterFade(box: Rect, ctx: MotionCtx): ThreadGenerator {
  box.scale(0.92);
  box.opacity(0); // start hidden so the fade-in actually shows
  yield* all(box.scale(1, ctx.pacing.enter, easeOutCubic), box.opacity(1, ctx.pacing.enter));
}
function* enterNeon(box: Rect, ctx: MotionCtx): ThreadGenerator {
  box.shadowColor(ctx.accent);
  yield* all(box.scale(1, ctx.pacing.enter, easeOutBack), box.shadowBlur(24, ctx.pacing.enter));
}
function* enterBlueprint(box: Rect, ctx: MotionCtx): ThreadGenerator {
  const fill = box.fill();
  box.fill(null);
  box.stroke(ctx.accent);
  box.scale(1);
  yield* box.lineWidth(6, ctx.pacing.enter * 0.5);
  yield* all(box.fill(fill, ctx.pacing.enter * 0.5), box.lineWidth(3, ctx.pacing.enter * 0.5), box.stroke(ctx.colors.stroke, ctx.pacing.enter * 0.5));
}
function* enterType(box: Rect, ctx: MotionCtx): ThreadGenerator {
  const label = labelOf(box);
  yield* box.scale(1, 0.2, easeOutBack);
  if (label) {
    const full = label.text();
    label.text('');
    yield* tween(Math.max(ctx.pacing.enter, 0.4), t => {
      label.text(full.slice(0, Math.round(easeInOutQuad(t) * full.length)));
    });
    label.text(full);
  } else {
    yield* waitFor(ctx.pacing.enter);
  }
}
function* enterDrop(box: Rect, ctx: MotionCtx): ThreadGenerator {
  const home = box.y();
  box.y(home - 240);
  box.scale(1);
  yield* box.y(home, ctx.pacing.enter * 1.4, easeOutBounce);
}
function* enterPunch(box: Rect, ctx: MotionCtx): ThreadGenerator {
  yield* box.scale(0.82, ctx.pacing.enter * 0.35, easeInQuad); // anticipation from 0
  yield* box.scale(1, ctx.pacing.enter * 0.65, easeOutBack);   // overshoot
}

// ---- Exit variants ----
function* exitFade(container: Layout): ThreadGenerator {
  yield* container.opacity(0, 0.5);
}
function* exitZoom(container: Layout): ThreadGenerator {
  yield* all(container.scale(1.18, 0.4, easeInQuad), container.opacity(0, 0.4));
}
function* exitSlide(container: Layout): ThreadGenerator {
  yield* all(container.x(container.x() - 560, 0.42, easeInQuad), container.opacity(0, 0.42));
}
function* exitGlitch(container: Layout): ThreadGenerator {
  for (const dx of [16, -12, 8, -5]) yield* container.x(dx, 0.045);
  yield* all(container.x(0, 0.045), container.opacity(0, 0.22));
}

// ================= Hook bundles =================
const HOOKS: Record<string, Hooks> = {
  classic: {
    enter: (box, _i, _c, ctx) => enterPop(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, _con, ctx) => straightFlight(from, to, packet, ctx),
    exit: container => exitFade(container),
  },
  terminal: {
    enter: (box, _i, _c, ctx) => enterType(box, ctx),
    drawLines: drawLinesLive,
    flight: (from, to, packet, con, ctx) => runnerFlight(from, to, packet, con, ctx),
    exit: container => exitGlitch(container),
  },
  spring: {
    enter: (box, _i, _c, ctx) => enterElastic(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, _con, ctx) => arcFlight(from, to, packet, ctx),
    exit: container => exitZoom(container),
  },
  cascade: {
    enter: (box, i, _c, ctx) => enterSlide(box, i, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, con, ctx) => cometFlight(from, to, packet, con, ctx),
    exit: container => exitSlide(container),
  },
  pulse: {
    enter: (box, _i, _c, ctx) => enterFocus(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, con, ctx) => runnerFlight(from, to, packet, con, ctx, true, 40),
    exit: container => exitFade(container),
  },
  burst: {
    enter: (box, _i, _c, ctx) => enterPop(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, con, ctx) => particleFlight(from, to, packet, con, ctx),
    exit: container => exitZoom(container),
  },
  cinematic: {
    enter: (box, _i, _c, ctx) => enterFade(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, _con, ctx) => arcFlight(from, to, packet, ctx),
    exit: container => exitFade(container),
    ambient: (view) => view.scale(1.06, 18, linear), // slow Ken Burns push (spawned)
  },
  neon: {
    enter: (box, _i, _c, ctx) => enterNeon(box, ctx),
    drawLines: drawLinesLive,
    flight: (from, to, packet, con, ctx) => cometFlight(from, to, packet, con, ctx),
    exit: container => exitGlitch(container),
  },
  blueprint: {
    enter: (box, _i, _c, ctx) => enterBlueprint(box, ctx),
    drawLines: drawLinesLive,
    flight: (from, to, packet, con, ctx) => runnerFlight(from, to, packet, con, ctx),
    exit: container => exitSlide(container),
  },
  matrix: {
    enter: (box, _i, _c, ctx) => enterDrop(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, _con, ctx) => fallingFlight(from, to, packet, ctx),
    exit: container => exitFade(container),
  },
  punch: {
    enter: (box, _i, _c, ctx) => enterPunch(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, _con, ctx) => straightFlight(from, to, packet, ctx, easeOutQuad),
    exit: container => exitZoom(container),
  },
  wave: {
    enter: (box, _i, _c, ctx) => enterPop(box, ctx),
    drawLines: drawLinesDefault,
    flight: (from, to, packet, con, ctx) => runnerFlight(from, to, packet, con, ctx, true, 40),
    exit: container => exitFade(container),
  },
};

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
