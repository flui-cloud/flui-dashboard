import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideClock,
  lucideCirclePlus,
  lucideTrash2,
} from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { IamService } from '../../service/iam.service';
import { AuditService } from '../../service/audit.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { CanDirective } from '../../../core/directives/can.directive';
import { GrantBuilderComponent } from './grant-builder.component';
import { AuditEventListComponent } from './audit-event-list.component';
import {
  AccessBinding,
  GrantRecord,
  PLATFORM_OPERATOR_ROLE,
  formatWhen,
  temporaryGrants,
  timeLeft,
} from '../../model/iam.model';
import { AuditEvent } from '../../model/audit.model';

interface ActivityState {
  loading: boolean;
  error: boolean;
  events: AuditEvent[];
}

@Component({
  selector: 'app-temporary-access-tab',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    CanDirective,
    GrantBuilderComponent,
    AuditEventListComponent,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideClock,
      lucideCirclePlus,
      lucideTrash2,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-5">
      @if (showBuilder()) {
        <app-grant-builder *fluiCan="'iam:assign-role'" [presetRole]="platformOperator" presetDuration="1d" />
      }

      <div hlmCard>
        <div hlmCardContent class="pt-6 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-foreground">Active ({{ split().active.length }})</h3>
            @if (split().active.length && !showBuilder()) {
              <button type="button" *fluiCan="'iam:assign-role'" (click)="showBuilder.set(true)"
                class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ng-icon name="lucideCirclePlus" class="h-3.5 w-3.5" />
                Give temporary access
              </button>
            }
          </div>

          @for (g of split().active; track g.id) {
            <ng-container *ngTemplateOutlet="row; context: { $implicit: g, ended: false }" />
          } @empty {
            <div class="py-6 text-center space-y-3" data-testid="temporary-empty">
              <p class="text-sm text-muted-foreground">Nobody has temporary access right now.</p>
              @if (!showBuilder()) {
                <button type="button" *fluiCan="'iam:assign-role'" (click)="showBuilder.set(true)"
                  class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <ng-icon name="lucideCirclePlus" class="h-4 w-4" />
                  Give temporary access
                </button>
              }
            </div>
          }
        </div>
      </div>

      @if (split().ended.length) {
        <div hlmCard>
          <div hlmCardContent class="pt-6 space-y-3">
            <button type="button" (click)="showEnded.set(!showEnded())"
              class="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ng-icon [name]="showEnded() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
              Ended ({{ split().ended.length }})
            </button>
            @if (showEnded()) {
              @for (g of split().ended; track g.id) {
                <ng-container *ngTemplateOutlet="row; context: { $implicit: g, ended: true }" />
              }
            }
          </div>
        </div>
      }
    </div>

    <ng-template #row let-g let-ended="ended">
      <div class="rounded-md border border-border/60" [class.opacity-60]="ended" data-testid="temporary-row">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
          @if (g.binding.principal.type === 'user') {
            <button type="button" (click)="toggle(g)" class="text-muted-foreground hover:text-foreground"
              [attr.aria-label]="'Recent activity of ' + iam.principalDisplay(g.binding.principal)">
              <ng-icon [name]="expanded().has(g.id) ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
            </button>
          } @else {
            <span class="w-4"></span>
          }
          <span class="font-medium text-foreground">{{ iam.principalDisplay(g.binding.principal) }}</span>
          <span hlmBadge variant="outline" class="text-xs">{{ iam.roleName(g.binding.role) }}</span>
          <span class="text-muted-foreground">{{ scopeText()(g.binding) }}</span>
          <span class="text-muted-foreground inline-flex items-center gap-1">
            <ng-icon name="lucideClock" class="h-3.5 w-3.5" />
            @if (ended) {
              ended {{ when(g.expiresAt) }}
            } @else {
              ends in {{ left(g.expiresAt) }} · {{ when(g.expiresAt) }}
            }
          </span>
          @if (g.grantedBy) {
            <span class="text-xs text-muted-foreground">granted by {{ g.grantedBy }}</span>
          }
          <span class="flex-1"></span>
          @if (!ended && iam.isRevocable(g.binding.role)) {
            <button type="button" *fluiCan="'iam:assign-role'" (click)="revoke.emit(g)"
              class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive">
              <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
              Revoke
            </button>
          }
        </div>
        @if (expanded().has(g.id)) {
          <div class="border-t border-border/60 px-3 py-2">
            @let state = activity()[g.id];
            @if (!state || state.loading) {
              <p class="text-xs text-muted-foreground py-2">Loading activity…</p>
            } @else if (state.error) {
              <p class="text-xs text-muted-foreground py-2">Activity could not be read.</p>
            } @else {
              <app-audit-event-list [events]="state.events" [showWho]="false" emptyText="No recorded activity." />
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class TemporaryAccessTabComponent {
  protected readonly iam = inject(IamService);
  private readonly audit = inject(AuditService);
  private readonly maskMode = inject(MaskModeService);

  readonly scopeText = input.required<(b: AccessBinding) => string>();
  readonly revoke = output<GrantRecord>();

  protected readonly platformOperator = PLATFORM_OPERATOR_ROLE;

  readonly showBuilder = signal(false);
  readonly showEnded = signal(false);
  readonly expanded = signal<Set<string>>(new Set());
  readonly activity = signal<Record<string, ActivityState>>({});

  readonly split = computed(() => temporaryGrants(this.iam.grants()));

  constructor() {
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.expanded.set(new Set());
      this.activity.set({});
    });
  }

  when(value: string | null | undefined): string {
    return value ? formatWhen(value) : '';
  }

  left(value: string | null | undefined): string {
    return value ? timeLeft(value) : '';
  }

  toggle(g: GrantRecord): void {
    const open = new Set(this.expanded());
    if (open.has(g.id)) {
      open.delete(g.id);
      this.expanded.set(open);
      return;
    }
    open.add(g.id);
    this.expanded.set(open);
    this.loadActivity(g);
  }

  private loadActivity(g: GrantRecord): void {
    const id = g.id;
    this.activity.update((a) => ({
      ...a,
      [id]: { loading: true, error: false, events: [] },
    }));
    this.audit.list({ email: g.binding.principal.ref, limit: 20 }).subscribe({
      next: (events) =>
        this.activity.update((a) => ({
          ...a,
          [id]: { loading: false, error: false, events },
        })),
      error: () =>
        this.activity.update((a) => ({
          ...a,
          [id]: { loading: false, error: true, events: [] },
        })),
    });
  }
}
