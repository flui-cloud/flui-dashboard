import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideArrowUpRight, lucideX } from '@ng-icons/lucide';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { FlAlert, AlertTone } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { TopologyDestinations } from './topology-navigation';
import { TopologyFocus, TopologyViewState } from './topology-state';
import { describeFocus } from './topology-describe';
import { TopologyAttentionComponent } from './topology-attention.component';
import { kitTone, toneWord } from './topology-kit';

const MONO_FACTS = new Set(['Type', 'Delivered to']);

@Component({
  selector: 'app-topology-inspector',
  imports: [
    RouterLink,
    FlAlert,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    TopologyAttentionComponent,
  ],
  providers: [provideIcons({ lucideArrowUpRight, lucideX })],
  host: { class: 'block min-w-0 max-h-full overflow-y-auto' },
  template: `
    @if (view(); as v) {
      <fl-panel [monoTitle]="true" [title]="v.title" aria-label="Inspector">
        <ng-container panelActions>
          @if (v.status) {
            <fl-status [tone]="kit(v.tone)" [label]="v.status" />
          }
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Clear selection"
            (click)="cleared.emit()"
          >
            <fl-icon name="lucideX" [size]="16" />
          </button>
        </ng-container>

        <div class="fl-stack min-w-0">
          <p class="text-fl-body-sm text-fl-ink-muted break-words">
            {{ v.kind }}
            @if (v.subtitle) {
              · {{ v.subtitle }}
            }
          </p>

          @if (v.reason) {
            <fl-alert [tone]="alertTone(v.tone)" [title]="v.status ?? 'Status'">
              {{ v.reason }}
            </fl-alert>
          }

          <fl-key-value class="fl-kv--compact">
            @for (fact of v.facts; track fact.label) {
              <fl-kv-item [key]="fact.label" [mono]="isMono(fact.label)">{{
                fact.value
              }}</fl-kv-item>
            }
            @if (focus(); as f) {
              <fl-kv-item key="ID">
                <fl-copy-id [value]="f.id" label="ID" />
              </fl-kv-item>
            }
          </fl-key-value>

          @for (section of v.sections; track section.title) {
            <section class="min-w-0">
              <h3 class="mb-2 text-fl-body-sm font-semibold text-fl-ink">{{ section.title }}</h3>
              <div class="fl-table-wrap">
                <table flTable density="dense">
                  <tbody>
                    @for (row of section.rows; track row.key) {
                      <tr>
                        <td class="whitespace-normal break-words">
                          @if (row.focus; as target) {
                            <button
                              type="button"
                              class="fl-link text-left"
                              (click)="selected.emit(target)"
                            >
                              {{ row.label }}
                            </button>
                          } @else {
                            {{ row.label }}
                          }
                        </td>
                        <td class="whitespace-normal break-words text-fl-ink-muted">
                          {{ row.detail }}
                        </td>
                        @if (row.tone) {
                          <td class="is-fit">
                            <fl-status [tone]="kit(row.tone)" [label]="word(row.tone)" />
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }

          @if (destinations().drills.length) {
            <div class="flex flex-wrap gap-2">
              @for (drill of destinations().drills; track drill.label) {
                <button flButton size="sm" type="button" (click)="drilled.emit(drill.state)">
                  {{ drill.label }}
                </button>
              }
            </div>
          }
          @if (destinations().open; as open) {
            <a
              flButton
              size="sm"
              [block]="true"
              [routerLink]="open.commands"
              [queryParams]="open.queryParams"
            >
              {{ open.label }}
              <fl-icon name="lucideArrowUpRight" [size]="14" />
            </a>
          }
          @if (destinations().quick.length) {
            <nav class="flex flex-wrap gap-x-3 gap-y-1" aria-label="Quick links">
              @for (link of destinations().quick; track link.label) {
                <a class="fl-link" [routerLink]="link.commands" [queryParams]="link.queryParams">{{
                  link.label
                }}</a>
              }
            </nav>
          }
          @if (guest() && !destinations().open) {
            <fl-alert tone="info" title="Example data">
              Install Flui to open these pages on your own fleet.
            </fl-alert>
          }
        </div>
      </fl-panel>
    } @else {
      <app-topology-attention [snapshot]="snapshot()" (selected)="selected.emit($event)" />
    }
  `,
})
export class TopologyInspectorComponent {
  readonly snapshot = input<TopologyResponseDto | null>(null);
  readonly focus = input<TopologyFocus | null>(null);
  readonly destinations = input<TopologyDestinations>({ open: null, quick: [], drills: [] });
  readonly guest = input(false);
  readonly selected = output<TopologyFocus>();
  readonly cleared = output<void>();
  readonly drilled = output<Partial<TopologyViewState>>();

  protected readonly kit = kitTone;
  protected readonly word = toneWord;
  protected readonly view = computed(() => describeFocus(this.focus(), this.snapshot()));

  protected isMono(label: string): boolean {
    return MONO_FACTS.has(label);
  }

  protected alertTone(tone: string | undefined): AlertTone {
    if (tone === 'error') return 'error';
    return tone === 'degraded' ? 'warning' : 'info';
  }
}
