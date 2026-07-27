import {makeScene2D, Rect, Txt, Layout, Line, Path, Code, LezerHighlighter} from '@motion-canvas/2d';
import {all, delay, createRef, waitFor, useThread, easeOutCubic, easeInOutCubic, easeOutQuad} from '@motion-canvas/core';
import {COLORS, FONTS, CAPTION_Y, CLUSTER_Y, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import {specShape, computePacing} from '../lib/pacing';
import {motionTarget} from '../lib/motion-registry.mjs';
import {byteflowHighlighter} from '../lib/codeHighlighter';
import {brandOf} from '../lib/brands';
import specJson from '../../scene-spec.json';

// ─────────────────────────────────────────────────────────────────────────────
// GÖRSEL DİL (2026-07-27 yeniden tasarım — Serdar geri bildirimi)
//   "yazısı daha tatlı olmalı, okunabilir · şekiller köşelere savruluyor ·
//    aralarında tren gibi git-gel var · en premium hâli bu değil · video karmaşık"
//
//   1. TİPOGRAFİ  — kelimeler Inter'de (mono sadece kod + sistem satırı).
//   2. KOMPOZİSYON— tek kolon / ortalanmış halka, güvenli alan, köşe yok.
//   3. HAREKET    — kartlar aşağıdan süzülerek gelir (stagger); aktif bağlantıda
//                   TEK YÖNLÜ bir ışık darbesi geçer; git-gel ve "tam akış" tekrarı yok.
//   4. ODAK       — her an tek şey vurgulanır, gerisi söner. Sadelik = anlaşılırlık.
//   5. MARKA      — gerçek ürün sembolleri (Claude, Gemini, DeepSeek…) emoji yerine.
// ─────────────────────────────────────────────────────────────────────────────

const spec = specJson as unknown as SceneSpec;
const ACCENT = spec.theme ?? COLORS.accent;
const HOOK = spec.hook ?? spec.title;
const TAKEAWAY = spec.takeaway ?? 'follow @byteflowlabs for more';

// Footage modunda sahne şeffaf render edilir (arka planı ffmpeg dolduruyor).
const FOOTAGE = spec.footage === true;
const SHADOW = FOOTAGE ? {shadowColor: '#000000e6', shadowBlur: 30} : {};

const BUILDUP_WEIGHT = 1;
const pacing = computePacing(specShape(spec), motionTarget(BUILDUP_WEIGHT));

// SES OTORİTE: seslendirme varsa her beat'in süresi ölçülmüştür; görsel ona uyar.
// beats[0]=hook, beats[1..n]=adımlar, beats[son]=kapanış. Yoksa eski governor devrede.
const BEATS = Array.isArray(spec.beats) && spec.beats.length >= 3 ? spec.beats : null;
const beatDur = (i: number, fallback: number) => (BEATS?.[i]?.dur ?? fallback);
const beatStart = (i: number) => BEATS?.[i]?.start ?? null;

// MUTLAK ZAMAN SENKRONU: göreli sürelerin toplamı sapıyor (ilk sesli koşuda ses 23.9s iken
// video 27.3s oldu → altyazı konuşmanın gerisine düştü). Her beat'in BAŞINDA sahne saatini
// sesin zamanına çekiyoruz; sapma birikmiyor, fazlalık sonraki beat'in molasından kesiliyor.
function* syncTo(t: number | null) {
  if (t == null) return;
  const delta = t - useThread().time();
  if (delta > 0.02) yield* waitFor(delta);
}
const nowSec = () => useThread().time();

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CARD_FILL = '#0f151dfa';        // koyu ve neredeyse opak: footage üstünde de okunur
const CARD_STROKE = '#28323f';
const RISE = 34;                      // kartların süzülerek geldiği mesafe

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

// Kart içi görsel: marka sembolü (varsa) → emoji → yok.
function nodeGlyph(node: {icon?: string; brand?: string}, size: number, index: number, accent: string) {
  const brand = brandOf(node.brand);
  // Sembol SABİT boyutlu bir kutuya konur: Path'in kendi sınır kutusu flex düzende yer
  // ayırmıyordu ve logo etiketin ALTINDA kalıyordu (2026-07-27 CI karesinde görüldü).
  if (brand?.path) {
    return (
      <Rect width={size} height={size} justifyContent="center" alignItems="center">
        <Path data={brand.path} fill={brand.color} scale={size / 24} />
      </Rect>
    );
  }
  if (brand) {
    return (
      <Rect width={size * 1.75} height={size * 0.82} radius={10} fill={`${brand.color}26`}
        stroke={`${brand.color}70`} lineWidth={1.5} justifyContent="center" alignItems="center">
        <Txt text={brand.label} fill={brand.color} fontFamily={FONTS.display}
          fontSize={Math.round(size * 0.44)} fontWeight={800} letterSpacing={-0.2} />
      </Rect>
    );
  }
  // Marka yoksa emoji DEĞİL, numaralı rozet: koyu arayüzde emoji ucuz duruyor; numara hem
  // premium hem de adım sırasını görsel olarak öğretiyor (Serdar: "en premium hâli bu değil").
  return (
    <Rect width={size} height={size} radius={size / 2} fill={`${accent}1f`}
      stroke={`${accent}59`} lineWidth={1.5} justifyContent="center" alignItems="center">
      <Txt text={String(index + 1).padStart(2, '0')} fill={accent} fontFamily={FONTS.display}
        fontSize={Math.round(size * 0.42)} fontWeight={800} letterSpacing={-0.5} />
    </Rect>
  );
}

export default makeScene2D(function* (view) {
  if (!FOOTAGE) view.fill(COLORS.bg);

  // ── HOOK ──────────────────────────────────────────────────────────────────
  const hook = createRef<Txt>();
  const hookRule = createRef<Rect>();
  const hookTag = createRef<Txt>();
  view.add(<Txt ref={hook} text={HOOK} fill={COLORS.text} fontFamily={FONTS.display}
    fontSize={78} fontWeight={800} letterSpacing={-1.4} lineHeight={90} opacity={0.55} y={-16}
    width={900} textAlign="center" textWrap {...SHADOW} />);
  view.add(<Rect ref={hookRule} width={0} height={4} radius={2} fill={ACCENT} y={150} opacity={0.9} />);
  view.add(<Txt ref={hookTag} text="@byteflowlabs" fill={COLORS.muted} fontFamily={FONTS.mono}
    fontSize={30} letterSpacing={4} opacity={0} y={210} {...SHADOW} />);
  // 0.22sn'de tam görünür: ilk kare zaten okunuyor, sadece "oturuyor".
  yield* all(hook().opacity(1, 0.22, easeOutCubic), hook().y(-30, 0.5, easeOutCubic));
  yield* all(hookRule().width(180, 0.45, easeOutCubic), hookTag().opacity(0.85, 0.35));
  // Hook, anlatımın ilk cümlesi bitene kadar ekranda kalır (konuşma neyse o kadar).
  const hookOut = beatStart(1);
  if (hookOut != null) yield* waitFor(Math.max(0.25, hookOut - nowSec() - 0.35));
  else yield* waitFor(Math.max(0.5, beatDur(0, 1.85) - 1.35));
  yield* all(hook().opacity(0, 0.35), hookRule().opacity(0, 0.3), hookTag().opacity(0, 0.3));
  hookRule().remove();

  // ── BAŞLIK (kalıcı) ───────────────────────────────────────────────────────
  const title = createRef<Txt>();
  const titleRule = createRef<Rect>();
  view.add(<Txt ref={title} text={spec.title} fill={COLORS.text} fontFamily={FONTS.display}
    fontSize={50} fontWeight={700} letterSpacing={-0.6} lineHeight={60} y={-712} opacity={0}
    width={940} textAlign="center" textWrap {...SHADOW} />);
  view.add(<Rect ref={titleRule} width={0} height={3} radius={2} fill={ACCENT} y={-628} opacity={0.75} />);
  yield* all(title().opacity(0.97, 0.45, easeOutCubic), titleRule().width(120, 0.5, easeOutCubic));

  const ctx = {accent: ACCENT, colors: COLORS, pacing};

  for (const scene of spec.scenes) {
    if (scene.kind === 'code' && scene.code) {
      yield* renderCodeScene(view, scene, ctx);
      continue;
    }

    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={1} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={ACCENT}
      fontFamily={FONTS.display} fontSize={40} fontWeight={600} letterSpacing={-0.2}
      y={-598} opacity={0} {...SHADOW} />);
    yield* all(heading().opacity(0.95, 0.4, easeOutCubic), heading().y(-590, 0.4, easeOutCubic));

    const nodes = scene.nodes!;
    const steps = scene.steps!;
    const count = nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const column = scene.layout === 'nodes-flow' || scene.layout === 'vertical-stack';
    const glyphSize = Math.round(Math.min(h * 0.46, 62));
    const labelSize = column
      ? Math.round(Math.min(40, h * 0.34))
      : Math.round(Math.min(32, w * 0.145));

    // Zeminde tek bir yumuşak aksan halesi — dekor değil, odak.
    container().add(<Rect width={760} height={760} radius={380} fill={ACCENT}
      opacity={0.05} shadowColor={ACCENT} shadowBlur={180} y={CLUSTER_Y} zIndex={-2} />);

    const segs = connectors(scene.layout, count);

    // ── Kartlar ──────────────────────────────────────────────────────────────
    const boxes: Record<string, Rect> = {};
    const boxByIndex: Rect[] = [];
    const nodeIndexById: Record<string, number> = {};
    nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      const glyph = nodeGlyph(n, glyphSize, i, ACCENT);
      container().add(
        <Rect ref={box} width={w} height={h} radius={column ? 24 : 26} fill={CARD_FILL}
          stroke={CARD_STROKE} lineWidth={1.5} x={pos[i].x} y={pos[i].y + RISE} opacity={0} zIndex={1}
          shadowColor={'#00000070'} shadowBlur={36} shadowOffsetY={14}
          layout direction={column ? 'row' : 'column'} alignItems="center"
          justifyContent={column ? 'start' : 'center'} gap={column ? 24 : 12}
          padding={column ? [0, 30] : [14, 10]}>
          {glyph}
          <Txt text={n.label} fill={COLORS.text} fontFamily={FONTS.display} fontSize={labelSize}
            fontWeight={600} letterSpacing={-0.2} lineHeight={labelSize * 1.15}
            width={column ? w - glyphSize - 96 : w - 26}
            textAlign={column ? 'left' : 'center'} textWrap />
        </Rect>,
      );
      boxes[n.id] = box();
      boxByIndex[i] = box();
      nodeIndexById[n.id] = i;
    });

    // ── Bağlantılar ─────────────────────────────────────────────────────────
    const lineByTarget = new Map<number, Line[]>();
    const lineByPair = new Map<string, Line>();
    const allLines: Line[] = [];
    segs.forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={CARD_STROKE} lineWidth={2} end={0} zIndex={0} />,
      );
      const tgt = Math.max(a, b);
      (lineByTarget.get(tgt) ?? lineByTarget.set(tgt, []).get(tgt)!).push(ln());
      lineByPair.set(a < b ? `${a}-${b}` : `${b}-${a}`, ln());
      allLines.push(ln());
    });

    // ALTYAZI: kazanan kısa-video formatının 1 numaralı öğesi (2026 verisi: klip'lerin
    // %80'inde altyazı, %78'i animasyonlu). Sessiz izleyen de anlatımı OKUYOR.
    // Kelime kelime açılır, koyu bir hap üstünde, yüksek kontrast.
    const capPill = createRef<Rect>();
    const capTxt = createRef<Txt>();
    container().add(
      <Rect ref={capPill} layout padding={[16, 30]} radius={20} fill="#0a0e13e6"
        stroke="#ffffff14" lineWidth={1.5} y={CAPTION_Y} opacity={0} zIndex={3}
        shadowColor="#000000aa" shadowBlur={28} shadowOffsetY={8}>
        <Txt ref={capTxt} text="" fill={COLORS.text} fontFamily={FONTS.display} fontSize={40}
          fontWeight={700} letterSpacing={-0.3} lineHeight={50} width={860}
          textAlign="center" textWrap />
      </Rect>,
    );
    const caption = {pill: capPill, txt: capTxt};

    // ── KURULUM: kartlar sırayla aşağıdan süzülür (beat 1 = "kurulum" cümlesi) ──
    // Ses varsa kurulum TAM O CÜMLE kadar sürer; yoksa governor değerleri kullanılır.
    const edges = Math.max(count - 1, 1);
    // Kurulum, "kurulum cümlesi" konuşulurken bitmeli: kalan gerçek süreye göre hesapla.
    const setupBudget = BEATS ? Math.max(0.7, (beatStart(2) ?? nowSec() + 2.2) - nowSec()) : 0;
    const enterT = BEATS ? clamp(setupBudget / (count + edges * 0.6), 0.14, 0.5) : pacing.enter;
    const lineT = BEATS ? enterT * 0.6 : pacing.lines;

    yield* all(
      boxByIndex[0].opacity(1, enterT, easeOutCubic),
      boxByIndex[0].y(pos[0].y, enterT, easeOutCubic),
    );
    for (let i = 1; i < count; i++) {
      const incoming = lineByTarget.get(i) ?? [];
      if (incoming.length) yield* all(...incoming.map(l => l.end(1, lineT, easeOutQuad)));
      yield* all(
        boxByIndex[i].opacity(1, enterT, easeOutCubic),
        boxByIndex[i].y(pos[i].y, enterT, easeOutCubic),
      );
    }

    // ── AKIŞ: adım başına TEK YÖNLÜ ışık darbesi + odak ─────────────────────
    for (const [si, step] of steps.entries()) {
      // Adım, kendi cümlesi başlarken başlar (ses otorite, sapma birikmez).
      yield* syncTo(beatStart(si + 2));
      const beatTotal = beatDur(si + 2, pacing.step + pacing.hold + 1.2);
      const pulseT = BEATS ? clamp(beatTotal * 0.30, 0.5, 1.5) : pacing.step;
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent', ACCENT);
      const fi = nodeIndexById[step.from], ti = nodeIndexById[step.to];
      const base = fi !== undefined && ti !== undefined
        ? lineByPair.get(fi < ti ? `${fi}-${ti}` : `${ti}-${fi}`)
        : undefined;
      const others = boxByIndex.filter(b => b !== from && b !== to);

      // Işık darbesi: bağlantının üstünde ilerleyen kısa parlak segment (tek geçiş).
      const pulse = createRef<Line>();
      if (base) {
        container().add(
          <Line ref={pulse} points={[[pos[fi].x, pos[fi].y], [pos[ti].x, pos[ti].y]]}
            stroke={col} lineWidth={4} lineCap="round" start={0} end={0} zIndex={2}
            shadowColor={col} shadowBlur={22} opacity={0.95} />,
        );
      }

      // ALTYAZI: o an konuşulan cümle (ses yoksa adımın status metni).
      yield* showCaption(caption, BEATS?.[si + 2]?.text ?? step.status, col);
      yield* all(
        // odak: hedef ve kaynak öne çıkar, gerisi geri çekilir
        from.stroke(col, 0.22), from.shadowColor(`${col}55`, 0.22),
        ...others.map(b => b.opacity(0.45, 0.22)),
      );

      if (pulse()) {
        const t = pulseT;
        yield* all(
          pulse().end(1, t, easeInOutCubic),
          // kuyruk, başın 0.3t gerisinden gelir → kısa ışık izi (dot+chip git-gel yerine)
          delay(t * 0.3, pulse().start(1, t * 0.7, easeInOutCubic)),
          to.stroke(col, t * 0.9),
          to.shadowColor(`${col}66`, t * 0.9),
        );
        pulse().remove();
      } else {
        yield* all(to.stroke(col, pulseT), to.shadowColor(`${col}66`, pulseT));
      }

      // Varış: hedef bir tık yükselir (kart "kabul etti" hissi), sonra okuma molası.
      yield* all(to.y(to.y() - 6, 0.18, easeOutCubic), to.lineWidth(2.5, 0.18));
      // Mola: bir sonraki cümle başlayana kadar (geri dönüş animasyonuna 0.3s pay bırakarak).
      const nextAt = beatStart(si + 3) ?? (BEATS ? null : null);
      const holdT = nextAt != null
        ? Math.max(0.2, nextAt - nowSec() - 0.3)
        : (BEATS ? Math.max(0.3, beatTotal * 0.3) : pacing.hold + 0.5);
      yield* waitFor(holdT);
      yield* all(
        to.y(to.y() + 6, 0.3, easeOutCubic), to.lineWidth(1.5, 0.3),
        from.stroke(CARD_STROKE, 0.3), from.shadowColor('#00000070', 0.3),
        to.stroke(CARD_STROKE, 0.3), to.shadowColor('#00000070', 0.3),
        ...others.map(b => b.opacity(1, 0.3)),
      );
    }

    // Ses varsa akış bitince beklemeden kapanışa geçilir (boş bekleme = izleyici kaybı).
    yield* waitFor(BEATS ? 0.25 : pacing.finalDwell + 0.5);
    yield* all(
      caption.pill().opacity(0, 0.3),
      ...boxByIndex.map((b, i) => all(b.opacity(0, 0.4), b.y(b.y() - 18, 0.45, easeOutCubic))),
      ...allLines.map(l => l.opacity(0, 0.3)),
      heading().opacity(0, 0.3),
    );
    container().remove();
  }

  // ── ÇIKIŞ ─────────────────────────────────────────────────────────────────
  // Kapanış cümlesi başlamadan ~0.5s önce sahneyi boşalt (cümle ekrandaki yazıyla başlasın).
  if (BEATS) yield* syncTo(Math.max(0, (beatStart(BEATS.length - 1) ?? 0) - 0.55));
  yield* all(title().opacity(0, 0.3), titleRule().opacity(0, 0.3));
  const take = createRef<Txt>();
  const rule = createRef<Rect>();
  const sign = createRef<Txt>();
  view.add(<Txt ref={take} text={TAKEAWAY} fill={COLORS.text} fontFamily={FONTS.display}
    fontSize={62} fontWeight={800} letterSpacing={-1.1} lineHeight={74} opacity={0} y={-20}
    width={900} textAlign="center" textWrap {...SHADOW} />);
  view.add(<Rect ref={rule} width={0} height={4} radius={2} fill={ACCENT} y={120} />);
  view.add(<Txt ref={sign} text="@byteflowlabs · AI systems, no hype" fill={COLORS.muted}
    fontFamily={FONTS.mono} fontSize={30} letterSpacing={2} opacity={0} y={180} {...SHADOW} />);
  yield* all(take().opacity(1, 0.5, easeOutCubic), take().y(-40, 0.6, easeOutCubic));
  yield* all(rule().width(200, 0.4, easeOutCubic), sign().opacity(0.85, 0.4));
  // Kapanış cümlesi bitene kadar dur; sonra LOOP için kararma (rewatch sinyali algoritmada
  // en güçlü ödüllerden biri — son kare ile ilk kare birbirine bağlansın).
  const audioEnd = BEATS ? (beatStart(BEATS.length - 1) ?? 0) + beatDur(BEATS.length - 1, 1.4) : null;
  const closeT = audioEnd != null ? Math.max(0.5, audioEnd - nowSec() - 0.55) : 1.4;
  yield* waitFor(closeT);
  yield* all(take().opacity(0, 0.45), rule().opacity(0, 0.4), sign().opacity(0, 0.4));
  yield* waitFor(0.12);
});

/** Altyazıyı kelime kelime açar (hızlı okunur ritim, tek satır tek fikir). */
function* showCaption(cap: {pill: any; txt: any}, text: string, color: string) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  cap.txt().text('');
  cap.txt().fill(color === undefined ? COLORS.text : COLORS.text);
  yield* cap.pill().opacity(1, 0.16);
  const per = clamp(0.5 / Math.max(words.length, 1), 0.035, 0.075);
  for (let i = 0; i < words.length; i++) {
    cap.txt().text(words.slice(0, i + 1).join(' '));
    yield* waitFor(per);
  }
}

function* renderCodeScene(view: any, scene: any, ctx: any) {
  const container = createRef<Layout>();
  view.add(<Layout ref={container} opacity={0} y={20} />);

  if (scene.heading) {
    container().add(<Txt text={scene.heading} fill={ctx.accent} fontFamily={FONTS.display}
      fontSize={40} fontWeight={600} letterSpacing={-0.2} y={-600} opacity={0.95} />);
  }

  container().add(<Rect width={960} height={840} radius={28} fill={CARD_FILL}
    stroke={CARD_STROKE} lineWidth={1.5} shadowColor={'#00000080'} shadowBlur={46}
    shadowOffsetY={18} y={-10} />);
  // Editör hissi: kart başında üç nokta.
  [-1, 0, 1].forEach(k => {
    container().add(<Rect width={14} height={14} radius={7} fill={CARD_STROKE}
      x={-420 + (k + 1) * 26} y={-378} />);
  });

  const code = createRef<Code>();
  container().add(
    <Code ref={code} highlighter={byteflowHighlighter as unknown as LezerHighlighter}
      fontFamily={FONTS.mono} fontSize={38} offsetX={-1} offsetY={-1} x={-420} y={-330} code={''} />,
  );

  if (scene.annotation) {
    container().add(<Txt text={scene.annotation} fill={COLORS.muted} fontFamily={FONTS.display}
      fontSize={36} fontWeight={500} y={520} width={940} textAlign="center" textWrap opacity={0.9} />);
  }

  yield* all(container().opacity(1, 0.4, easeOutCubic), container().y(0, 0.5, easeOutCubic));

  const full = scene.code as string;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const lineCount = (full.match(/\n/g)?.length ?? 0) + 1;
  const readHold = clamp(lineCount * 2.6 - 4.0, ctx.pacing.finalDwell, 9);
  if (scene.reveal === 'instant') {
    code().code(full);
    yield* waitFor(readHold);
  } else {
    yield* code().code(full, Math.min(2.4, Math.max(1.2, full.length / 90)));
    yield* waitFor(readHold);
  }

  yield* all(container().opacity(0, 0.4), container().y(-18, 0.45, easeOutCubic));
  container().remove();
}
