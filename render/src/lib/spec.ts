export const COLORS = {
  bg: '#0d1117', card: '#161b22', stroke: '#30363d',
  accent: '#58a6ff', good: '#3fb950', warn: '#d29922',
  text: '#e6edf3', muted: '#8b949e',
} as const;

export function resolveColor(token: string): string {
  return (COLORS as Record<string, string>)[token] ?? COLORS.accent;
}

// count kadar yatay merkezlenmiş x koordinatı; box'lar (300px genişlik) 1080px
// canvas'ta (x ∈ [-540,540]) taşmasın diye gap adaptif küçültülür.
export function nodeXPositions(count: number): number[] {
  const halfWidth = 380; // ~box half-width (150) payı bırakılmış kullanılabilir yarı genişlik
  const gap = count > 1 ? Math.min(360, (2 * halfWidth) / (count - 1)) : 360;
  const start = -((count - 1) * gap) / 2;
  return Array.from({length: count}, (_, i) => start + i * gap);
}

export interface SpecNode {id: string; label: string; icon?: string}
export interface SpecStep {from: string; to: string; packet: string; color?: string; status: string}
export interface SpecScene {layout: string; heading?: string; nodes: SpecNode[]; steps: SpecStep[]}
export interface SceneSpec {
  title: string; caption: string; hashtags: string[];
  topic_source?: string; scenes: SpecScene[];
}
