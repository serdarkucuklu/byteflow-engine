import {makeScene2D, Rect, Txt, Layout, Line} from '@motion-canvas/2d';
import {all, createRef, waitFor, easeInOutCubic, easeOutBack} from '@motion-canvas/core';
import {COLORS, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';
const ACCENT = spec.theme ?? COLORS.accent; // video başına dönen tema rengi

// Layout'a göre konnektör segmentleri (index çiftleri).
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

  // ---- Brand intro (sabit) ----
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

  // ---- Başlık (kalıcı) ----
  const title = createRef<Txt>();
  view.add(<Txt ref={title} text={spec.title.toUpperCase()} fill={COLORS.muted}
    fontFamily={MONO} fontSize={46} letterSpacing={4} y={-780} opacity={0}
    width={960} textAlign="center" textWrap />);
  yield* title().opacity(1, 0.4);

  // ---- Her sahne ----
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

    // Konnektör çizgileri (node'ların arkasında, sonradan çizilir)
    const lines: Line[] = [];
    connectors(scene.layout, count).forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={COLORS.stroke} lineWidth={3} lineDash={[10, 10]} end={0} />,
      );
      lines.push(ln());
    });

    // Node'lar
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

    // Sahne belirir: node'lar → konnektörler
    yield* container().opacity(1, 0.4);
    yield* all(...scene.nodes.map(n => boxes[n.id].scale(1, 0.5, easeOutBack)));
    if (lines.length) yield* all(...lines.map(l => l.end(1, 0.4)));

    // Adımlar: paket uçuşu (x+y'ye animate → her layout'ta çalışır)
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
      yield* packet().opacity(1, 0.2);
      yield* all(
        packet().x(to.x(), 1.0, easeInOutCubic),
        packet().y(to.y(), 1.0, easeInOutCubic),
      );
      yield* all(packet().opacity(0, 0.2), to.stroke(col, 0.2));
      yield* waitFor(0.2);
      yield* to.stroke(COLORS.stroke, 0.3);
    }

    yield* waitFor(0.4);
    yield* container().opacity(0, 0.4);
    container().remove();
  }

  // ---- Brand outro (sabit) ----
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
