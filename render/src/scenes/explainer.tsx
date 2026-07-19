import {makeScene2D, Rect, Txt, Layout, Line, Code, LezerHighlighter} from '@motion-canvas/2d';
import {all, createRef, waitFor, easeOutCubic, easeInOutCubic} from '@motion-canvas/core';
import {COLORS, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import {specShape, computePacing} from '../lib/pacing';
import {motionTarget} from '../lib/motion-registry.mjs';
import {byteflowHighlighter} from '../lib/codeHighlighter';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';
const ACCENT = spec.theme ?? COLORS.accent; // per-video accent theme
const HOOK = spec.hook ?? spec.title;
const TAKEAWAY = spec.takeaway ?? 'follow @byteflowlabs for more';

const BUILDUP_WEIGHT = 1;                 // build-up sakin/okunur → ~17.5s hedef
const pacing = computePacing(specShape(spec), motionTarget(BUILDUP_WEIGHT));

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

  // ---- Each scene ----
  for (const scene of spec.scenes) {
    if (scene.kind === 'code' && scene.code) {
      yield* renderCodeScene(view, scene, ctx);
      continue;
    }
    // ---- Diagram scene: KADEMELİ KURULUM ----
    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={1} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={ACCENT}
      fontFamily={MONO} fontSize={46} fontWeight={600} letterSpacing={1} y={-540} opacity={0} />);
    yield* heading().opacity(0.95, 0.4);

    const nodes = scene.nodes!;
    const steps = scene.steps!;
    const count = nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const iconSize = Math.round(h * 0.42);
    const labelSize = Math.min(38, Math.round(w * 0.15));

    // subtle glow behind everything (never over labels)
    container().add(<Rect width={680} height={680} radius={340} fill={ACCENT}
      opacity={0.045} shadowColor={ACCENT} shadowBlur={140} y={0} zIndex={-2} />);

    // connector segments (index pairs) — build toward each new node
    const segs = connectors(scene.layout, count);

    // pre-create boxes (hidden, scale 0.7 + opacity 0 → gentle pop) + connector
    // lines (end 0), z-ordered: line < box < label
    const boxes: Record<string, Rect> = {};
    const boxByIndex: Rect[] = [];
    const nodeIndexById: Record<string, number> = {};
    nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={w} height={h} radius={26} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={pos[i].x} y={pos[i].y} scale={0.7} opacity={0} zIndex={1}
          shadowColor={'#00000055'} shadowBlur={24} shadowOffsetY={10}>
          {n.icon ? <Txt text={n.icon} fontSize={iconSize} y={-h * 0.16} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={labelSize}
            fontWeight={600} letterSpacing={1} y={h * 0.27} />
        </Rect>,
      );
      boxes[n.id] = box();
      boxByIndex[i] = box();
      nodeIndexById[n.id] = i;
    });
    const lineByTarget = new Map<number, Line[]>();
    const lineByPair = new Map<string, Line>();     // undirected index-pair → connector, for step lookup
    const allLines: Line[] = [];
    segs.forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={COLORS.stroke} lineWidth={4} lineDash={[10, 10]} end={0} zIndex={0} />,
      );
      const tgt = Math.max(a, b);                       // node that "completes" this edge
      (lineByTarget.get(tgt) ?? lineByTarget.set(tgt, []).get(tgt)!).push(ln());
      lineByPair.set(a < b ? `${a}-${b}` : `${b}-${a}`, ln());
      allLines.push(ln());
    });

    // status line (below the cluster, never overlapped)
    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={40} fontWeight={500} letterSpacing={1} y={600} opacity={0} zIndex={2} />);

    // BUILD PHASE: node 0 in; then for each next node, grow its incoming edges then pop it in.
    // Gentle entrance: easeOutCubic scale 0.7→1 + opacity 0→1, no bounce/overshoot.
    yield* all(boxByIndex[0].scale(1, pacing.enter, easeOutCubic), boxByIndex[0].opacity(1, pacing.enter, easeOutCubic));
    for (let i = 1; i < count; i++) {
      const incoming = lineByTarget.get(i) ?? [];
      if (incoming.length) yield* all(...incoming.map(l => l.end(1, pacing.lines, easeOutCubic)));
      yield* all(boxByIndex[i].scale(1, pacing.enter, easeOutCubic), boxByIndex[i].opacity(1, pacing.enter, easeOutCubic));
    }
    // (Her kenarın max(a,b) hedefi ≥1 → flow/hub-spoke/cycle/stack hepsinde her connector
    //  yukarıdaki build döngüsünde hedef node belirince çizilir; ekstra guard'a gerek yok.)

    // DATA PHASE: each step illuminates its connector (solid, brightened, endpoints
    // accented) and glides a SMALL glow dot + small packet-label chip along it —
    // one connection lit at a time, guiding the eye, instead of a box flying the
    // whole zigzag. Other connectors dim a touch so the active one stands out.
    const restShadow = '#00000055';
    for (const step of steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent', ACCENT);
      const fi = nodeIndexById[step.from], ti = nodeIndexById[step.to];
      const line = fi !== undefined && ti !== undefined
        ? lineByPair.get(fi < ti ? `${fi}-${ti}` : `${ti}-${fi}`)
        : undefined;
      const others = allLines.filter(l => l !== line);

      const dot = createRef<Rect>();
      container().add(
        <Rect ref={dot} width={26} height={26} radius={13} fill={col}
          x={from.x()} y={from.y()} opacity={0} zIndex={3} shadowColor={col} shadowBlur={18} />,
      );
      const chip = createRef<Rect>();
      container().add(
        <Rect ref={chip} width={64} height={36} radius={10} fill={col}
          x={from.x()} y={from.y() - 44} opacity={0} zIndex={3} shadowColor={col} shadowBlur={10}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={18} fontWeight={800} />
        </Rect>,
      );

      yield* all(status().text(step.status), status().fill(col), status().opacity(1, 0.25));

      // illuminate: active wire brightens + solidifies, endpoints glow, dot/chip fade in
      yield* all(
        ...(line ? [line.stroke(col, 0.2), line.lineWidth(7, 0.2), line.lineDash([], 0.2)] : []),
        ...others.map(l => l.opacity(0.4, 0.2)),
        from.stroke(col, 0.2), from.shadowColor(col, 0.2), from.shadowBlur(40, 0.2),
        to.stroke(col, 0.2),
        dot().opacity(1, 0.15), chip().opacity(1, 0.15),
      );

      // travel: small dot + small chip glide together along the connector
      yield* all(
        dot().position([to.x(), to.y()], pacing.step, easeInOutCubic),
        chip().position([to.x(), to.y() - 44], pacing.step, easeInOutCubic),
      );

      // arrive: fade dot/chip BEFORE they rest on the label; target takes the glow
      yield* all(dot().opacity(0, 0.18), chip().opacity(0, 0.18), to.shadowColor(col, 0.2), to.shadowBlur(40, 0.2));
      yield* waitFor(pacing.hold + 0.5);                            // +0.5s readability hold

      // revert: connector + both nodes back to resting look
      yield* all(
        ...(line ? [line.stroke(COLORS.stroke, 0.3), line.lineWidth(4, 0.3), line.lineDash([10, 10], 0.3)] : []),
        ...others.map(l => l.opacity(1, 0.3)),
        from.stroke(COLORS.stroke, 0.3), from.shadowColor(restShadow, 0.3), from.shadowBlur(24, 0.3),
        to.stroke(COLORS.stroke, 0.3), to.shadowColor(restShadow, 0.3), to.shadowBlur(24, 0.3),
      );
      dot().remove();
      chip().remove();
    }

    // brief recap: run the whole flow once as small dots (governed)
    if (pacing.recap > 0 && steps.length > 1) {
      yield* all(status().text('the full flow'), status().fill(ACCENT));
      const dots = steps.map(step => {
        const from = boxes[step.from], to = boxes[step.to];
        if (!from || !to) return null;
        const dot = createRef<Rect>();
        container().add(<Rect ref={dot} width={22} height={22} radius={11} zIndex={3}
          fill={resolveColor(step.color ?? 'accent', ACCENT)} x={from.x()} y={from.y()} opacity={0} />);
        return {dot: dot(), to};
      }).filter(Boolean) as {dot: Rect; to: Rect}[];
      yield* all(...dots.map(d => d.dot.opacity(1, 0.15)));
      yield* all(...dots.map(d => all(d.dot.x(d.to.x(), pacing.recap, easeOutCubic), d.dot.y(d.to.y(), pacing.recap, easeOutCubic))));
      yield* all(...dots.map(d => d.dot.opacity(0, 0.2)));
    }

    // final read-hold (+0.5s) then fade out
    yield* waitFor(pacing.finalDwell + 0.5);
    yield* all(status().opacity(0, 0.3), container().opacity(0, 0.5));
    container().remove();
  }

  // ---- Takeaway + persona sign-off (outro) ----
  yield* title().opacity(0, 0.3);
  const take = createRef<Txt>();
  const sign = createRef<Txt>();
  const tag = createRef<Txt>();
  view.add(<Txt ref={take} text={TAKEAWAY} fill={COLORS.text} fontFamily={MONO}
    fontSize={60} fontWeight={800} letterSpacing={1} opacity={0} y={-40}
    width={960} textAlign="center" textWrap />);
  view.add(<Txt ref={sign} text="— Kai · @byteflowlabs" fill={ACCENT} fontFamily={MONO}
    fontSize={38} fontWeight={600} letterSpacing={2} opacity={0} y={140} />);
  view.add(<Txt ref={tag} text="AI systems, no hype" fill={COLORS.muted} fontFamily={MONO}
    fontSize={30} letterSpacing={3} opacity={0} y={210} />);
  yield* all(take().opacity(1, 0.5), sign().opacity(1, 0.5));
  yield* tag().opacity(1, 0.4);
  yield* waitFor(1.4);
});

function* renderCodeScene(view: any, scene: any, ctx: any) {
  const container = createRef<Layout>();
  view.add(<Layout ref={container} opacity={0} />);

  if (scene.heading) {
    container().add(<Txt text={scene.heading} fill={ctx.accent} fontFamily={MONO}
      fontSize={48} fontWeight={600} letterSpacing={1} y={-620} opacity={0.95} />);
  }

  // Kod kartı (arka plan) + Code node.
  container().add(<Rect width={980} height={880} radius={28} fill={COLORS.card}
    stroke={COLORS.stroke} lineWidth={3} shadowColor={'#00000066'} shadowBlur={40} shadowOffsetY={14} y={-10} />);

  const code = createRef<Code>();
  container().add(
    <Code ref={code} highlighter={byteflowHighlighter as unknown as LezerHighlighter}
      fontFamily={MONO} fontSize={40} offsetX={-1} offsetY={-1} x={-430} y={-390} code={''} />,
  );

  if (scene.annotation) {
    container().add(<Txt text={scene.annotation} fill={COLORS.muted} fontFamily={MONO}
      fontSize={40} fontWeight={500} y={520} width={960} textAlign="center" textWrap opacity={0.9} />);
  }

  yield* container().opacity(1, 0.4);

  // Reveal: typing (varsayılan) satır satır süreyle yazar; instant tek seferde.
  const full = scene.code as string;
  // Code needs real reading time — scale the post-typing hold with line count
  // (bounded) instead of the diagram-oriented finalDwell alone, so a single
  // code-scene video lands in the 15-20s brand band without pushing mixed
  // (code + diagram) specs past the ceiling.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const lineCount = (full.match(/\n/g)?.length ?? 0) + 1;
  const readHold = clamp(lineCount * 2.6 - 4.0, ctx.pacing.finalDwell, 9);
  if (scene.reveal === 'instant') {
    code().code(full);
    yield* waitFor(readHold);
  } else {
    // Kod tween — CodeSignal ile hedef koda "yazılır" (typing hissi).
    yield* code().code(full, Math.min(2.4, Math.max(1.2, full.length / 90)));
    yield* waitFor(readHold);
  }

  yield* container().opacity(0, 0.4);
  container().remove();
}
