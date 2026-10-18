import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUpRight, lucideX } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';
import { TopologyDestinations } from './topology-navigation';
import { TopologyFocus, TopologyViewState } from './topology-state';
import { describeFocus } from './topology-describe';
import { TopologyAttentionComponent } from './topology-attention.component';

@Component({
  selector: 'app-topology-inspector',
  standalone: true,
  imports: [RouterLink, NgIcon, HlmButtonDirective, TopologyAttentionComponent],
  providers: [provideIcons({ lucideArrowUpRight, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="card-surface flex h-full flex-col overflow-hidden" aria-label="Inspector">
      @if (view(); as v) {
        <header class="flex items-start justify-between gap-3 border-b border-border p-4">
          <div class="min-w-0">
            <p class="text-label">{{ v.kind }}</p>
            <h2 class="truncate text-base font-semibold text-foreground">{{ v.title }}</h2>
            @if (v.subtitle) {
              <p class="text-sub truncate">{{ v.subtitle }}</p>
            }
          </div>
          <button type="button" class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear selection" (click)="cleared.emit()">
            <ng-icon name="lucideX" class="h-4 w-4" />
          </button>
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          @if (v.status) {
            <p class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full" [class]="'dot-' + v.tone"></span>
              <span class="text-value">{{ v.status }}</span>
              @if (v.reason) {
                <span class="text-sub">· {{ v.reason }}</span>
              }
            </p>
          }

          @if (v.facts.length) {
            <dl class="grid grid-cols-2 gap-x-3 gap-y-2">
              @for (fact of v.facts; track fact.label) {
                <div>
                  <dt class="text-sub">{{ fact.label }}</dt>
                  <dd class="text-value">{{ fact.value }}</dd>
                </div>
              }
            </dl>
          }

          @for (section of v.sections; track section.title) {
            <section>
              <h3 class="text-label mb-2">{{ section.title }}</h3>
              <ul class="space-y-1">
                @for (row of section.rows; track row.key) {
                  <li>
                    <button type="button"
                            class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                            [disabled]="!row.focus" (click)="row.focus && selected.emit(row.focus)">
                      <span class="flex min-w-0 items-center gap-2">
                        @if (row.tone) {
                          <span class="h-1.5 w-1.5 flex-none rounded-full" [class]="'dot-' + row.tone"></span>
                        }
                        <span class="truncate text-foreground">{{ row.label }}</span>
                      </span>
                      <span class="text-sub flex-none">{{ row.detail }}</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        @if (destinations().open || destinations().quick.length || destinations().drills.length) {
          <footer class="space-y-2 border-t border-border p-4">
            @if (destinations().drills.length) {
              <div class="flex flex-wrap gap-2">
                @for (drill of destinations().drills; track drill.label) {
                  <button type="button" class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                          (click)="drilled.emit(drill.state)">{{ drill.label }}</button>
                }
              </div>
            }
            @if (destinations().open; as open) {
              <a hlmBtn class="w-full" [routerLink]="open.commands" [queryParams]="open.queryParams">
                {{ open.label }}
                <ng-icon name="lucideArrowUpRight" class="ml-1 h-4 w-4" />
              </a>
            }
            @if (destinations().quick.length) {
              <nav class="flex flex-wrap gap-x-3 gap-y-1" aria-label="Quick links">
                @for (link of destinations().quick; track link.label) {
                  <a class="card-link mt-0" [routerLink]="link.commands" [queryParams]="link.queryParams">{{ link.label }}</a>
                }
              </nav>
            }
          </footer>
        }
        @if (guest() && !destinations().open) {
          <p class="text-sub border-t border-border px-4 py-3">Example data. Install Flui to open these pages on your own fleet.</p>
        }
      } @else {
        <app-topology-attention class="flex-1 overflow-y-auto" [snapshot]="snapshot()" (selected)="selected.emit($event)" />
      }
    </aside>
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

  protected readonly view = computed(() => describeFocus(this.focus(), this.snapshot()));
}
