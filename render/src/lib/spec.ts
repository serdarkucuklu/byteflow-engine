export const DEFAULT_COLORS = {
  bg: '#0d1117', card: '#141a22', stroke: '#263040',
  accent: '#58a6ff', good: '#3fb950', warn: '#d29922',
  text: '#eef3f8', muted: '#93a1b1',
} as const;

// Marka paleti: her sayfanın kendi rengi olsun (cilt bakımı sayfası GitHub-koyusu olamaz).
// spec.palette varsa varsayılanların üstüne biner.
export type Palette = typeof DEFAULT_COLORS;
export function resolvePalette(spec?: {palette?: Partial<Palette>}): Palette {
  return {...DEFAULT_COLORS, ...(spec?.palette ?? {})} as Palette;
}
export const COLORS = DEFAULT_COLORS;   // geriye uyum

// Tipografi: kelimeler INSANİ bir sans'ta (Inter), mono SADECE kod ve sistem satırında.
// Her yerin mono olması "tatlı/okunur" değil terminal hissi veriyordu (Serdar, 2026-07-27).
// CI 'fonts-inter' kuruyor; kurulmazsa zincir sistem sans'ına düşer.
export const FONTS = {
  display: 'Inter, Inter Variable, Segoe UI, Helvetica Neue, Arial, sans-serif',
  mono: 'JetBrains Mono, DejaVu Sans Mono, monospace',
} as const;

// INSTAGRAM GÜVENLİ ALANI (1080x1920 kare, MC koordinatı = pikselden 960 çıkarılmış):
//   üstte ~210px  → beğeni/menü ikonları ve üst gradyan
//   altta ~385px  → caption, kullanıcı adı, ses şeridi, ilerleme çubuğu
// Ölçüm (2026-07-27): altyazı hapı y=616 (1576px) TAM alt arayüzün altında kalıyordu —
// yani en kritik retention öğesi feed'de yarı görünmezdi. Her metin bu banda sığmalı.
export const SAFE = {x: 430, top: -740, bottom: 545} as const;
export const CAPTION_Y = 452;      // 1412px — alt arayüzün güvenli üstünde
export const CLUSTER_Y = -60;      // diyagram kümesinin dikey merkezi

// Video başına dönen accent temaları — ardışık videolar aynı görünmesin diye.
export const THEMES = ['#58a6ff', '#bc8cff', '#39d3c3', '#f778ba', '#e3b341', '#3fb950'];

// Desteklenen layout'lar (aynı nodes+steps verisi, farklı kompozisyon).
export const LAYOUTS = ['nodes-flow', 'vertical-stack', 'hub-spoke', 'cycle'] as const;

// token 'accent' ise video temasına, 'good'/'warn' sabit; bilinmeyen → accent.
export function resolveColor(token: string, accent: string = COLORS.accent): string {
  if (token === 'accent') return accent;
  return (COLORS as Record<string, string>)[token] ?? accent;
}

// count kadar yatay merkezlenmiş x koordinatı; box'lar 1080px canvas'ta taşmasın.
// Genişlik-farkında: kutu ne kadar büyükse aralık o kadar açılır (çakışma yok,
// kenar 540px'i geçmez). w verilmezse nodes-flow varsayılan genişliği kullanılır.
export function nodeXPositions(count: number, w: number = boxSize('nodes-flow', count).w): number[] {
  if (count <= 1) return [0];
  const spacing = 44;                     // kutular arası nefes payı
  const maxCenter = 540 - w / 2 - 8;      // en dış kutu canvas'ta kalsın
  const idealGap = w + spacing;
  const gap = Math.min(idealGap, (2 * maxCenter) / (count - 1));
  const start = -((count - 1) * gap) / 2;
  return Array.from({length: count}, (_, i) => start + i * gap);
}

export interface Pos {x: number; y: number}

// Layout'a göre node merkez koordinatları (canvas merkezli, portre 1080x1920).
// Diyagram kareyi domine etsin diye yarıçaplar/aralıklar büyük tutuldu.
export function layoutPositions(layout: string, count: number): Pos[] {
  if (count <= 0) return [];
  switch (layout) {
    case 'hub-spoke': {
      // Koordinatör MERKEZDE, uydular onun etrafında bir halkada — köşe yok.
      const R = count <= 3 ? 292 : count <= 4 ? 320 : count <= 6 ? 342 : 356;
      const pts: Pos[] = [{x: 0, y: CLUSTER_Y}];
      const n = Math.max(count - 1, 1);
      for (let i = 0; i < count - 1; i++) {
        const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
        pts.push({x: Math.cos(a) * R, y: CLUSTER_Y + Math.sin(a) * R * 0.96});
      }
      return pts.slice(0, count);
    }
    case 'cycle': {
      const R = count <= 3 ? 286 : count <= 4 ? 312 : count <= 6 ? 338 : 352;
      return Array.from({length: count}, (_, i) => {
        const a = -Math.PI / 2 + (i / count) * 2 * Math.PI;
        return {x: Math.cos(a) * R, y: CLUSTER_Y + Math.sin(a) * R * 0.96};
      });
    }
    case 'vertical-stack':
    case 'nodes-flow':
    default: {
      // 9:16'da akış YUKARIDAN AŞAĞI okunur: tek kolon, ortalanmış, eşit ritim.
      // (Eski serpentine düzen kartları köşelere savurup gözü zikzak çizdiriyordu.)
      const {h} = boxSize(layout, count);
      const gap = layout === 'vertical-stack' ? 18 : 30;
      const total = count * h + (count - 1) * gap;
      const top = CLUSTER_Y - total / 2 + h / 2;
      return Array.from({length: count}, (_, i) => ({x: 0, y: top + i * (h + gap)}));
    }
  }
}

// Kart ölçüleri — kolonda geniş ve okunaklı, halkada derli toplu.
export function boxSize(layout: string, count: number): {w: number; h: number} {
  if (layout === 'vertical-stack') {
    const h = Math.max(92, Math.min(172, (820 - (count - 1) * 18) / count));
    return {w: 780, h: Math.round(h)};
  }
  if (layout === 'hub-spoke' || layout === 'cycle') {
    return count <= 3 ? {w: 340, h: 232} : count <= 4 ? {w: 300, h: 210} : count <= 6 ? {w: 250, h: 190} : {w: 220, h: 174};
  }
  const h = Math.max(90, Math.min(178, (820 - (count - 1) * 30) / count));
  return {w: count <= 5 ? 620 : 560, h: Math.round(h)};
}

export interface SpecNode {id: string; label: string; icon?: string; brand?: string}
export interface SpecStep {from: string; to: string; packet: string; color?: string; status: string}
export interface VersusRow {label: string; left: string; right: string; winner?: 'left' | 'right' | 'tie'}
export interface SpecScene {
  kind?: 'diagram' | 'code' | 'versus';
  layout: string;
  heading?: string;
  // diagram
  nodes?: SpecNode[];
  steps?: SpecStep[];
  // code
  language?: string;
  code?: string;
  reveal?: 'typing' | 'lines' | 'instant';
  annotation?: string;
  // versus: iki ürün/seçenek tek boyutta kafa kafaya (2026 verisi: en çok izlenen format)
  left?: string;
  right?: string;
  rows?: VersusRow[];
}
export interface SceneSpec {
  title: string; caption: string; hashtags: string[];
  topic_source?: string; theme?: string;
  hook?: string; takeaway?: string;
  // footage: true → sahne ŞEFFAF arka planla render edilir (alpha PNG dizisi) ve
  // ffmpeg gerçek b-roll görüntüsünün üstüne bindirir (publish/compose-footage.mjs).
  // run-daily.mjs klip indirebildiyse bunu true yazar; indiremezse eski düz arka plan.
  footage?: boolean;
  footage_queries?: string[];
  // beats: seslendirmeden ÖLÇÜLEN zamanlama (publish/voiceover.mjs). Varsa sahne ritmini
  // pacing governor değil BU belirler — ses otorite, görsel ona uyar.
  // Sıra: [hook, ...ilk sahnenin her adımı, kapanış].
  beats?: {text: string; start: number; dur: number}[];
  narration?: string[];
  brand?: {handle?: string; signoff?: string; shareCta?: string};
  palette?: Partial<Palette>;
  language?: string;
  scenes: SpecScene[];
}
