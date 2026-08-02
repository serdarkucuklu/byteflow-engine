import {Rect, Line, Circle, Layout} from '@motion-canvas/2d';
import {all, delay, waitFor, createRef, easeOutCubic, easeInOutCubic, easeOutQuad, easeOutExpo, easeInQuad, type ThreadGenerator} from '@motion-canvas/core';
import type {Pos} from '../lib/spec';

// ─────────────────────────────────────────────────────────────────────────────
// KAREOGRAFİLER — aynı diyagram verisi, BEŞ farklı hareket dili.
//
// Serdar direktifi (2026-08-02): "5 farklı kareografi olsun, mevcuttan da iyi."
// Tek koreografi (buildup) her videoyu aynı hissettiriyordu; konu ve gaf dönerken
// hareketin sabit kalması sayfayı şablon gibi gösteriyor (bkz. brain/twists.mjs).
//
// SÖZLEŞME — her kareografi ÜÇ jeneratör verir ve ÜÇÜ DE bütçesini aşmamalıdır:
//   enter(ctx)      : kartlar + bağlantılar sahneye girer. Bütçe: ctx.enterT/lineT'ten
//                     türetilir; PARALEL girişler bütçenin altında kalır (güvenli taraf).
//   emphasize(step) : tek bir adımın vurgusu. Bütçe: step.pulseT (0.5-1.5s).
//   reset(step)     : vurgunun geri alınması (~0.3s).
// ⚠ Bütçeyi AŞMAK sesle görüntüyü kaydırır: zamanlama seslendirmenin beat'lerinden
// geliyor (explainer.tsx syncTo). Kısa kalmak serbest, uzamak değil.
//
// Kartlar ve bağlantılar `stage` içinde durur; altyazı/başlık/ray sabit katmanda.
// Böylece 'camera' kareografisi sahneyi kaydırırken altyazı yerinde kalır.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoreoCtx {
  stage: Layout;
  boxes: Rect[];
  pos: Pos[];
  lineByTarget: Map<number, Line[]>;
  allLines: Line[];
  accent: string;
  cardStroke: string;
  enterT: number;   // kart başına giriş süresi
  lineT: number;    // bağlantı çizilme süresi
  rise: number;     // kartların süzüldüğü mesafe
  clusterY: number;
}

export interface StepCtx extends ChoreoCtx {
  from: Rect;
  to: Rect;
  fi: number;
  ti: number;
  others: Rect[];
  col: string;
  pulseT: number;
  line?: Line;
}

// easeOutBack yok (paket easeIn/Out/InOut Quad…Expo ile geliyor) — elle tanımlıyoruz.
// Kartın hedefi hafifçe aşıp yerine oturması "premium" hissin en ucuz kaynağı.
const easeOutBack = (t: number) => {
  const c = 1.70158, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

const DIM = 0.42;          // vurgu dışındaki kartların sönme seviyesi
const DIM_DEEP = 0.24;     // spotlight'ta vurgu dışı seviye (altında etiket okunmuyor)
const REST = 0.58;         // spotlight'ta kartların dinlenme parlaklığı

/** Bağlantıların hepsini aynı anda çiz (paralel girişli kareografiler için). */
function* drawAllLines(ctx: ChoreoCtx, dur: number) {
  if (!ctx.allLines.length) return;
  yield* all(...ctx.allLines.map(l => l.end(1, dur, easeOutQuad)));
}

/** Işık darbesi: bağlantı üzerinde tek yönlü ilerleyen parlak segment. */
function* pulseAlong(step: StepCtx, dur: number) {
  if (!step.line) {
    yield* waitFor(dur);
    return;
  }
  const p = createRef<Line>();
  step.stage.add(
    <Line ref={p} points={[[step.pos[step.fi].x, step.pos[step.fi].y], [step.pos[step.ti].x, step.pos[step.ti].y]]}
      stroke={step.col} lineWidth={4} lineCap="round" start={0} end={0} zIndex={2}
      shadowColor={step.col} shadowBlur={22} opacity={0.95} />,
  );
  yield* all(
    p().end(1, dur, easeInOutCubic),
    delay(dur * 0.3, p().start(1, dur * 0.7, easeInOutCubic)),
  );
  p().remove();
}

/** Ortak geri alma: renkleri ve sönmüş kartları eski hâline döndür. */
function* plainReset(step: StepCtx) {
  yield* all(
    step.from.stroke(step.cardStroke, 0.3), step.from.shadowColor('#00000070', 0.3),
    step.to.stroke(step.cardStroke, 0.3), step.to.shadowColor('#00000070', 0.3),
    step.from.scale(1, 0.3), step.to.scale(1, 0.3),
    ...step.others.map(b => all(b.opacity(1, 0.3), b.scale(1, 0.3))),
  );
}

export interface Choreo {
  key: string;
  enter(ctx: ChoreoCtx): ThreadGenerator;
  emphasize(step: StepCtx): ThreadGenerator;
  reset(step: StepCtx): ThreadGenerator;
  exit(ctx: ChoreoCtx): ThreadGenerator;
}

// ── 1. BUILDUP — kartlar sırayla aşağıdan süzülür (özgün dil, rötuşlu) ────────
// Rötuş: giriş artık hafif ölçek + hedefi aşan yerleşme (easeOutBack) taşıyor.
const buildup: Choreo = {
  key: 'buildup',
  *enter(ctx) {
    const first = ctx.boxes[0];
    first.scale(0.94);
    yield* all(
      first.opacity(1, ctx.enterT, easeOutCubic),
      first.y(ctx.pos[0].y, ctx.enterT, easeOutBack),
      first.scale(1, ctx.enterT, easeOutCubic),
    );
    for (let i = 1; i < ctx.boxes.length; i++) {
      const incoming = ctx.lineByTarget.get(i) ?? [];
      if (incoming.length) yield* all(...incoming.map(l => l.end(1, ctx.lineT, easeOutQuad)));
      ctx.boxes[i].scale(0.94);
      yield* all(
        ctx.boxes[i].opacity(1, ctx.enterT, easeOutCubic),
        ctx.boxes[i].y(ctx.pos[i].y, ctx.enterT, easeOutBack),
        ctx.boxes[i].scale(1, ctx.enterT, easeOutCubic),
      );
    }
  },
  *emphasize(step) {
    yield* all(
      step.from.stroke(step.col, 0.22), step.from.shadowColor(`${step.col}55`, 0.22),
      ...step.others.map(b => b.opacity(DIM, 0.22)),
    );
    yield* all(
      pulseAlong(step, step.pulseT),
      step.to.stroke(step.col, step.pulseT * 0.9),
      step.to.shadowColor(`${step.col}66`, step.pulseT * 0.9),
    );
  },
  reset: plainReset,
  *exit(ctx) {
    yield* all(
      ...ctx.boxes.map(b => all(b.opacity(0, 0.4), b.y(b.y() - 18, 0.45, easeOutCubic))),
      ...ctx.allLines.map(l => l.opacity(0, 0.3)),
    );
  },
};

// ── 2. SPOTLIGHT — oda karanlık, ışık kartlar arasında geziyor ────────────────
// Tüm kartlar en baştan yerinde ama sönük; anlatım ilerledikçe ışık tutulur.
const spotlight: Choreo = {
  key: 'spotlight',
  *enter(ctx) {
    ctx.boxes.forEach((b, i) => {
      b.y(ctx.pos[i].y);
      b.scale(0.96);
    });
    yield* all(
      ...ctx.boxes.map((b, i) => delay(i * ctx.enterT * 0.18, all(
        b.opacity(REST, ctx.enterT, easeOutCubic),
        b.scale(1, ctx.enterT, easeOutCubic),
      ))),
    );
    yield* drawAllLines(ctx, ctx.lineT * 1.2);
  },
  *emphasize(step) {
    // Işık önce kaynağa düşer, sonra bağlantı boyunca hedefe yürür.
    yield* all(
      step.from.opacity(1, 0.2), step.from.scale(1.03, 0.24, easeOutCubic),
      step.from.stroke(step.col, 0.2), step.from.shadowColor(`${step.col}66`, 0.2),
      ...step.others.map(b => b.opacity(DIM_DEEP, 0.22)),
    );
    yield* all(
      pulseAlong(step, step.pulseT * 0.85),
      delay(step.pulseT * 0.45, all(
        step.to.opacity(1, step.pulseT * 0.45),
        step.to.scale(1.05, step.pulseT * 0.5, easeOutCubic),
        step.to.stroke(step.col, step.pulseT * 0.5),
        step.to.shadowColor(`${step.col}80`, step.pulseT * 0.5),
      )),
    );
  },
  *reset(step) {
    // Karanlığa dönüş: geçilen kartlar tamamen sönmez, "görülmüş" kalır.
    yield* all(
      step.from.opacity(REST, 0.3), step.to.opacity(REST + 0.14, 0.3),
      step.from.scale(1, 0.3), step.to.scale(1, 0.3),
      step.from.stroke(step.cardStroke, 0.3), step.from.shadowColor('#00000070', 0.3),
      step.to.stroke(step.cardStroke, 0.3), step.to.shadowColor('#00000070', 0.3),
      ...step.others.map(b => b.opacity(DIM_DEEP, 0.3)),
    );
  },
  *exit(ctx) {
    yield* all(
      ...ctx.boxes.map(b => all(b.opacity(0, 0.35), b.scale(0.97, 0.4, easeOutCubic))),
      ...ctx.allLines.map(l => l.opacity(0, 0.3)),
    );
  },
};

// ── 3. CAMERA — kamera kümeye girer ve her adımda aktif çifte kayar ───────────
// Sinema hissi: sahne (stage) kayar/yakınlaşır, altyazı ve başlık sabit kalır.
const CAM_ZOOM = 1.07;
const CAM_PAN_MAX = 70;
const camera: Choreo = {
  key: 'camera',
  *enter(ctx) {
    ctx.stage.scale(1.1);
    ctx.boxes.forEach((b, i) => b.y(ctx.pos[i].y + ctx.rise * 0.4));
    yield* all(
      ctx.stage.scale(1, ctx.enterT * 2.2, easeOutExpo),
      ...ctx.boxes.map((b, i) => delay(i * ctx.enterT * 0.35, all(
        b.opacity(1, ctx.enterT, easeOutCubic),
        b.y(ctx.pos[i].y, ctx.enterT, easeOutCubic),
      ))),
      delay(ctx.enterT * 0.6, drawAllLines(ctx, ctx.lineT * 1.6)),
    );
  },
  *emphasize(step) {
    // Aktif çiftin orta noktası kadraja alınır (pan sınırlı: kart kadraj dışına taşmasın).
    const mx = (step.pos[step.fi].x + step.pos[step.ti].x) / 2;
    const my = (step.pos[step.fi].y + step.pos[step.ti].y) / 2;
    const px = Math.max(-CAM_PAN_MAX, Math.min(CAM_PAN_MAX, -mx * (CAM_ZOOM - 1) - mx * 0.06));
    const py = Math.max(-CAM_PAN_MAX, Math.min(CAM_PAN_MAX, (step.clusterY - my) * 0.16));
    yield* all(
      step.stage.scale(CAM_ZOOM, step.pulseT * 0.9, easeOutCubic),
      step.stage.position([px, py], step.pulseT * 0.9, easeOutCubic),
      step.from.stroke(step.col, 0.24), step.from.shadowColor(`${step.col}55`, 0.24),
      ...step.others.map(b => b.opacity(DIM, 0.26)),
      delay(step.pulseT * 0.2, all(
        pulseAlong(step, step.pulseT * 0.7),
        step.to.stroke(step.col, step.pulseT * 0.6),
        step.to.shadowColor(`${step.col}66`, step.pulseT * 0.6),
      )),
    );
  },
  *reset(step) {
    yield* all(
      step.stage.scale(1, 0.34, easeOutCubic),
      step.stage.position([0, 0], 0.34, easeOutCubic),
      plainReset(step),
    );
  },
  *exit(ctx) {
    yield* all(
      ctx.stage.scale(1.05, 0.45, easeOutCubic),
      ...ctx.boxes.map(b => b.opacity(0, 0.38)),
      ...ctx.allLines.map(l => l.opacity(0, 0.3)),
    );
  },
};

// ── 4. CASCADE — kartlar yukarıdan düşer, çarparak yerine oturur ──────────────
const cascade: Choreo = {
  key: 'cascade',
  *enter(ctx) {
    ctx.boxes.forEach((b, i) => b.y(ctx.pos[i].y - ctx.rise * 2.4));
    for (let i = 0; i < ctx.boxes.length; i++) {
      const b = ctx.boxes[i];
      const fall = ctx.enterT * 0.9;
      yield* all(
        b.opacity(1, fall * 0.7, easeOutCubic),
        b.y(ctx.pos[i].y, fall, easeOutBack),
      );
      // Çarpma: kısa bir ezilme-toparlanma (hızlı, bütçeyi zorlamaz).
      yield* b.scale([1.05, 0.95], fall * 0.22, easeOutQuad);
      const incoming = ctx.lineByTarget.get(i) ?? [];
      yield* all(
        b.scale(1, fall * 0.24, easeOutCubic),
        ...incoming.map(l => l.end(1, ctx.lineT * 0.9, easeOutQuad)),
      );
    }
  },
  *emphasize(step) {
    yield* all(
      step.from.stroke(step.col, 0.18), step.from.shadowColor(`${step.col}55`, 0.18),
      step.from.scale(1.04, 0.2, easeOutCubic),
      ...step.others.map(b => b.opacity(DIM, 0.2)),
    );
    // Şok dalgası: darbe hızlı geçer, hedef "çarpılır" ve toparlanır.
    yield* all(
      pulseAlong(step, step.pulseT * 0.55),
      step.to.stroke(step.col, step.pulseT * 0.55),
      step.to.shadowColor(`${step.col}66`, step.pulseT * 0.55),
    );
    yield* step.to.scale(1.07, step.pulseT * 0.2, easeOutQuad);
    yield* step.to.scale(1.02, step.pulseT * 0.25, easeOutCubic);
  },
  reset: plainReset,
  *exit(ctx) {
    // Düşerek geldiler, düşerek gidiyorlar (sıralı, kısa).
    yield* all(
      ...ctx.boxes.map((b, i) => delay(i * 0.05, all(
        b.opacity(0, 0.3), b.y(b.y() + 26, 0.35, easeInQuad),
      ))),
      ...ctx.allLines.map(l => l.opacity(0, 0.3)),
    );
  },
};

// ── 5. RIPPLE — merkezden açılır, her adımda halka dalgası hedefe çarpar ──────
const ripple: Choreo = {
  key: 'ripple',
  *enter(ctx) {
    ctx.boxes.forEach((b, i) => {
      b.y(ctx.pos[i].y);
      b.scale(0.78);
    });
    // Merkeze yakın kart önce açılır, uzaktakiler dalga gibi arkasından gelir.
    const dist = ctx.pos.map(p => Math.hypot(p.x, p.y - ctx.clusterY));
    const maxD = Math.max(...dist, 1);
    yield* all(
      ...ctx.boxes.map((b, i) => delay((dist[i] / maxD) * ctx.enterT * 1.1, all(
        b.opacity(1, ctx.enterT * 0.9, easeOutCubic),
        b.scale(1, ctx.enterT * 1.1, easeOutBack),
      ))),
      delay(ctx.enterT * 0.8, drawAllLines(ctx, ctx.lineT * 1.5)),
    );
  },
  *emphasize(step) {
    const ring = createRef<Circle>();
    step.stage.add(
      <Circle ref={ring} x={step.pos[step.fi].x} y={step.pos[step.fi].y} size={40}
        stroke={step.col} lineWidth={5} opacity={0.9} zIndex={0} />,
    );
    const reach = Math.hypot(step.pos[step.ti].x - step.pos[step.fi].x,
      step.pos[step.ti].y - step.pos[step.fi].y) * 2 + 90;
    yield* all(
      step.from.stroke(step.col, 0.2), step.from.shadowColor(`${step.col}55`, 0.2),
      ...step.others.map(b => b.opacity(DIM, 0.22)),
      ring().size(reach, step.pulseT * 0.85, easeOutCubic),
      ring().lineWidth(1.5, step.pulseT * 0.85),
      ring().opacity(0, step.pulseT * 0.85, easeInQuad),
      delay(step.pulseT * 0.35, all(
        pulseAlong(step, step.pulseT * 0.5),
        step.to.stroke(step.col, step.pulseT * 0.5),
        step.to.shadowColor(`${step.col}66`, step.pulseT * 0.5),
        step.to.scale(1.05, step.pulseT * 0.5, easeOutCubic),
      )),
    );
    ring().remove();
  },
  reset: plainReset,
  *exit(ctx) {
    yield* all(
      ...ctx.boxes.map(b => all(b.opacity(0, 0.35), b.scale(0.86, 0.4, easeOutCubic))),
      ...ctx.allLines.map(l => l.opacity(0, 0.3)),
    );
  },
};

export const CHOREOS: Record<string, Choreo> = {
  buildup, spotlight, camera, cascade, ripple,
};

/** spec.motion → kareografi. Bilinmeyen/eksik değer buildup'a düşer (yayın kırılmaz). */
export function resolveChoreo(name?: string): Choreo {
  return CHOREOS[name ?? ''] ?? buildup;
}
