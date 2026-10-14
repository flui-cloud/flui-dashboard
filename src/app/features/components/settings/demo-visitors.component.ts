import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmCardContentDirective, HlmCardDirective } from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { SandboxSignInService, VisitorStats } from '../../service/sandbox-sign-in.service';

const REASON_LABELS: Record<string, string> = {
  'limit-ip': 'Per-address limit',
  'limit-cli': 'Command line limit',
  'limit-global': 'Too many at once',
  'limit-day': 'Daily limit',
  challenge: 'Browser check failed',
  closed: 'Entrance closed',
  'no-admission': 'No admission',
  invalid: 'Invalid request',
  error: 'Error',
};

export function refusalLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

@Component({
  selector: 'app-demo-visitors',
  host: { class: 'block' },
  standalone: true,
  imports: [HlmCardDirective, HlmCardContentDirective, HlmBadgeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stats(); as s) {
      <div hlmCard data-testid="demo-visitors">
        <div hlmCardContent class="pt-5 space-y-3">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium">Visitors</h4>
            @if (s.entranceOpen) {
              <span hlmBadge variant="default" class="text-xs" data-testid="entrance">Entrance open</span>
            } @else {
              <span hlmBadge variant="secondary" class="text-xs" data-testid="entrance">Entrance closed</span>
            }
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            @for (t of tiles(); track t.label) {
              <div class="rounded-md border border-border p-3" [attr.data-tile]="t.label">
                <p class="text-xs text-muted-foreground">{{ t.label }}</p>
                <p class="text-lg font-semibold tabular-nums">{{ t.value }}</p>
              </div>
            }
          </div>
          @if (reasons().length) {
            <p class="text-xs text-muted-foreground" data-testid="refused-reasons">
              Refused:
              @for (r of reasons(); track r.reason; let last = $last) {
                {{ r.label }} {{ r.count }}{{ last ? '' : ', ' }}
              }
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class DemoVisitorsComponent implements OnInit {
  private readonly signIn = inject(SandboxSignInService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<VisitorStats | null>(null);

  protected readonly tiles = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Visitors now', value: `${s.visitorsNow}` },
      { label: 'Ready ahead of time', value: `${s.poolReady} / ${s.poolMin}` },
      { label: 'New in 24 h', value: `${s.last24h.created}` },
      { label: 'Refused in 24 h', value: `${s.last24h.refused}` },
      { label: 'Became accounts', value: `${s.upgraded}` },
      { label: 'Added to accounts', value: `${s.merged}` },
    ];
  });

  protected readonly reasons = computed(() =>
    (this.stats()?.last24h.refusedByReason ?? [])
      .filter((r) => r.count > 0)
      .map((r) => ({ reason: r.reason, label: refusalLabel(r.reason), count: r.count })),
  );

  ngOnInit(): void {
    this.signIn
      .visitorStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.stats.set(s),
        error: () => this.stats.set(null),
      });
  }
}
