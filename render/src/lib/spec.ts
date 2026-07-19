export const COLORS = {
  bg: '#0d1117', card: '#161b22', stroke: '#30363d',
  accent: '#58a6ff', good: '#3fb950', warn: '#d29922',
  text: '#e6edf3', muted: '#8b949e',
} as const;

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
  const R = count <= 2 ? 360 : 430;
  switch (layout) {
    case 'vertical-stack': {
      const gap = Math.min(380, 1000 / Math.max(count - 1, 1));
      const start = -((count - 1) * gap) / 2;
      return Array.from({length: count}, (_, i) => ({x: 0, y: start + i * gap}));
    }
    case 'hub-spoke': {
      const pts: Pos[] = [{x: 0, y: 0}];
      const n = Math.max(count - 1, 1);
      for (let i = 0; i < count - 1; i++) {
        const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
        pts.push({x: Math.cos(a) * R, y: Math.sin(a) * R});
      }
      return pts.slice(0, count);
    }
    case 'cycle': {
      return Array.from({length: count}, (_, i) => {
        const a = -Math.PI / 2 + (i / count) * 2 * Math.PI;
        return {x: Math.cos(a) * R, y: Math.sin(a) * R};
      });
    }
    case 'nodes-flow':
    default: {
      const XL = -235, XR = 235;               // two columns
      const rows = Math.ceil(count / 2);
      const yTop = -380, yBot = 440;
      const yOf = (r: number) => rows <= 1 ? 30 : yTop + r * (yBot - yTop) / (rows - 1);
      const out: Pos[] = [];
      for (let i = 0; i < count; i++) {
        const r = Math.floor(i / 2);
        const inRow = i % 2;                    // 0 or 1
        const leftFirst = r % 2 === 0;          // boustrophedon: even rows L→R, odd rows R→L
        // last node alone on its row → center it
        const aloneOnRow = (i === count - 1) && (count % 2 === 1);
        let x: number;
        if (aloneOnRow) x = 0;
        else x = (inRow === 0) === leftFirst ? XL : XR;
        out.push({x, y: yOf(r)});
      }
      return out;
    }
  }
}

// Layout + node sayısına göre box boyutu — büyük, dokunulası "modül" kartları.
export function boxSize(layout: string, count: number): {w: number; h: number} {
  if (layout === 'nodes-flow') {
    // h, data-fazındaki paket rozetinin (62px, kutu merkezinde doğar) label'a değmemesi
    // için yeterli boşluk bıraksın (label y-offset = h*0.27) — sadece w ile küçültme yapılırsa
    // yatay adımlarda paket etiketin üstüne biner (doğrulamada görüldü, h=190'da oldu).
    if (count <= 2) return {w: 300, h: 250};
    if (count <= 4) return {w: 240, h: 230};
    return {w: 210, h: 230};           // 5-6 node: dar ama yeterince uzun tuğlalar
  }
  if (layout === 'vertical-stack') return {w: 560, h: Math.min(220, 1020 / count)};
  return {w: count <= 3 ? 260 : 210, h: 210}; // hub-spoke, cycle
}

export interface SpecNode {id: string; label: string; icon?: string}
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
  scenes: SpecScene[];
}
