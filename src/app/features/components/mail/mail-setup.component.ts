import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { MailSectionNavComponent } from './mail-section-nav.component';
import { MailTestSendComponent } from './mail-test-send.component';
import { MailConsoleService } from '../../service/mail-console.service';
import { MailReadiness, MailReadinessStep } from '../../model/mail-console.models';
import { consoleError } from './mail-format';
import { stepLabel, stepStatus, stepTone } from './mail-readiness';

@Component({
  selector: 'app-mail-setup',
  imports: [
    FormsModule,
    RouterLink,
    FlAlert,
    FlPanel,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    MailSectionNavComponent,
    MailTestSendComponent,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideRefreshCw })],
  template: `
    <div class="fl-page">
      <app-mail-section-nav [toFix]="toFix()">
        <button
          headerActions
          flButton
          type="button"
          [iconOnly]="true"
          aria-label="Re-check"
          [disabled]="loading()"
          (click)="load()"
        >
          <fl-icon name="lucideRefreshCw" />
        </button>
      </app-mail-section-nav>

      <fl-panel title="Check readiness">
        <form class="flex flex-wrap items-end gap-3" (ngSubmit)="load()">
          <div class="fl-field min-w-72 flex-1">
            <label class="fl-field__label" for="mail-setup-domain">Domain (optional)</label>
            <div class="fl-input fl-input--lg">
              <input
                id="mail-setup-domain"
                name="domain"
                type="text"
                class="fl-mono"
                placeholder="mail.example.com"
                [(ngModel)]="domain"
              />
            </div>
            <span class="fl-field__hint">
              With no domain, this answers only whether the connected key covers Transactional Email
              at all, which is the first thing that goes wrong.
            </span>
          </div>
          <button flButton="primary" type="submit" [disabled]="loading()">Check</button>
        </form>
      </fl-panel>

      @if (loading()) {
        <fl-panel title="Readiness">
          <fl-loading-state [rows]="4" />
        </fl-panel>
      } @else if (error()) {
        <fl-alert tone="error" title="Could not check readiness">{{ error() }}</fl-alert>
      } @else if (readiness()) {
        @let r = readiness()!;
        <fl-panel title="Readiness" [count]="r.steps.length" [flush]="true">
          <fl-status
            panelActions
            [tone]="r.ready ? 'success' : 'warning'"
            [label]="r.ready ? readyLabel() : 'Not ready to send'"
          />
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Step</th>
                  <th scope="col">Status</th>
                  <th scope="col">What to do</th>
                </tr>
              </thead>
              <tbody>
                @for (step of r.steps; track step.id) {
                  <tr>
                    <td>{{ label(step) }}</td>
                    <td><fl-status [tone]="tone(step)" [label]="status(step)" /></td>
                    <td class="is-wrap">
                      <div class="flex flex-col gap-1">
                        @if (step.action) {
                          <span>{{ step.action }}</span>
                        } @else {
                          <span class="text-fl-ink-muted">Nothing</span>
                        }
                        @if (step.consoleUrl) {
                          <a
                            class="fl-link inline-flex items-center gap-1"
                            [href]="step.consoleUrl"
                            target="_blank"
                            rel="noopener"
                          >
                            Open the provider console
                            <fl-icon name="lucideExternalLink" [size]="13" />
                          </a>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </fl-panel>

        @if (r.ready && domain.trim()) {
          <fl-panel title="Prove it end to end">
            <app-mail-test-send [domain]="domain.trim()" />
          </fl-panel>
        }

        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Adding a sending domain and publishing its records happens on
          <a class="fl-link" routerLink="/management/mail/domains">Domains</a>.
        </p>
      }
    </div>
  `,
})
export class MailSetupComponent implements OnInit {
  private readonly api = inject(MailConsoleService);

  protected domain = '';
  protected readonly readiness = signal<MailReadiness | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly toFix = computed(
    () => this.readiness()?.steps.filter((s) => s.status === 'manual').length ?? 0,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.readiness(this.domain.trim() || undefined).subscribe({
      next: (readiness) => {
        this.readiness.set(readiness);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(consoleError(err));
        this.loading.set(false);
      },
    });
  }

  protected readyLabel(): string {
    const domain = this.domain.trim();
    return domain ? `Ready to send from ${domain}` : 'Ready to send';
  }

  protected label(step: MailReadinessStep): string {
    return stepLabel(step);
  }

  protected status(step: MailReadinessStep): string {
    return stepStatus(step);
  }

  protected tone(step: MailReadinessStep): ReturnType<typeof stepTone> {
    return stepTone(step);
  }
}
