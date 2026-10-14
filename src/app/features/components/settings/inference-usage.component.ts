import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmCardContentDirective, HlmCardDirective } from '@spartan-ng/ui-card-helm';
import { PermissionService } from '../../../core/services/permission.service';
import {
  InferenceSettingsService,
  InferenceUsage,
  UsageKind,
} from '../../service/inference-settings.service';

const KINDS: ReadonlyArray<{ kind: UsageKind; label: string }> = [
  { kind: 'visitor', label: 'Visitors' },
  { kind: 'guest', label: 'Guests' },
  { kind: 'person', label: 'People' },
  { kind: 'platform', label: 'Platform' },
];

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

@Component({
  selector: 'app-inference-usage',
  host: { class: 'block' },
  standalone: true,
  imports: [HlmCardDirective, HlmCardContentDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows(); as list) {
      <div hlmCard data-testid="inference-usage">
        <div hlmCardContent class="pt-5 space-y-3">
          <h4 class="text-sm font-medium">Usage (last 7 days)</h4>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted-foreground border-b border-border">
                <th class="py-1.5 pr-4 font-medium">Who</th>
                <th class="py-1.5 pr-4 font-medium text-right">Tokens</th>
                <th class="py-1.5 font-medium text-right">Calls</th>
              </tr>
            </thead>
            <tbody>
              @for (r of list; track r.kind) {
                <tr class="border-b border-border/60 last:border-0" [attr.data-kind]="r.kind">
                  <td class="py-1.5 pr-4">{{ r.label }}</td>
                  <td class="py-1.5 pr-4 text-right tabular-nums">{{ r.tokens }}</td>
                  <td class="py-1.5 text-right tabular-nums">{{ r.calls }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class InferenceUsageComponent {
  private readonly perms = inject(PermissionService);
  private readonly inference = inject(InferenceSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly usage = signal<InferenceUsage | null>(null);
  private asked = false;

  protected readonly rows = computed(() => {
    const u = this.usage();
    if (!u) return null;
    return KINDS.map(({ kind, label }) => {
      const k = u.byKind?.find((x) => x.kind === kind);
      return {
        kind,
        label,
        tokens: COMPACT.format(k?.tokens ?? 0),
        calls: COMPACT.format(k?.calls ?? 0),
      };
    });
  });

  constructor() {
    effect(() => {
      const allowed = this.perms.isAdmin() || this.perms.can('integration:manage');
      if (!allowed || this.asked) return;
      this.asked = true;
      untracked(() =>
        this.inference
          .usage(7)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (u) => this.usage.set(u),
            error: () => this.usage.set(null),
          }),
      );
    });
  }
}
