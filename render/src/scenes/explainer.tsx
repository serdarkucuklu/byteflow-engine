import {makeScene2D, Rect, Txt, Layout, Line} from '@motion-canvas/2d';
import {all, createRef, waitFor, sequence, spawn, easeOutCubic} from '@motion-canvas/core';
import {COLORS, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import {specShape, computePacing} from '../lib/pacing';
import {resolvePreset} from '../lib/motion';
import {motionTarget} from '../lib/motion-registry.mjs';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';
const ACCENT = spec.theme ?? COLORS.accent; // per-video accent theme
const HOOK = spec.hook ?? spec.title;
const TAKEAWAY = spec.takeaway ?? 'follow @byteflowlabs for more';

const preset = resolvePreset((spec as {motion?: string}).motion);
const pacing = computePacing(specShape(spec), motionTarget(preset.weight));

// Connector segments (index pairs) per layout.
function connectors(layout: string, count: number): [number, number][] {
  const segs: [number, number][] = [];
  if (layout === 'hub-spoke') {
    for (let i = 1; i < count; i++) segs.push([0, i]);
  } else if (layout === 'cycle') {
    for (let i = 0; i < count; i++) segs.push([i, (i + 1) % count]);
  } else {
    for (let i = 0; i < count - 1; i++) segs.push([i, i + 1]); // flow / vertical-stack
  }
  return segs;
}

export default makeScene2D(function* (view) {
  view.fill(COLORS.bg);

  // ---- Hook (first frame) ----
  const hook = createRef<Txt>();
  const hookTag = createRef<Txt>();
  view.add(<Txt ref={hook} text={HOOK} fill={COLORS.text} fontFamily={MONO}
    fontSize={72} fontWeight={800} letterSpacing={2} opacity={0} y={-30}
    width={960} textAlign="center" textWrap />);
  view.add(<Txt ref={hookTag} text="@byteflowlabs" fill={ACCENT} fontFamily={MONO}
    fontSize={36} letterSpacing={6} opacity={0} y={160} />);
  yield* hook().opacity(1, 0.35);
  yield* hookTag().opacity(1, 0.25);
  yield* waitFor(1.1);
  yield* all(hook().opacity(0, 0.35), hookTag().opacity(0, 0.35));

  // ---- Title (persistent) ----
  const title = createRef<Txt>();
  view.add(<Txt ref={title} text={spec.title.toUpperCase()} fill={COLORS.text}
    fontFamily={MONO} fontSize={54} fontWeight={700} letterSpacing={3} y={-760} opacity={0}
    width={980} textAlign="center" textWrap />);
  yield* title().opacity(1, 0.4);

  const ctx = {accent: ACCENT, colors: COLORS, pacing};
  const amb = preset.ambient?.(view, ctx);
  if (amb) yield spawn(amb); // background flourish (e.g. cinematic Ken Burns)

  // ---- Each scene ----
  for (const scene of spec.scenes) {
    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={0} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={ACCENT}
      fontFamily={MONO} fontSize={50} fontWeight={600} letterSpacing={1} y={-470} opacity={0.95} />);

    const count = scene.nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const iconSize = Math.round(h * 0.44);
    const labelSize = Math.min(44, Math.round(w * 0.14));

    // Ambient accent glow behind the cluster — adds depth + fills the frame.
    container().add(<Rect width={760} height={760} radius={380} fill={ACCENT}
      opacity={0.05} shadowColor={ACCENT} shadowBlur={160} y={-20} />);

    // Connectors (behind nodes, drawn after).
    const lines: Line[] = [];
    connectors(scene.layout, count).forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={COLORS.stroke} lineWidth={4} lineDash={[12, 12]} end={0} />,
      );
      lines.push(ln());
    });

    // Nodes — big, tactile "module" cards with soft depth.
    const boxes: Record<string, Rect> = {};
    scene.nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={w} height={h} radius={34} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={pos[i].x} y={pos[i].y} scale={0}
          shadowColor={'#00000066'} shadowBlur={32} shadowOffsetY={12}>
          {n.icon ? <Txt text={n.icon} fontSize={iconSize} y={-h * 0.17} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={labelSize}
            fontWeight={600} letterSpacing={2} y={h * 0.26} />
        </Rect>,
      );
      boxes[n.id] = box();
    });

    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={46} fontWeight={500} letterSpacing={1} y={640} />);

    // Scene appears → node entrances (per preset, staggered) → connectors.
    yield* container().opacity(1, 0.4);
    const entrances = scene.nodes.map((n, i) => preset.enter(boxes[n.id], i, count, ctx));
    if (preset.stagger > 0) yield* sequence(preset.stagger, ...entrances);
    else yield* all(...entrances);
    yield* preset.drawLines(lines, ctx);

    // Steps: packet flight (per preset).
    for (const step of scene.steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent', ACCENT);
      const packet = createRef<Rect>();
      container().add(
        <Rect ref={packet} width={132} height={76} radius={20} fill={col}
          x={from.x()} y={from.y()} opacity={0}
          shadowColor={col} shadowBlur={28}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={32} fontWeight={800} />
        </Rect>,
      );
      status().text(step.status);
      status().fill(col);
      yield* preset.flight(from, to, packet(), container(), {...ctx, accent: col});
    }

    // Recap burst: replay the whole flow at once (governed; fills time engagingly).
    if (pacing.recap > 0 && scene.steps.length > 1) {
      status().text('the full flow');
      status().fill(ACCENT);
      const dots = scene.steps.map(step => {
        const from = boxes[step.from], to = boxes[step.to];
        if (!from || !to) return null;
        const dot = createRef<Rect>();
        container().add(<Rect ref={dot} width={30} height={30} radius={15}
          fill={resolveColor(step.color ?? 'accent', ACCENT)} x={from.x()} y={from.y()} opacity={0} />);
        return {dot: dot(), to};
      }).filter(Boolean) as {dot: Rect; to: Rect}[];
      yield* all(...dots.map(d => d.dot.opacity(1, 0.15)));
      yield* all(...dots.map(d => all(
        d.dot.x(d.to.x(), pacing.recap, easeOutCubic),
        d.dot.y(d.to.y(), pacing.recap, easeOutCubic),
      )));
      yield* all(...dots.map(d => d.dot.opacity(0, 0.2)));
    }

    // Final read-hold on the finished diagram, then preset-specific exit.
    yield* waitFor(pacing.finalDwell);
    yield* preset.exit(container(), view, ctx);
    container().remove();
  }

  // ---- Takeaway + follow (outro) ----
  yield* title().opacity(0, 0.3);
  const take = createRef<Txt>();
  const follow = createRef<Txt>();
  view.add(<Txt ref={take} text={TAKEAWAY} fill={COLORS.text} fontFamily={MONO}
    fontSize={60} fontWeight={800} letterSpacing={1} opacity={0} y={-40}
    width={960} textAlign="center" textWrap />);
  view.add(<Txt ref={follow} text="follow @byteflowlabs · AI systems, no hype" fill={ACCENT}
    fontFamily={MONO} fontSize={34} opacity={0} y={150} />);
  yield* all(take().opacity(1, 0.5), follow().opacity(1, 0.5));
  yield* waitFor(1.4);
});
