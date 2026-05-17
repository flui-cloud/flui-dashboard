import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationLogsService as ApiLogsService } from '../../core/api/api/applicationLogs.service';
import type { AppLogEntryDto } from '../../core/api/model/appLogEntryDto';
import type { AppLogVolumeResponseDto } from '../../core/api/model/appLogVolumeResponseDto';

export type { AppLogEntryDto };

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

// ─── Query / Filter state ─────────────────────────────────────────────────────

export const ALL_LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;

export const LOG_TIME_RANGES = [
  { label: 'Last 15 min', value: '15m', minutes: 15 },
  { label: 'Last 1 hour', value: '1h', minutes: 60 },
  { label: 'Last 4 hours', value: '4h', minutes: 240 },
  { label: 'Last 24 hours', value: '24h', minutes: 1440 },
  { label: 'Last 7 days', value: '7d', minutes: 10080 },
  { label: 'Custom', value: 'custom', minutes: 0 },
] as const;

export type LogTimeRangeValue = typeof LOG_TIME_RANGES[number]['value'];

export interface LogCustomRange { start: string; end: string; }

export interface LogQueryParams {
  clusterId: string;
  namespace: string;
  app: string;
  level?: string;
  search?: string;
  tail?: number;
  start?: string;
  end?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rangeToStep(start: string, end: string): string {
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  if (hours <= 1)   return '5m';
  if (hours <= 6)   return '15m';
  if (hours <= 24)  return '1h';
  if (hours <= 72)  return '1h';
  if (hours <= 168) return '1h';
  return '1d';
}

function presetToIso(rangeValue: LogTimeRangeValue): LogCustomRange {
  const now = new Date();
  const range = LOG_TIME_RANGES.find(r => r.value === rangeValue);
  const minutes = range?.minutes ?? 60;
  return {
    start: new Date(now.getTime() - minutes * 60_000).toISOString(),
    end:   now.toISOString(),
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApplicationLogsService {
  private readonly api = inject(ApiLogsService);

  // ── Remote data ──────────────────────────────────────────────────────────
  private readonly _logs          = signal<AppLogEntryDto[]>([]);
  private readonly _volume        = signal<AppLogVolumeResponseDto | null>(null);
  private readonly _loading       = signal(false);
  private readonly _volumeLoading = signal(false);
  private readonly _error         = signal<string | null>(null);
  private readonly _queriedAt     = signal<string | null>(null);

  readonly logs          = this._logs.asReadonly();
  readonly volume        = this._volume.asReadonly();
  readonly loading       = this._loading.asReadonly();
  readonly volumeLoading = this._volumeLoading.asReadonly();
  readonly error         = this._error.asReadonly();
  readonly queriedAt     = this._queriedAt.asReadonly();

  readonly levelCounts = computed(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const entry of this._logs()) {
      const lvl = (entry.level ?? 'unknown').toLowerCase();
      counts[lvl] = (counts[lvl] ?? 0) + 1;
    }
    return counts;
  });

  /** Totals per level summed from the volume response (full range, not capped at 500) */
  readonly volumeLevelTotals = computed((): Partial<Record<string, number>> => {
    const vol = this._volume();
    if (!vol) return {};
    const totals: Partial<Record<string, number>> = {};
    for (const ls of vol.series) {
      totals[ls.level] = ls.series.reduce((sum, b) => sum + b.count, 0);
    }
    return totals;
  });

  // ── Query state ───────────────────────────────────────────────────────────
  private readonly _appContext  = signal<{ clusterId: string; namespace: string; app: string } | null>(null);
  private readonly _search      = signal('');
  private readonly _levelActive = signal<Record<string, boolean>>(
    Object.fromEntries(ALL_LOG_LEVELS.map(l => [l, true]))
  );

  /**
   * The "outer" range: drives both the volume histogram and log queries.
   * Set by preset selector or explicit custom date picker.
   * Never overwritten by a brush drag.
   */
  private readonly _selectedRange = signal<LogTimeRangeValue>('1h');
  private readonly _customRange   = signal<LogCustomRange | null>(null);

  /**
   * The "inner" range: set only by a brush drag on the histogram.
   * Used exclusively for log queries — the volume histogram always
   * reflects the outer range.
   * Cleared whenever the outer range changes.
   */
  private readonly _brushRange = signal<LogCustomRange | null>(null);

  // ── Public readonly state ─────────────────────────────────────────────────

  readonly selectedRange = this._selectedRange.asReadonly();
  readonly customRange   = this._customRange.asReadonly();
  readonly brushRange    = this._brushRange.asReadonly();
  readonly search        = this._search.asReadonly();
  readonly levelActive   = this._levelActive.asReadonly();

  readonly selectedRangeLabel = computed(
    () => LOG_TIME_RANGES.find(r => r.value === this._selectedRange())?.label ?? ''
  );

  readonly customRangeLabel = computed(() => {
    const r = this._customRange();
    if (!r) return null;
    const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `${fmt(r.start)} → ${fmt(r.end)}`;
  });

  /** The full outer range used for the volume histogram */
  readonly volumeIsoRange = computed((): LogCustomRange => {
    const preset = this._selectedRange();
    if (preset === 'custom') return this._customRange() ?? presetToIso('1h');
    return presetToIso(preset);
  });

  /** The effective range for log queries — brush sub-range if active, outer range otherwise */
  readonly logsIsoRange = computed((): LogCustomRange => {
    return this._brushRange() ?? this.volumeIsoRange();
  });

  readonly filteredLogs = computed(() => {
    const active = this._levelActive();
    return this._logs().filter(l => {
      const lvl = (l.level ?? 'unknown').toLowerCase();
      return !!active[lvl];
    });
  });

  // ── Mutation helpers ──────────────────────────────────────────────────────

  /** Preset selector changed — reload both logs and volume */
  setPresetRange(value: LogTimeRangeValue) {
    this._selectedRange.set(value);
    this._customRange.set(null);
    this._brushRange.set(null);
    this._refreshAll();
  }

  /** Explicit custom date picker — reload both logs and volume */
  setCustomRange(range: LogCustomRange) {
    this._selectedRange.set('custom');
    this._customRange.set(range);
    this._brushRange.set(null);
    this._refreshAll();
  }

  /**
   * Brush drag on histogram — reload logs only on the sub-range.
   * Volume stays on the outer range (already loaded, shows full context).
   */
  setBrushRange(range: LogCustomRange) {
    this._brushRange.set(range);
    this._refreshLogs();
  }

  setSearch(term: string) {
    this._search.set(term);
    this._refreshLogs();
  }

  toggleLevel(level: string) {
    this._levelActive.update(m => ({ ...m, [level]: !m[level] }));
    // client-side filter only — no API call
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(ctx: { clusterId: string; namespace: string; app: string }) {
    this._appContext.set(ctx);
    this._refreshAll();
  }

  clear() {
    this._logs.set([]);
    this._volume.set(null);
    this._error.set(null);
    this._queriedAt.set(null);
    this._appContext.set(null);
    this._selectedRange.set('1h');
    this._customRange.set(null);
    this._brushRange.set(null);
    this._search.set('');
    this._levelActive.set(Object.fromEntries(ALL_LOG_LEVELS.map(l => [l, true])));
  }

  /** Public refresh (e.g. manual refresh button) — reloads logs on current range */
  refresh() {
    this._refreshAll();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Reload logs on the inner range + volume on the outer range */
  private _refreshAll() {
    const ctx = this._appContext();
    if (!ctx) return;
    const vRange = this.volumeIsoRange();
    const lRange = this.logsIsoRange();
    const step   = rangeToStep(vRange.start, vRange.end);
    this._loadLogs({ ...ctx, tail: 500, start: lRange.start, end: lRange.end, search: this._search() || undefined });
    this._loadVolume(ctx.clusterId, ctx.namespace, ctx.app, vRange.start, vRange.end, step);
  }

  /** Reload logs only (after brush/search changes — volume stays intact) */
  private _refreshLogs() {
    const ctx = this._appContext();
    if (!ctx) return;
    const lRange = this.logsIsoRange();
    this._loadLogs({ ...ctx, tail: 500, start: lRange.start, end: lRange.end, search: this._search() || undefined });
  }

  private async _loadLogs(params: LogQueryParams): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const response = await firstValueFrom(
        this.api.applicationLogsControllerGetAppLogs(
          params.clusterId,
          params.namespace,
          params.app,
          undefined, // container
          undefined, // pod
          undefined, // stream
          params.level || undefined,
          params.search || undefined,
          params.tail ?? 500,
          params.start,
          params.end,
        )
      );
      this._logs.set(response.logs ?? []);
      this._queriedAt.set(response.queried_at ?? null);
    } catch (err: any) {
      this._error.set(err?.message ?? 'Failed to load logs');
      this._logs.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  private async _loadVolume(
    clusterId: string,
    namespace: string,
    app: string,
    start: string,
    end: string,
    step?: string,
  ): Promise<void> {
    this._volumeLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.api.applicationLogsControllerGetAppLogVolume(
          clusterId, start, end, namespace, app, undefined, undefined, step,
        )
      );
      this._volume.set(response);
    } catch {
      this._volume.set(null);
    } finally {
      this._volumeLoading.set(false);
    }
  }
}
