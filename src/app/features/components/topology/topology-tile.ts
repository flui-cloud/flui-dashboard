import { FULL_PCT, NetworkKind, Tile } from './topology-tiles';
import { TopologyColorBy } from './topology-state';

export interface TileLook {
  background: string;
  color: string;
  border: string;
}

const LIGHT_TEXT = 'hsl(var(--primary-foreground))';
const DARK_TEXT = 'hsl(var(--foreground))';

const NETWORK_LOOK: Record<NetworkKind, TileLook> = {
  flui: { background: 'hsl(var(--ok) / 0.18)', color: DARK_TEXT, border: 'hsl(var(--ok))' },
  'flui-waiting': { background: 'hsl(var(--warn) / 0.18)', color: DARK_TEXT, border: 'hsl(var(--warn))' },
  private: { background: 'hsl(var(--brand) / 0.14)', color: DARK_TEXT, border: 'hsl(var(--brand) / 0.6)' },
  public: { background: 'hsl(var(--muted))', color: DARK_TEXT, border: 'hsl(var(--muted-foreground) / 0.6)' },
};

/**
 * One ramp from the portal's brand token, red from 90% up. Text switches to the
 * light colour only where the fill is dark enough to keep it readable.
 */
export function tileLook(tile: Tile, colorBy: TopologyColorBy, maxPods: number): TileLook {
  if (colorBy === 'network') return NETWORK_LOOK[tile.network];
  if (tile.value === null) {
    return { background: 'hsl(var(--muted))', color: DARK_TEXT, border: 'transparent' };
  }
  if (colorBy !== 'pods' && tile.value >= FULL_PCT) {
    return { background: 'hsl(var(--destructive))', color: LIGHT_TEXT, border: 'transparent' };
  }
  const k = colorBy === 'pods' ? share(tile.value, maxPods) : Math.min(1, Math.max(0, (tile.value - 30) / 60));
  const alpha = 0.12 + 0.78 * k;
  return {
    background: `hsl(var(--brand) / ${alpha.toFixed(2)})`,
    color: alpha >= 0.7 ? LIGHT_TEXT : DARK_TEXT,
    border: 'transparent',
  };
}

function share(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}
