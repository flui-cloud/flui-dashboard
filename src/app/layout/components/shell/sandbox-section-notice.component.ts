import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { SandboxLevelNoticeComponent } from '../../../shared/components/sandbox-level-notice.component';
import { SandboxService } from '../../../core/services/sandbox.service';

const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['/infrastructure/compute', 'providers'],
  ['/infrastructure/vnet', 'providers'],
  ['/infrastructure/firewall', 'firewall'],
  ['/infrastructure/domains', 'dns-zones'],
  ['/infrastructure/keys', 'keys'],
  ['/management/providers', 'providers'],
  ['/management/backup', 'backups'],
  ['/management/access', 'access'],
  ['/management/migrations', 'migrations'],
  ['/management/mail', 'mail'],
  ['/mail', 'mail'],
  ['/cluster', 'cluster'],
];

@Component({
  selector: 'app-sandbox-section-notice',
  standalone: true,
  imports: [SandboxLevelNoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (area(); as key) {
      <div class="px-2 pt-2">
        <app-sandbox-level-notice [area]="key" />
      </div>
    }
  `,
})
export class SandboxSectionNoticeComponent {
  private readonly router = inject(Router);
  private readonly sandbox = inject(SandboxService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly area = computed(() => {
    if (!this.sandbox.inSandbox()) return null;
    const url = this.url();
    const match = SECTIONS.filter(([prefix]) => url.startsWith(prefix)).sort(
      (a, b) => b[0].length - a[0].length,
    )[0];
    return match ? match[1] : null;
  });
}
