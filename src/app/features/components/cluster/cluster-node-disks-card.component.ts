import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideHardDrive } from '@ng-icons/lucide';
import {
  DiskSpace,
  NodeDisksService,
  NodeDisksView,
} from '../../service/node-disks.service';

@Component({
  selector: 'app-cluster-node-disks-card',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideHardDrive })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div class="card-inner p-4" data-testid="node-disks-card">
        <span class="flex items-center gap-2">
          <ng-icon
            name="lucideHardDrive"
            class="h-4 w-4 text-slate-600 dark:text-slate-400"
          />
          <span class="text-label">Space on the nodes</span>
        </span>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="border-b border-border text-left text-muted-foreground"
              >
                <th class="py-2 font-normal">Node</th>
                <th class="py-2 font-normal">Location</th>
                <th class="py-2 font-normal">Disk</th>
                <th class="py-2 font-normal">Copies of replicated volumes</th>
              </tr>
            </thead>
            <tbody>
              @for (n of v.nodes; track n.node) {
                <tr class="border-b border-border/50 last:border-0">
                  <td class="py-2 font-mono text-xs">{{ n.node }}</td>
                  <td class="py-2 text-xs text-muted-foreground">
                    {{ n.zone ?? '—' }}
                  </td>
                  <td class="py-2 text-xs" [class]="tone(n.disk, 3)">
                    {{ label(n.disk) }}
                  </td>
                  <td class="py-2 text-xs" [class]="tone(n.copies, 2)">
                    {{ label(n.copies) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @for (w of v.warnings; track w) {
          <p class="m-0 mt-2 text-xs text-amber-700 dark:text-amber-400">
            {{ w }}
          </p>
        }
      </div>
    }
  `,
})
export class ClusterNodeDisksCardComponent {
  private readonly disks = inject(NodeDisksService);

  readonly clusterId = input.required<string | null>();
  readonly view = signal<NodeDisksView | null>(null);

  label(s: DiskSpace | null): string {
    return s ? `${s.freeGiB} of ${s.totalGiB} GiB free` : '—';
  }

  /** The same threshold the API warns at: under 15% or a few GiB free. */
  tone(s: DiskSpace | null, floorGiB: number): string {
    if (!s) return 'text-muted-foreground';
    return s.freeGiB < floorGiB || s.freeGiB < s.totalGiB * 0.15
      ? 'text-amber-700 dark:text-amber-400'
      : '';
  }

  constructor() {
    effect(() => {
      const id = this.clusterId();
      if (!id) return;
      this.disks.get(id).subscribe({
        next: (v) => this.view.set(v),
        error: () => this.view.set(null),
      });
    });
  }
}
