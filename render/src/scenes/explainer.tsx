import {makeScene2D, Rect, Txt, Line, Layout} from '@motion-canvas/2d';
import {all, createRef, waitFor, easeInOutCubic, easeOutBack} from '@motion-canvas/core';
import {COLORS, resolveColor, nodeXPositions, type SceneSpec} from '../lib/spec';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';

export default makeScene2D(function* (view) {
  view.fill(COLORS.bg);

  // ---- Brand intro ----
  const brand = createRef<Txt>();
  const brandSub = createRef<Txt>();
  view.add(<Txt ref={brand} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={96} fontWeight={800} letterSpacing={12} opacity={0} y={-40} />);
  view.add(<Txt ref={brandSub} text="@byteflow" fill={COLORS.accent} fontFamily={MONO}
    fontSize={40} letterSpacing={6} opacity={0} y={60} />);
  yield* brand().opacity(1, 0.5);
  yield* brandSub().opacity(1, 0.3);
  yield* waitFor(0.6);
  yield* all(brand().opacity(0, 0.4), brandSub().opacity(0, 0.4));

  // ---- Persistent title (topic) ----
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

    // Nodes
    const xs = nodeXPositions(scene.nodes.length);
    const boxes: Record<string, Rect> = {};
    scene.nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={300} height={220} radius={28} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={xs[i]} y={0} scale={0}>
          {n.icon ? <Txt text={n.icon} fontSize={72} y={-34} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={28} y={50} />
        </Rect>,
      );
      boxes[n.id] = box();
    });

    // Status satırı
    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={38} y={520} />);

    // Sahneyi göster
    yield* container().opacity(1, 0.4);
    yield* all(...scene.nodes.map(n => boxes[n.id].scale(1, 0.5, easeOutBack)));

    // Adımlar: paket uçuşu
    for (const step of scene.steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent');
      const packet = createRef<Rect>();
      container().add(
        <Rect ref={packet} width={110} height={64} radius={14} fill={col}
          x={from.x()} y={from.y()} opacity={0}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={26} fontWeight={700} />
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
    yield* container().opacity(0, 0.4); // sahneler arası fade geçiş
    container().remove();
  }

  // ---- Brand outro ----
  yield* title().opacity(0, 0.3);
  const outro = createRef<Txt>();
  const cta = createRef<Txt>();
  view.add(<Txt ref={outro} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={88} fontWeight={800} letterSpacing={12} opacity={0} y={-30} />);
  view.add(<Txt ref={cta} text="follow @byteflow for more" fill={COLORS.accent}
    fontFamily={MONO} fontSize={38} opacity={0} y={60} />);
  yield* all(outro().opacity(1, 0.5), cta().opacity(1, 0.5));
  yield* waitFor(1.2);
});
