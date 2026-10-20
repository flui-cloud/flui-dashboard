import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { SystemAppsPreference } from '../../../core/services/system-apps-preference.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { SandboxService } from '../../../core/services/sandbox.service';
import { TopologyDashboardService } from '../../service/topology.service';
import { destinationsFor } from './topology-navigation';
import { applyTopologyEvent } from './topology-patch';
import {
  DEFAULT_TOPOLOGY_STATE,
  TopologyFocus,
  TopologyViewState,
  parseTopologyState,
  topologyQueryParams,
} from './topology-state';

/** One page's view of the topology: the snapshot, kept live, and what is selected. */
@Injectable()
export class TopologyStore {
  private readonly api = inject(TopologyDashboardService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sandbox = inject(SandboxService);
  private readonly destroyRef = inject(DestroyRef);
  readonly systemApps = inject(SystemAppsPreference);

  private readonly _snapshot = signal<TopologyResponseDto | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly snapshot = this._snapshot.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => !this._snapshot() && !this._error());
  readonly live = this.api.connected;
  readonly guest = this.sandbox.inSandbox;

  readonly state = toSignal(
    this.route.queryParamMap.pipe(
      map((params) =>
        parseTopologyState(Object.fromEntries(params.keys.map((k) => [k, params.get(k)]))),
      ),
    ),
    { initialValue: DEFAULT_TOPOLOGY_STATE },
  );

  /** The focused entity, or nothing when the address names one the snapshot does not hold. */
  readonly focus = computed<TopologyFocus | null>(() => {
    const focus = this.state().focus;
    const snapshot = this._snapshot();
    if (!focus || !snapshot) return null;
    const found =
      (focus.type === 'cluster' && snapshot.clusters.some((c) => c.id === focus.id)) ||
      (focus.type === 'server' && snapshot.servers.some((s) => s.id === focus.id)) ||
      (focus.type === 'stack' && snapshot.stacks.some((s) => s.id === focus.id)) ||
      (focus.type === 'app' && snapshot.apps.some((a) => a.id === focus.id)) ||
      (focus.type === 'link' && snapshot.links.some((l) => l.id === focus.id)) ||
      (focus.type === 'platform' && snapshot.apps.some((a) => a.clusterId === focus.id && a.kind === 'system'));
    return found ? focus : null;
  });

  readonly destinations = computed(() =>
    destinationsFor(this.focus(), this._snapshot(), this.guest()),
  );

  constructor() {
    // A reconnect reloads the whole snapshot, so nothing missed while away is lost.
    effect(() => {
      const fresh = this.api.data();
      if (fresh) this._snapshot.set(fresh);
    });
    this.api.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) =>
      this._snapshot.update((s) => (s ? applyTopologyEvent(s, event) : s)),
    );
    this.destroyRef.onDestroy(() => this.api.stopStream());
    // Showing or hiding platform apps changes what the API sends: fetch again, stream again.
    let first = true;
    effect(() => {
      this.systemApps.shownOnMap();
      if (first) {
        first = false;
        return;
      }
      untracked(() => {
        this.api.stopStream();
        void this.load();
      });
    });
  }

  async load(): Promise<void> {
    try {
      await this.api.load();
      this._error.set(null);
      this.api.startStream();
    } catch {
      this._error.set('The topology could not be loaded.');
    }
  }

  select(focus: TopologyFocus | null): void {
    this.update({ focus });
  }

  update(patch: Partial<TopologyViewState>): void {
    const current = this.state();
    const moved = ('level' in patch && patch.level !== current.level) || ('cluster' in patch && patch.cluster !== current.cluster);
    const next = { ...current, ...(moved && !('all' in patch) ? { all: false } : {}), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: topologyQueryParams(next),
    });
  }
}
