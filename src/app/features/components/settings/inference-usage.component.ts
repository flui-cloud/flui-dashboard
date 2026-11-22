import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PermissionService } from '../../../core/services/permission.service';
import {
  InferenceSettingsService,
  InferenceUsage,
  UsageKind,
} from '../../service/inference-settings.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';

const KINDS: ReadonlyArray<{ kind: UsageKind; label: string }> = [
  { kind: 'visitor', label: 'Visitors' },
  { kind: 'guest', label: 'Guests' },
  { kind: 'person', label: 'People' },
  { kind: 'platform', label: 'Platform' },
];

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

@Component({
  selector: 'app-inference-usage',
  host: { class: 'fl-stack' },
  imports: [FlPanel, FlTable],
  template: `
    @if (rows(); as list) {
      <fl-panel title="Usage in the last 7 days" [flush]="true" data-testid="inference-usage">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Who</th>
                <th scope="col" class="is-num">Tokens</th>
                <th scope="col" class="is-num">Calls</th>
              </tr>
            </thead>
            <tbody>
              @for (r of list; track r.kind) {
                <tr [attr.data-kind]="r.kind">
                  <td>{{ r.label }}</td>
                  <td class="is-num">{{ r.tokens }}</td>
                  <td class="is-num">{{ r.calls }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
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
