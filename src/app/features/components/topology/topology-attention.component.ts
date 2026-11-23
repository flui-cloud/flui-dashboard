import { Component, computed, input, output } from '@angular/core';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyFocus } from './topology-state';
import { percent, statusLabel, toneOf } from './topology-format';
import { kitTone, toneWord } from './topology-kit';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';

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
  imports: [FlPanel, FlTable, FlStatus, FlEmptyState],
  host: { class: 'fl-stack min-w-0' },
  template: `
    <p class="text-fl-body-sm text-fl-ink-muted">
      Select anything on the map to see what it runs and open its page.
    </p>
    @for (group of groups(); track group.title) {
      <fl-panel [title]="group.title" [count]="group.items.length" [flush]="true">
        @if (group.items.length) {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Detail</th>
                  <th scope="col" class="is-fit">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (item of group.items; track item.key) {
                  <tr>
                    <td class="whitespace-normal break-words">
                      <button
                        type="button"
                        class="fl-link text-left"
                        (click)="selected.emit(item.focus)"
                      >
                        {{ item.label }}
                      </button>
                    </td>
                    <td class="whitespace-normal break-words text-fl-ink-muted">
                      {{ item.detail }}
                    </td>
                    <td class="is-fit">
                      <fl-status [tone]="kit(item.tone)" [label]="word(item.tone)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <fl-empty-state [compact]="true" [title]="group.empty" />
        }
      </fl-panel>
    }
  `,
})
export class TopologyAttentionComponent {
  readonly snapshot = input<TopologyResponseDto | null>(null);
  readonly selected = output<TopologyFocus>();

  protected readonly kit = kitTone;
  protected readonly word = toneWord;

  protected readonly groups = computed(() => {
    const { needs, spread } = attentionOf(this.snapshot());
    return [
      { title: 'Needs attention', items: needs, empty: 'Nothing right now.' },
      {
        title: 'Spread across clusters',
        items: spread,
        empty: this.snapshot()?.apps.length
          ? 'Every app runs on one cluster.'
          : 'No app to place yet.',
      },
    ];
  });
}
