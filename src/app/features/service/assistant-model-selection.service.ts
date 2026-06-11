import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { InferenceSettingsService } from './inference-settings.service';

export interface PickerOption {
  label: string;
  opts: { model?: string; provider?: string; connectionId?: string } | null;
}

export interface EnrichedOption {
  idx: number;
  label: string;
  modelId?: string;
  provider?: string;
  description?: string;
  note?: string;
  opts: PickerOption['opts'];
}

export interface OtherGroup {
  key: string;
  label: string;
  options: EnrichedOption[];
}

type StoredSelection = { kind: 'auto' } | { provider?: string; connectionId?: string; model?: string };

const SELECTION_KEY = 'flui.assistant.modelSelection';

@Injectable({ providedIn: 'root' })
export class AssistantModelSelectionService {
  private readonly inference = inject(InferenceSettingsService);

  readonly selectedIdx = signal(0);

  readonly pickerOptions = computed<PickerOption[]>(() => {
    const opts: PickerOption[] = [{ label: 'Default (auto)', opts: null }];
    for (const p of this.inference.providers()) {
      for (const m of p.models ?? []) {
        opts.push({ label: `${p.provider} — ${m}`, opts: { provider: p.provider, model: m } });
      }
    }
    for (const c of this.inference.connections()) {
      for (const m of c.models) {
        opts.push({ label: `${c.label} — ${m}`, opts: { connectionId: c.id, model: m } });
      }
      if (!c.models.length) {
        opts.push({ label: c.label, opts: { connectionId: c.id } });
      }
    }
    return opts;
  });

  readonly selectedOpts = computed(() => this.pickerOptions()[this.selectedIdx()]?.opts ?? null);
  readonly selectedLabel = computed(() => this.pickerOptions()[this.selectedIdx()]?.label ?? '');

  readonly defaultModelLabel = computed(() => {
    const provider = this.inference.providers().find((p) => p.euDataResidency) ?? this.inference.providers()[0];
    return provider?.defaultModel ?? this.inference.recommendations()?.recommendedProvider.defaultModel ?? '';
  });

  readonly featuredOptions = computed<EnrichedOption[]>(() => {
    const result: EnrichedOption[] = [];
    this.pickerOptions().forEach((opt, idx) => {
      if (idx === 0) return;
      const rec = this.inference.recommendedModelFor(opt.opts);
      if (!rec) return;
      const provider =
        opt.opts?.provider ??
        this.inference.connections().find((c) => c.id === opt.opts?.connectionId)?.label ??
        '';
      result.push({ idx, label: opt.label, modelId: rec.model, provider, description: rec.description, note: rec.note, opts: opt.opts });
    });
    return result;
  });

  readonly otherOptions = computed<EnrichedOption[]>(() => {
    const result: EnrichedOption[] = [];
    this.pickerOptions().forEach((opt, idx) => {
      if (idx === 0) return;
      if (this.inference.recommendedModelFor(opt.opts)) return;
      result.push({ idx, label: opt.label, modelId: opt.opts?.model, opts: opt.opts });
    });
    return result;
  });

  readonly otherGroups = computed<OtherGroup[]>(() => {
    const groups = new Map<string, OtherGroup>();
    for (const opt of this.otherOptions()) {
      const key = opt.opts?.provider ? `p:${opt.opts.provider}` : `c:${opt.opts?.connectionId}`;
      const label =
        opt.opts?.provider ??
        this.inference.connections().find((c) => c.id === opt.opts?.connectionId)?.label ??
        'Other';
      let g = groups.get(key);
      if (!g) {
        g = { key, label, options: [] };
        groups.set(key, g);
      }
      g.options.push(opt);
    }
    return Array.from(groups.values());
  });

  readonly recommendedHint = computed(() => {
    const rec = this.inference.recommendations()?.recommendedProvider;
    if (!rec) return null;
    const configured = this.pickerOptions().some(
      (o, i) => i > 0 && this.inference.groupFor(o.opts)?.key === rec.key,
    );
    return configured ? null : rec;
  });

  readonly emptyStateHint = computed(() => {
    const providers = this.inference.providers();
    const connections = this.inference.connections();
    if (providers.length === 0 && connections.length === 0) {
      return 'No inference endpoint is configured yet.';
    }
    const opt = this.pickerOptions()[this.selectedIdx()];
    if (!opt?.opts) {
      const def = providers.find((p) => p.euDataResidency) ?? providers[0];
      if (def) return `Using ${def.provider}${def.euDataResidency ? ' · EU inference' : ''}`;
      const defConn = connections.find((c) => c.isDefault) ?? connections[0];
      if (defConn) return `Using ${defConn.label}`;
    }
    return '';
  });

  readonly endpointLabel = computed(() => {
    const opt = this.pickerOptions()[this.selectedIdx()];
    if (!opt?.opts) {
      const providers = this.inference.providers();
      if (providers.length === 1 && providers[0].euDataResidency) {
        return `EU inference · ${providers[0].provider}`;
      }
      return '';
    }
    const { provider, connectionId } = opt.opts;
    if (provider) {
      const info = this.inference.providers().find((p) => p.provider === provider);
      return info?.euDataResidency ? `EU inference · ${provider}` : provider;
    }
    if (connectionId) {
      return this.inference.connections().find((c) => c.id === connectionId)?.label ?? 'custom endpoint';
    }
    return '';
  });

  constructor() {
    effect(() => {
      const opts = this.pickerOptions();
      this.inference.recommendations();
      this.inference.connections();
      this.selectedIdx.set(this.resolveSelectionIdx(opts));
    });
  }

  select(idx: number): void {
    this.selectedIdx.set(idx);
    this.writeStored(this.pickerOptions()[idx]?.opts ?? null);
  }

  private resolveSelectionIdx(opts: PickerOption[]): number {
    const stored = this.readStored();
    if (stored) {
      const idx = this.findStoredIdx(opts, stored);
      if (idx >= 0) return idx;
    }
    return this.preselectIdx(opts);
  }

  private findStoredIdx(opts: PickerOption[], stored: StoredSelection): number {
    if ('kind' in stored) return 0;
    return opts.findIndex(
      (o, i) =>
        i > 0 &&
        o.opts?.provider === stored.provider &&
        o.opts?.connectionId === stored.connectionId &&
        o.opts?.model === stored.model,
    );
  }

  private preselectIdx(opts: PickerOption[]): number {
    const rec = this.inference.recommendations();
    if (!rec) return 0;
    const want = rec.recommendedProvider;
    const wantIdx = opts.findIndex(
      (o, i) => i > 0 && this.inference.groupFor(o.opts)?.key === want.key && o.opts?.model === want.defaultModel,
    );
    if (wantIdx >= 0) return wantIdx;
    const defIdx = opts.findIndex((o, i) => i > 0 && !!this.inference.recommendedModelFor(o.opts)?.isDefault);
    return Math.max(defIdx, 0);
  }

  private readStored(): StoredSelection | null {
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      return raw ? (JSON.parse(raw) as StoredSelection) : null;
    } catch {
      return null;
    }
  }

  private writeStored(opts: PickerOption['opts']): void {
    const sel: StoredSelection = opts
      ? { provider: opts.provider, connectionId: opts.connectionId, model: opts.model }
      : { kind: 'auto' };
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
    } catch {
      /* storage unavailable */
    }
  }
}
