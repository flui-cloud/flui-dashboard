import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { percent, statusLabel, toneOf } from './topology-format';

interface AttentionItem {
  key: string;
  label: string;
  detail: string;
  tone: string;
  focus: TopologyFocus;
}

const FULL_MEMORY_PCT = 90;

const severity = (status: string): number => (status === 'error' ? 0 : 1);

function clustersOf(names: string[]): string {
  const unique: string[] = [...new Set(names)];
  return unique.join(' · ');
}

/** What the fleet asks of a person right now, shown while nothing is selected. */
export function attentionOf(t: TopologyResponseDto | null): {
  needs: AttentionItem[];
  spread: AttentionItem[];
} {
  if (!t) return { needs: [], spread: [] };
  const clusterName = (id: string) => t.clusters.find((c) => c.id === id)?.name ?? '';
  const needs: AttentionItem[] = [
    ...t.clusters
      .filter((c) => c.status === 'down')
      .map((c) => ({
        key: `cluster-down:${c.id}`,
        label: c.name,
        detail: 'Not answering',
        tone: 'error',
        focus: { type: 'cluster' as const, id: c.id },
      })),
    ...t.apps
      .filter((a) => a.status === 'error' || a.status === 'warning')
      .sort((a, b) => severity(a.status) - severity(b.status))
      .map((a) => ({
        key: `app:${a.id}`,
        label: a.displayName,
        detail: a.statusReason ?? statusLabel(a.status),
        tone: toneOf(a.status),
        focus: { type: 'app' as const, id: a.id },
      })),
    ...t.servers
      .filter((s) => (s.capacity?.usedMemPct ?? 0) >= FULL_MEMORY_PCT)
      .map((s) => ({
        key: `server:${s.id}`,
        label: s.nodeName,
        detail: `Memory ${percent(s.capacity?.usedMemPct)}`,
        tone: 'error',
        focus: { type: 'server' as const, id: s.id },
      })),
    ...t.clusters
      .filter((c) => c.overlay === 'public-address')
      .map((c) => ({
        key: `cluster:${c.id}`,
        label: c.name,
        detail: 'Reached on its public address',
        tone: 'degraded',
        focus: { type: 'cluster' as const, id: c.id },
      })),
  ];

  const byGroup = new Map<string, typeof t.apps>();
  for (const a of t.apps) {
    if (a.kind !== 'system') byGroup.set(a.groupKey, [...(byGroup.get(a.groupKey) ?? []), a]);
  }
  const spread = [...byGroup.values()]
    .filter((apps) => new Set(apps.map((a) => a.clusterId)).size > 1)
    .map((apps) => ({
      key: apps[0].groupKey,
      label: apps[0].displayName,
      detail: clustersOf(apps.map((a) => clusterName(a.clusterId))),
      tone: toneOf(apps.some((a) => a.status !== 'running') ? 'warning' : 'running'),
      focus: { type: 'app' as const, id: apps[0].id },
    }));

  return { needs, spread };
}

@Component({
  selector: 'app-topology-attention',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5 p-4 text-sm">
      <p class="text-sub">Select anything on the map to see what it runs and open its page.</p>
      @for (group of groups(); track group.title) {
        <section>
          <h3 class="text-label mb-2">{{ group.title }}</h3>
          @if (group.items.length) {
            <ul class="space-y-1">
              @for (item of group.items; track item.key) {
                <li>
                  <button type="button" class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                          (click)="selected.emit(item.focus)">
                    <span class="flex min-w-0 max-w-[60%] flex-none items-center gap-2">
                      <span class="h-1.5 w-1.5 flex-none rounded-full" [class]="'dot-' + item.tone"></span>
                      <span class="truncate text-foreground">{{ item.label }}</span>
                    </span>
                    <span class="text-sub truncate">{{ item.detail }}</span>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sub">{{ group.empty }}</p>
          }
        </section>
      }
    </div>
  `,
})
export class TopologyAttentionComponent {
  readonly snapshot = input<TopologyResponseDto | null>(null);
  readonly selected = output<TopologyFocus>();

  protected readonly groups = computed(() => {
    const { needs, spread } = attentionOf(this.snapshot());
    return [
      { title: 'Needs attention', items: needs, empty: 'Nothing right now.' },
      {
        title: 'Spread across clusters',
        items: spread,
        empty: this.snapshot()?.apps.length ? 'Every app runs on one cluster.' : 'No app to place yet.',
      },
    ];
  });
}
