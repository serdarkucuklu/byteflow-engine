import {makeScene2D, Rect, Txt, Layout, Line, Path, Code, LezerHighlighter} from '@motion-canvas/2d';
import {all, delay, createRef, waitFor, useThread, easeOutCubic, easeInOutCubic, easeOutQuad} from '@motion-canvas/core';
import {FONTS, CAPTION_Y, CLUSTER_Y, SAVE_CUE_Y, resolvePalette, resolveColor, layoutPositions, boxSize, type SceneSpec} from '../lib/spec';
import {specShape, computePacing} from '../lib/pacing';
import {motionTarget, weightOf} from '../lib/motion-registry.mjs';
import {resolveChoreo, type ChoreoCtx} from './choreo';
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
// Palet markadan gelir (spec.palette); yoksa varsayılan koyu tema.
const COLORS = resolvePalette(spec);
const ACCENT = spec.theme ?? COLORS.accent;
const HOOK = spec.hook ?? spec.title;
const TAKEAWAY = spec.takeaway ?? 'follow for more';
// Kimlik marka dosyasından gelir (motor tek sayfaya bağlı değil).
const HANDLE = spec.brand?.handle ?? '@byteflowlabs';
const SIGNOFF = spec.brand?.signoff ?? 'AI systems, no hype';
// Paylaşım çağrısı da markanın DİLİNDE olmalı — Türkçe videoda İngilizce satır kalıyordu.
const SHARE_CTA = spec.brand?.shareCta || '↗  Send this to someone who needs it';
// Kaydet işareti: videonun ORTASINDA görünen kısa rozet (kapanıştaki çağrıyı görmeyen
// %90 için). Emoji YOK — render kabında emoji fontu garanti değil, tofu kutusu çıkarsa
// kadrajın en kritik ânını bozar.
const SAVE_CUE = spec.brand?.saveCue || 'KAYDET';

// Footage modunda sahne şeffaf render edilir (arka planı ffmpeg dolduruyor).
const FOOTAGE = spec.footage === true;
const SHADOW = FOOTAGE ? {shadowColor: '#000000e6', shadowBlur: 30} : {};

// HAREKET DİLİ: spec.motion hangi kareografiyi istiyorsa o (bkz. scenes/choreo.tsx).
// Bilinmeyen değer buildup'a düşer — yayın hiçbir koşulda kırılmaz.
const CHOREO = resolveChoreo(spec.motion);
const pacing = computePacing(specShape(spec), motionTarget(weightOf(spec.motion)));

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

const CARD_FILL = spec.palette?.card ? `${spec.palette.card}fa` : '#0f151dfa';        // koyu ve neredeyse opak: footage üstünde de okunur
const CARD_STROKE = spec.palette?.stroke ?? '#28323f';
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
  // ⚠ RETENTION DELİĞİ (ölçüldü 2026-08-07): eski akışta hook 0.5s'de yerine oturuyor,
  // sonra anlatımın ilk cümlesi bitene kadar 3-4 SANİYE tamamen DONUYORDU. Kontrol
  // kareleri (0.3s / 1.0s / 2.0s / 3.5s) birbirinin aynıydı. Kaydırma kararı tam o
  // boşlukta veriliyor: 41-46s'lik videolarda ortalama izlenme 4.9-11.2s'de kalıyordu.
  // Çözüm: kadraj İLK KAREDEN İTİBAREN hiç donmaz — metin yavaşça yaklaşır (Ken Burns)
  // ve aksan çizgisi konuşulan hook'un görünür İLERLEME ÇUBUĞU olur.
  const hook = createRef<Txt>();
  const hookRule = createRef<Rect>();
  const hookTag = createRef<Txt>();
  view.add(<Txt ref={hook} text={HOOK} fill={COLORS.text} fontFamily={FONTS.display}
    fontSize={88} fontWeight={800} letterSpacing={-1.6} lineHeight={98} opacity={0.82} y={-16}
    width={920} textAlign="center" textWrap {...SHADOW} />);
  view.add(<Rect ref={hookRule} width={0} height={5} radius={3} fill={ACCENT} y={182} opacity={0.9} />);
  view.add(<Txt ref={hookTag} text={HANDLE} fill={COLORS.muted} fontFamily={FONTS.mono}
    fontSize={30} letterSpacing={4} opacity={0} y={240} {...SHADOW} />);

  // Hook penceresi = konuşulan ilk cümlenin süresi. Tüm hareket BU pencereye yayılır,
  // yani "oturdu ve bekliyor" ânı hiç oluşmaz.
  const hookWindow = beatStart(1) != null
    ? Math.max(1.1, (beatStart(1) as number) - 0.30)
    : Math.max(1.3, beatDur(0, 1.85));
  yield* all(
    hook().opacity(1, 0.18, easeOutCubic),
    hook().y(-34, hookWindow, easeOutQuad),
    hook().scale(1.04, hookWindow, easeOutQuad),
    hookTag().opacity(0.85, 0.35),
    hookRule().width(340, hookWindow, easeOutQuad),
  );

  // ── BAŞLIK (kalıcı) ───────────────────────────────────────────────────────
  // Başlık, hook SÖNERKEN girer. Eskiden sırayla oynuyordu (0.35 + 0.45 = 0.8s) ve
  // arada ekranda yalnız minik başlığın olduğu neredeyse boş bir kare kalıyordu —
  // 6. saniyedeki kontrol karesi tam buydu.
  const title = createRef<Txt>();
  const titleRule = createRef<Rect>();
  view.add(<Txt ref={title} text={spec.title} fill={COLORS.text} fontFamily={FONTS.display}
    fontSize={54} fontWeight={700} letterSpacing={-0.7} lineHeight={64} y={-712} opacity={0}
    width={960} textAlign="center" textWrap {...SHADOW} />);
  view.add(<Rect ref={titleRule} width={0} height={3} radius={2} fill={ACCENT} y={-624} opacity={0.75} />);
  yield* all(
    hook().opacity(0, 0.3), hookRule().opacity(0, 0.28), hookTag().opacity(0, 0.28),
    delay(0.12, all(
      title().opacity(0.97, 0.38, easeOutCubic),
      titleRule().width(120, 0.42, easeOutCubic),
    )),
  );
  hookRule().remove();

  const ctx = {accent: ACCENT, colors: COLORS, pacing, shadow: SHADOW};
  // Kaçıncı beat'teyiz: sahneler beat'leri sırayla tüketiyor (hook + kurulum = 2 beat).
  let beatOffset = 0;

  for (const scene of spec.scenes) {
    if (scene.kind === 'code' && scene.code) {
      yield* renderCodeScene(view, scene, ctx);
      continue;
    }
    if (scene.kind === 'versus' && scene.rows?.length) {
      yield* renderVersusScene(view, scene, ctx, beatOffset);
      beatOffset += scene.rows.length;
      continue;
    }

    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={1} />);
    // stage: SADECE kartlar + bağlantılar. 'camera' kareografisi bunu kaydırıp
    // yakınlaştırıyor; başlık, ilerleme rayı ve altyazı container'da kalıp sabit duruyor.
    const stage = createRef<Layout>();
    container().add(<Layout ref={stage} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={ACCENT}
      fontFamily={FONTS.display} fontSize={42} fontWeight={600} letterSpacing={-0.2}
      y={-598} opacity={0} {...SHADOW} />);
    // Başlığın açılışı KART KURULUMUYLA BİRLİKTE oynatılır (aşağıda, CHOREO.enter ile
    // aynı all() içinde). Arka arkaya oynatmak ekranı 0.4s daha boş bırakıyordu.

    const nodes = scene.nodes!;
    const steps = scene.steps!;
    const count = nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const column = scene.layout === 'nodes-flow' || scene.layout === 'vertical-stack';
    const glyphSize = Math.round(Math.min(h * 0.46, 62));
    // Etiket tavanları 40/32 → 46/36 (2026-08-07): kartlar büyüdü, yazı onlarla
    // birlikte büyümezse kart içi boşluk artıyor ve telefonda okunurluk kazanmıyor.
    const labelSize = column
      ? Math.round(Math.min(46, h * 0.34))
      : Math.round(Math.min(36, w * 0.145));

    // Zeminde tek bir yumuşak aksan halesi — dekor değil, odak.
    container().add(<Rect width={760} height={760} radius={380} fill={ACCENT}
      opacity={0.05} shadowColor={ACCENT} shadowBlur={180} y={CLUSTER_Y} zIndex={-2} />);

    // İLERLEME RAYI: izleyici kaçıncı adımda olduğunu görüyor. 2026 verisi: görünür
    // "adım 1/2/3" yapısı EN ÇOK KAYDEDİLEN format — insanlar sonra dönmek için kaydediyor.
    const rail: Rect[] = [];
    if (steps.length > 1) {
      const bw = 46, gap = 10, totalW = steps.length * bw + (steps.length - 1) * gap;
      steps.forEach((_, i) => {
        const bar = createRef<Rect>();
        container().add(<Rect ref={bar} width={bw} height={6} radius={3} fill={COLORS.stroke}
          x={-totalW / 2 + bw / 2 + i * (bw + gap)} y={-524} opacity={0.55} zIndex={2} />);
        rail.push(bar());
      });
    }

    const segs = connectors(scene.layout, count);

    // ── Kartlar ──────────────────────────────────────────────────────────────
    const boxes: Record<string, Rect> = {};
    const boxByIndex: Rect[] = [];
    const nodeIndexById: Record<string, number> = {};
    nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      const glyph = nodeGlyph(n, glyphSize, i, ACCENT);
      stage().add(
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
      stage().add(
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
        <Txt ref={capTxt} text="" fill={COLORS.text} fontFamily={FONTS.display} fontSize={44}
          fontWeight={700} letterSpacing={-0.3} lineHeight={54} width={900}
          textAlign="center" textWrap />
      </Rect>,
    );
    const caption = {pill: capPill, txt: capTxt};

    // ── KAYDET İŞARETİ (akışın ORTASINDA) ────────────────────────────────────
    // Kaydetme çağrısı eskiden yalnız kapanış kartındaydı — 45s videonun 43. saniyesi.
    // Ortalama izlenme 4.9-11.2s olduğuna göre izleyicinin ~%90'ı orayı hiç görmüyordu
    // (ölçüm: brands/state/*-history.json insights). Artık ikinci adımda beliriyor ve
    // sahne sonuna kadar kalıyor: kaydet, en güçlü sıralama sinyallerinden biri.
    const saveCue = createRef<Rect>();
    container().add(
      <Rect ref={saveCue} layout padding={[8, 20]} radius={12} fill="#0a0e13d9"
        stroke={`${ACCENT}66`} lineWidth={1.5} y={SAVE_CUE_Y} opacity={0} zIndex={3}
        shadowColor="#000000aa" shadowBlur={20} shadowOffsetY={6}>
        <Txt text={SAVE_CUE} fill={ACCENT} fontFamily={FONTS.mono} fontSize={23}
          fontWeight={700} letterSpacing={1.2} />
      </Rect>,
    );
    // 2+ adımlı akışta 2. adımda, tek adımlıda hemen: videonun ~%40'ı.
    const saveCueStep = steps.length >= 3 ? 1 : 0;

    // ── KURULUM: kartlar sırayla aşağıdan süzülür (beat 1 = "kurulum" cümlesi) ──
    // Ses varsa kurulum TAM O CÜMLE kadar sürer; yoksa governor değerleri kullanılır.
    const edges = Math.max(count - 1, 1);
    // Kurulum, "kurulum cümlesi" konuşulurken bitmeli: kalan gerçek süreye göre hesapla.
    const setupBudget = BEATS ? Math.max(0.7, (beatStart(2) ?? nowSec() + 2.2) - nowSec()) : 0;
    const enterT = BEATS ? clamp(setupBudget / (count + edges * 0.6), 0.14, 0.5) : pacing.enter;
    const lineT = BEATS ? enterT * 0.6 : pacing.lines;

    const choreoCtx: ChoreoCtx = {
      stage: stage(), boxes: boxByIndex, pos, lineByTarget, allLines,
      accent: ACCENT, cardStroke: CARD_STROKE, enterT, lineT, rise: RISE, clusterY: CLUSTER_Y,
    };
    yield* all(
      heading().opacity(0.95, 0.35, easeOutCubic),
      heading().y(-590, 0.35, easeOutCubic),
      CHOREO.enter(choreoCtx),
    );

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
      const stepCtx = {...choreoCtx, from, to, fi, ti, others, col, pulseT, line: base};

      // rayda bulunduğumuz adımı yak
      rail.forEach((bar, i) => {
        bar.fill(i < si ? `${col}66` : i === si ? col : COLORS.stroke);
        bar.opacity(i <= si ? 1 : 0.55);
      });

      // ALTYAZI: o an konuşulan cümle (ses yoksa adımın status metni).
      yield* showCaption(caption, BEATS?.[si + 2]?.text ?? step.status, col);
      // Odak + aktarım: kareografinin kendi hareket dili (bkz. scenes/choreo.tsx).
      yield* CHOREO.emphasize(stepCtx);

      // Varış: hedef bir tık yükselir (kart "kabul etti" hissi), sonra okuma molası.
      // Kaydet rozeti bu ânın içinde açılır — akışa AYRI bir bekleme eklemez, yani
      // ses/görüntü senkronu (syncTo) bozulmaz.
      yield* all(
        to.y(to.y() - 6, 0.18, easeOutCubic), to.lineWidth(2.5, 0.18),
        ...(si === saveCueStep ? [saveCue().opacity(1, 0.3, easeOutCubic)] : []),
      );
      // Mola: bir sonraki cümle başlayana kadar (geri dönüş animasyonuna 0.3s pay bırakarak).
      const nextAt = beatStart(si + 3) ?? (BEATS ? null : null);
      const holdT = nextAt != null
        ? Math.max(0.2, nextAt - nowSec() - 0.3)
        : (BEATS ? Math.max(0.3, beatTotal * 0.3) : pacing.hold + 0.5);
      yield* waitFor(holdT);
      yield* all(
        to.y(to.y() + 6, 0.3, easeOutCubic), to.lineWidth(1.5, 0.3),
        CHOREO.reset(stepCtx),
      );
    }

    // Ses varsa akış bitince beklemeden kapanışa geçilir (boş bekleme = izleyici kaybı).
    yield* waitFor(BEATS ? 0.25 : pacing.finalDwell + 0.5);
    yield* all(
      caption.pill().opacity(0, 0.3),
      saveCue().opacity(0, 0.3),
      CHOREO.exit(choreoCtx),
      heading().opacity(0, 0.3),
    );
    container().remove();
  }

  // ── ÇIKIŞ: ÖZET KARTI ────────────────────────────────────────────────────
  // 2026 sıralama verisi: DM ile GÖNDERİM en güçlü sinyal, "adım adım özet" ise en çok
  // KAYDEDİLEN format. Kapanış artık tek cümlelik bir slogan değil; ekran görüntüsü alınabilir
  // bir özet + net bir gönderme çağrısı.
  if (BEATS) yield* syncTo(Math.max(0, (beatStart(BEATS.length - 1) ?? 0) - 0.55));
  yield* all(title().opacity(0, 0.3), titleRule().opacity(0, 0.3));

  const recapSteps = (spec.scenes.find(sc => sc.steps?.length)?.steps ?? []).slice(0, 4);
  const recapNodes = spec.scenes.find(sc => sc.nodes?.length)?.nodes ?? [];
  const labelOf = (id: string) => recapNodes.find(n => n.id === id)?.label ?? id.toUpperCase();
  // ÖZET SATIRI = adımın KENDİ CÜMLESİ, "ETİKET → ETİKET" oku değil.
  // Kontrol karesinde (2026-08-07) kapanış kartı şunu yazıyordu: "MAĞAZA GAZI → ORGANİK
  // LEKE". Bu hiçbir şey öğretmiyor, dolayısıyla ekran görüntüsü de alınmıyor — oysa bu
  // kartın tek varlık sebebi KAYDEDİLEBİLİR/paylaşılabilir bir özet olmak. step.status
  // zaten o ânın anlamlı cümlesi (<=40 karakter); baş harfi büyütülüp aynen kullanılır.
  const recapLine = (st: {from: string; to: string; status?: string}) => {
    const s = String(st.status ?? '').trim();
    return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1)
      : `${labelOf(st.from)} → ${labelOf(st.to)}`;
  };

  // Kart FLEX düzenle kurulur ama çocuklar TEK TEK eklenir: JSX'e dizi çocuk vermek ve
  // ref'i düğüm yerine fonksiyon olarak saklamak sahneyi düşürüyordu (render hiç başlamadı,
  // canlı koşuda görüldü). Bu depoda kanıtlanmış desen: önce düğüm, sonra .add().
  const card = createRef<Rect>();
  view.add(
    <Rect ref={card} layout direction="column" alignItems="center" gap={18}
      padding={[44, 46]} width={950} radius={34} fill="#0b1118f7"
      stroke={`${ACCENT}45`} lineWidth={2} y={-70} opacity={0}
      shadowColor="#000000b3" shadowBlur={54} shadowOffsetY={20} />,
  );
  card().add(
    <Txt text={spec.title} fill={COLORS.text} fontFamily={FONTS.display} fontSize={46}
      fontWeight={800} letterSpacing={-0.8} lineHeight={56} width={840}
      textAlign="center" textWrap />,
  );
  card().add(<Rect width={90} height={3} radius={2} fill={ACCENT} margin={[4, 0, 12, 0]} />);

  const rows: Layout[] = [];
  for (const [i, st] of recapSteps.entries()) {
    const row = createRef<Layout>();
    card().add(
      <Layout ref={row} width={830} direction="row" alignItems="center" gap={20} opacity={0}>
        <Rect width={54} height={54} radius={27} fill={`${ACCENT}22`} stroke={`${ACCENT}75`}
          lineWidth={2} justifyContent="center" alignItems="center">
          <Txt text={String(i + 1).padStart(2, '0')} fill={ACCENT} fontFamily={FONTS.display}
            fontSize={25} fontWeight={800} />
        </Rect>
        <Txt text={recapLine(st)} fill={COLORS.text}
          fontFamily={FONTS.display} fontSize={33} fontWeight={600} letterSpacing={-0.2}
          width={730} textWrap />
      </Layout>,
    );
    rows.push(row());
  }

  card().add(<Rect width={830} height={1} fill="#ffffff1a" margin={[16, 0, 8, 0]} />);
  const takeRef = createRef<Txt>();
  card().add(
    // TAKEAWAY = videonun punchline'ı; alıntılanan/ekran görüntüsü alınan satır bu.
    // 38 → 46: kartın en büyük yazısı özet satırları değil, gülünen cümle olmalı.
    <Txt ref={takeRef} text={TAKEAWAY} fill={ACCENT} fontFamily={FONTS.display} fontSize={46}
      fontWeight={800} letterSpacing={-0.5} lineHeight={56} width={830}
      textAlign="center" textWrap opacity={0} />,
  );

  // Gönderme çağrısı kartın DIŞINDA, altta — okunur boyutta ve parlak (sönük kalıyordu).
  const share = createRef<Txt>();
  view.add(<Txt ref={share} text={SHARE_CTA} fill={COLORS.text}
    fontFamily={FONTS.display} fontSize={36} fontWeight={700} letterSpacing={-0.2} opacity={0}
    y={452} width={940} textAlign="center" {...SHADOW} />);
  const handleTag = createRef<Txt>();
  view.add(<Txt ref={handleTag} text={`${HANDLE} · ${SIGNOFF}`} fill={ACCENT} fontFamily={FONTS.mono}
    fontSize={26} letterSpacing={1.5} opacity={0} y={512} {...SHADOW} />);

  yield* card().opacity(1, 0.4, easeOutCubic);
  for (const row of rows) {
    yield* row.opacity(1, 0.2, easeOutCubic);
    yield* waitFor(0.05);
  }
  yield* takeRef().opacity(1, 0.32, easeOutCubic);
  yield* all(share().opacity(1, 0.3), handleTag().opacity(0.9, 0.3));

  // Kapanış cümlesi bitene kadar özet ekranda kalsın (ekran görüntüsü için zaman), sonra
  // LOOP için kararma — tekrar izleme algoritmanın ödüllendirdiği sinyallerden biri.
  const audioEnd = BEATS ? (beatStart(BEATS.length - 1) ?? 0) + beatDur(BEATS.length - 1, 1.4) : null;
  const closeT = audioEnd != null ? Math.max(0.6, audioEnd - nowSec() - 0.5) : 1.8;
  yield* waitFor(closeT);
  yield* all(card().opacity(0, 0.4), share().opacity(0, 0.35), handleTag().opacity(0, 0.35));
  yield* waitFor(0.1);
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

/**
 * VERSUS sahnesi — iki seçenek tek boyutta kafa kafaya.
 * 2026 kısa-video verisi: iki aracın/ürünün çıktısını yan yana koyan videolar erişim ve
 * kaydetmede sürekli önde. Satır satır açılır; kazanan taraf o satırda vurgulanır.
 */
function* renderVersusScene(view: any, scene: any, ctx: any, beatOffset: number) {
  const {accent, pacing} = ctx;
  const container = createRef<Layout>();
  view.add(<Layout ref={container} opacity={1} />);

  // Ölçüler: hücreler 9:16 karede okunur olmalı; satır aralığı etiketin hücreye BİNMESİNİ
  // engelleyecek kadar açık (ilk render'da 'AKTİF MADDE' hücre kenarına biniyordu).
  const COL = 268, GAP = 24, ROW_H = 148;
  const rows = (scene.rows ?? []).slice(0, 4);
  // Blok dikeyde ORTALANIR (ilk render'da üst yarıya sıkışmıştı, alt yarı boştu).
  const topY = CLUSTER_Y - ((rows.length - 1) * ROW_H) / 2 + 20;

  // Başlık satırı: iki taraf
  const head = (text: string, x: number) => {
    const t = createRef<Txt>();
    container().add(<Txt ref={t} text={text} fill={COLORS.text} fontFamily={FONTS.display}
      fontSize={34} fontWeight={800} letterSpacing={-0.4} x={x} y={topY - 118} opacity={0}
      width={COL + 60} textAlign="center" textWrap {...ctx.shadow} />);
    return t();
  };
  // ALTYAZI: sessiz izleyen satırı okuyabilmeli (kazanan formatın 1 numaralı öğesi).
  const capPill = createRef<Rect>();
  const capTxt = createRef<Txt>();
  container().add(
    <Rect ref={capPill} layout padding={[16, 30]} radius={20} fill="#0a0e13e6"
      stroke="#ffffff14" lineWidth={1.5} y={CAPTION_Y} opacity={0} zIndex={3}
      shadowColor="#000000aa" shadowBlur={28} shadowOffsetY={8}>
      <Txt ref={capTxt} text="" fill={COLORS.text} fontFamily={FONTS.display} fontSize={44}
        fontWeight={700} letterSpacing={-0.3} lineHeight={54} width={900}
        textAlign="center" textWrap />
    </Rect>,
  );
  const caption = {pill: capPill, txt: capTxt};

  const leftHead = head(scene.left ?? 'A', -(COL / 2 + GAP / 2 + 40));
  const rightHead = head(scene.right ?? 'B', COL / 2 + GAP / 2 + 40);
  const vs = createRef<Txt>();
  container().add(<Txt ref={vs} text="VS" fill={accent} fontFamily={FONTS.mono} fontSize={26}
    fontWeight={700} letterSpacing={2} y={topY - 118} opacity={0} />);

  yield* all(leftHead.opacity(1, 0.3, easeOutCubic), rightHead.opacity(1, 0.3, easeOutCubic),
    vs().opacity(0.9, 0.3));

  // Satırlar: etiket ortada, iki taraf sağda/solda
  for (const [i, row] of rows.entries()) {
    const y = topY + i * ROW_H;
    const label = createRef<Txt>();
    const cells: Rect[] = [];
    container().add(<Txt ref={label} text={String(row.label ?? '').toUpperCase()} fill={COLORS.muted}
      fontFamily={FONTS.mono} fontSize={23} letterSpacing={1.5} y={y - 62} opacity={0} {...ctx.shadow} />);

    for (const side of ['left', 'right'] as const) {
      const isWinner = row.winner === side;
      const x = (side === 'left' ? -1 : 1) * (COL / 2 + GAP / 2 + 40);
      const cell = createRef<Rect>();
      container().add(
        <Rect ref={cell} width={COL + 74} height={92} radius={20}
          fill={isWinner ? `${accent}1c` : CARD_FILL} stroke={isWinner ? `${accent}80` : CARD_STROKE}
          lineWidth={isWinner ? 2 : 1.5} x={x} y={y} opacity={0}
          justifyContent="center" alignItems="center" padding={[8, 14]}>
          <Txt text={String(row[side] ?? '')} fill={isWinner ? COLORS.text : COLORS.muted}
            fontFamily={FONTS.display} fontSize={29} fontWeight={isWinner ? 700 : 500}
            width={COL + 46} textAlign="center" textWrap />
        </Rect>,
      );
      cells.push(cell());
    }

    // Bu satırın kendi beat'i var (ses varsa o cümle konuşulurken açılır).
    yield* syncTo(beatStart(beatOffset + i + 2));
    const line = BEATS?.[beatOffset + i + 2]?.text
      ?? `${row.label}: ${row.winner === 'right' ? scene.right : row.winner === 'left' ? scene.left : 'berabere'}`;
    yield* showCaption(caption, line, accent);
    yield* all(label().opacity(0.9, 0.22), ...cells.map(c => c.opacity(1, 0.28, easeOutCubic)));
    const nextAt = beatStart(beatOffset + i + 3);
    yield* waitFor(nextAt != null ? Math.max(0.3, nextAt - nowSec() - 0.15) : pacing.hold + 0.9);
  }

  yield* waitFor(BEATS ? 0.2 : pacing.finalDwell);
  yield* all(caption.pill().opacity(0, 0.3), container().opacity(0, 0.4));
  container().remove();
}
