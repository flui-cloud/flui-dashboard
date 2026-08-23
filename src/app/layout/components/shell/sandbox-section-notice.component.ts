import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { SandboxLevelNoticeComponent } from '../../../shared/components/sandbox-level-notice.component';
import {
  SandboxService,
  sandboxAreaForUrl,
} from '../../../core/services/sandbox.service';

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

  protected readonly area = computed(() =>
    this.sandbox.inSandbox() ? sandboxAreaForUrl(this.url()) : null,
  );
}
