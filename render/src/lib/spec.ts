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
export function nodeXPositions(count: number): number[] {
  const halfWidth = 380;
  const gap = count > 1 ? Math.min(360, (2 * halfWidth) / (count - 1)) : 360;
  const start = -((count - 1) * gap) / 2;
  return Array.from({length: count}, (_, i) => start + i * gap);
}

export interface Pos {x: number; y: number}

// Layout'a göre node merkez koordinatları (canvas merkezli, portre 1080x1920).
export function layoutPositions(layout: string, count: number): Pos[] {
  const R = count <= 2 ? 300 : 360;
  switch (layout) {
    case 'vertical-stack': {
      const gap = Math.min(300, 720 / Math.max(count - 1, 1));
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
    default:
      return nodeXPositions(count).map(x => ({x, y: 0}));
  }
}

// Layout + node sayısına göre box boyutu (çakışmayı önlemek için).
export function boxSize(layout: string, count: number): {w: number; h: number} {
  if (layout === 'nodes-flow') return {w: count >= 4 ? 240 : 300, h: 220};
  if (layout === 'vertical-stack') return {w: 460, h: Math.min(180, 700 / count)};
  return {w: 230, h: 170}; // hub-spoke, cycle
}

export interface SpecNode {id: string; label: string; icon?: string}
export interface SpecStep {from: string; to: string; packet: string; color?: string; status: string}
export interface SpecScene {layout: string; heading?: string; nodes: SpecNode[]; steps: SpecStep[]}
export interface SceneSpec {
  title: string; caption: string; hashtags: string[];
  topic_source?: string; theme?: string; scenes: SpecScene[];
}
