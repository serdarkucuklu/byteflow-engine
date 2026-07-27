export const COLORS = {
  bg: '#0d1117', card: '#141a22', stroke: '#263040',
  accent: '#58a6ff', good: '#3fb950', warn: '#d29922',
  text: '#eef3f8', muted: '#93a1b1',
} as const;

// Tipografi: kelimeler INSANİ bir sans'ta (Inter), mono SADECE kod ve sistem satırında.
// Her yerin mono olması "tatlı/okunur" değil terminal hissi veriyordu (Serdar, 2026-07-27).
// CI 'fonts-inter' kuruyor; kurulmazsa zincir sistem sans'ına düşer.
export const FONTS = {
  display: 'Inter, Inter Variable, Segoe UI, Helvetica Neue, Arial, sans-serif',
  mono: 'JetBrains Mono, DejaVu Sans Mono, monospace',
} as const;

// Güvenli alan — hiçbir kart köşeye savrulmaz (Serdar geri bildirimi).
export const SAFE = {x: 430, top: -430, bottom: 480} as const;

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
      const R = count <= 4 ? 300 : count <= 6 ? 330 : 350;
      const pts: Pos[] = [{x: 0, y: 25}];
      const n = Math.max(count - 1, 1);
      for (let i = 0; i < count - 1; i++) {
        const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
        pts.push({x: Math.cos(a) * R, y: 25 + Math.sin(a) * R * 0.98});
      }
      return pts.slice(0, count);
    }
    case 'cycle': {
      const R = count <= 4 ? 290 : count <= 6 ? 325 : 350;
      return Array.from({length: count}, (_, i) => {
        const a = -Math.PI / 2 + (i / count) * 2 * Math.PI;
        return {x: Math.cos(a) * R, y: 25 + Math.sin(a) * R * 0.98};
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
      const top = 25 - total / 2 + h / 2;
      return Array.from({length: count}, (_, i) => ({x: 0, y: top + i * (h + gap)}));
    }
  }
}

// Kart ölçüleri — kolonda geniş ve okunaklı, halkada derli toplu.
export function boxSize(layout: string, count: number): {w: number; h: number} {
  if (layout === 'vertical-stack') {
    const h = Math.max(96, Math.min(180, (880 - (count - 1) * 18) / count));
    return {w: 780, h: Math.round(h)};
  }
  if (layout === 'hub-spoke' || layout === 'cycle') {
    return count <= 4 ? {w: 265, h: 190} : count <= 6 ? {w: 235, h: 180} : {w: 212, h: 168};
  }
  const h = Math.max(94, Math.min(186, (880 - (count - 1) * 30) / count));
  return {w: count <= 5 ? 620 : 560, h: Math.round(h)};
}

export interface SpecNode {id: string; label: string; icon?: string; brand?: string}
export interface SpecStep {from: string; to: string; packet: string; color?: string; status: string}
export interface SpecScene {
  kind?: 'diagram' | 'code';
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
  scenes: SpecScene[];
}
