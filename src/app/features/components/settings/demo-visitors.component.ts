import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SandboxSignInService, VisitorStats } from '../../service/sandbox-sign-in.service';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';

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
  host: { class: 'fl-stack' },
  imports: [FlKeyValue, FlKvItem, FlPanel, FlStatus],
  template: `
    @if (stats(); as s) {
      <fl-panel title="Visitors" data-testid="demo-visitors">
        <fl-status
          panelActions
          data-testid="entrance"
          [tone]="s.entranceOpen ? 'success' : 'neutral'"
          [label]="s.entranceOpen ? 'Entrance open' : 'Entrance closed'"
        />
        <div class="flex flex-col gap-3">
          <fl-key-value class="fl-kv--compact">
            @for (t of tiles(); track t.label) {
              <fl-kv-item [attr.data-tile]="t.label" [key]="t.label">{{ t.value }}</fl-kv-item>
            }
          </fl-key-value>
          @if (reasons().length) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="refused-reasons">
              Refused:
              @for (r of reasons(); track r.reason; let last = $last) {
                {{ r.label }} {{ r.count }}{{ last ? '' : ', ' }}
              }
            </p>
          }
        </div>
      </fl-panel>
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
