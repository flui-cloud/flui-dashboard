import { FULL_PCT, NetworkKind, Tile } from './topology-tiles';
import { TopologyColorBy } from './topology-state';
import { ExportPalette } from './topology-export';

export type TileTone = 'ink' | 'muted' | 'ok' | 'warn' | 'err';

const NETWORK_TONE: Record<NetworkKind, TileTone> = {
  flui: 'ok',
  'flui-waiting': 'warn',
  private: 'muted',
  public: 'muted',
};

export function tileValueTone(tile: Tile, colorBy: TopologyColorBy): TileTone {
  if (colorBy === 'network') return NETWORK_TONE[tile.network];
  if (tile.value === null) return 'muted';
  return (colorBy === 'memory' || colorBy === 'cpu') && tile.value >= FULL_PCT ? 'err' : 'ink';
}

const PALETTE_KEY: Record<TileTone, keyof ExportPalette> = {
  ink: 'fg',
  muted: 'muted',
  ok: 'ok',
  warn: 'warn',
  err: 'err',
};

export function tileValueColor(palette: ExportPalette, tone: TileTone): string {
  return palette[PALETTE_KEY[tone]];
}
