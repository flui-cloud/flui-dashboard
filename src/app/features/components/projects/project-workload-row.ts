import { Component, computed, input, output } from '@angular/core';
import { Application } from '../../model/application.models';
import { statusToneOf } from '../dashboard/home-state';
import { FlStatus } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { WorkloadRow } from './project-workloads-sections';

const ROW_ACTIONS: readonly MenuAction[] = [
  { id: 'open', label: 'Open' },
  { id: 'delete', label: 'Delete workload', danger: true, separatorBefore: true },
];

@Component({
  selector: 'tr[app-project-workload-row]',
  imports: [FlStatus, FlTag, FlActionsMenu],
  host: { '[attr.data-testid]': "'project-workload-' + item().row.id" },
  template: `
    @let r = item().row;
    <td class="whitespace-normal">
      <div class="fl-cell-name flex flex-col gap-0.5">
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" class="fl-link text-left" (click)="open.emit(r.id)">
            {{ r.name }}
          </button>
          @if (r.bundle) {
            <fl-tag>{{ r.bundle }}</fl-tag>
          }
        </div>
        <span class="fl-mono truncate text-fl-ink-muted" [title]="r.subtitle.text">{{
          r.subtitle.text
        }}</span>
      </div>
    </td>
    <td><fl-status [tone]="tone()" [label]="r.statusLabel" /></td>
    <td>{{ item().kind }}</td>
    <td>
      <span class="fl-cell-clip" [title]="r.cluster.name">{{ r.cluster.name || '—' }}</span>
    </td>
    <td class="is-num" [title]="r.ready.title">{{ r.ready.text }}</td>
    <td class="is-num" [title]="r.released.title">{{ r.released.text }}</td>
    <td class="is-fit">
      <fl-actions-menu
        [label]="'Actions for ' + r.name"
        [compact]="true"
        [items]="actions()"
        (action)="act($event)"
      />
    </td>
  `,
})
export class ProjectWorkloadRowComponent {
  readonly item = input.required<WorkloadRow>();
  readonly open = output<string>();
  readonly delete = output<Application>();

  protected readonly tone = computed(() => statusToneOf(this.item().row.tone));
  protected readonly actions = computed(() =>
    this.item().target ? ROW_ACTIONS : ROW_ACTIONS.slice(0, 1),
  );

  protected act(id: string): void {
    const target = this.item().target;
    if (id === 'delete' && target) this.delete.emit(target);
    else if (id === 'open') this.open.emit(this.item().row.id);
  }
}
