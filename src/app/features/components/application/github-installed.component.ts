import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { GhcrPatModalComponent } from './ghcr-pat-modal.component';

@Component({
  selector: 'app-github-installed',
  imports: [FlPanel, FlAlert, FlButton, FlSpinner, FlStatus, GhcrPatModalComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-fl-surface-subtle p-4">
      <fl-panel class="w-full max-w-md" title="GitHub connection">
        <ng-container panelActions>
          @switch (state()) {
            @case ('error') {
              <fl-status tone="error" label="Incomplete" />
            }
            @case ('pat-needed') {
              <fl-status tone="warning" label="Token needed" />
            }
            @case ('success') {
              <fl-status tone="success" label="Connected" />
            }
            @default {
              <fl-status tone="progress" label="Finishing" />
            }
          }
        </ng-container>

        @if (state() === 'error') {
          <div class="flex flex-col gap-4">
            <fl-alert tone="error" title="Connection incomplete">
              {{ errorLabel() }}
              @if (errorDetails()) {
                <span class="fl-mono mt-1 block">{{ errorDetails() }}</span>
              }
            </fl-alert>
            <div>
              <button flButton="primary" type="button" (click)="goToRepositories()">
                Return to dashboard
              </button>
            </div>
          </div>
        } @else if (state() === 'pat-needed') {
          <div class="flex flex-col gap-4">
            <p class="font-medium">
              @if (login()) {
                Connected as &#64;{{ login() }}
              } @else {
                GitHub App connected
              }
            </p>
            <p class="text-fl-ink-secondary">
              One more step: provide a classic personal access token so Flui can pull the container
              images from your GHCR registry.
            </p>
            <div class="fl-row">
              <button flButton="primary" type="button" (click)="showModal.set(true)">
                Provide token
              </button>
              <button flButton="ghost" type="button" (click)="goToRepositories()">
                Skip for now
              </button>
            </div>
            <p class="text-fl-caption text-fl-ink-muted">
              Until the token is set, deploys cannot pull images.
            </p>
          </div>
        } @else if (state() === 'success') {
          <div class="flex flex-col gap-3">
            <p class="font-medium">All set</p>
            <p class="text-fl-ink-secondary">
              @if (login()) {
                Connected as <span class="fl-mono">&#64;{{ login() }}</span
                >.
              }
              Redirecting you back to the dashboard…
            </p>
            <fl-spinner label="Redirecting" />
          </div>
        } @else {
          <p class="text-fl-ink-secondary">Finishing up…</p>
        }
      </fl-panel>
    </div>

    @if (showModal()) {
      <app-ghcr-pat-modal mode="create" (cancelled)="showModal.set(false)" (saved)="onPatSaved()" />
    }
  `,
})
export class GithubInstalledComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly oauthApi = inject(GithubAppOAuthService);

  readonly state = signal<'pending' | 'pat-needed' | 'success' | 'error'>('pending');
  readonly login = signal<string | null>(null);
  readonly errorLabel = signal<string>('We could not complete the GitHub connection.');
  readonly errorDetails = signal<string | null>(null);
  readonly showModal = signal(false);

  ngOnInit(): void {
    void (async () => {
      const params = this.route.snapshot.queryParamMap;
      const status = params.get('status');
      const error = params.get('error');

      if (error) {
        this.state.set('error');
        this.errorLabel.set(this.friendlyError(error));
        const msg = params.get('msg');
        if (msg) this.errorDetails.set(decodeURIComponent(msg));
        return;
      }

      const claim = params.get('claim');
      if (claim) {
        try {
          const connected = await this.oauthApi.claim(claim);
          this.login.set(connected.login);
        } catch (err: unknown) {
          this.state.set('error');
          this.errorLabel.set(this.claimError(err));
          return;
        }
      } else if (status === 'connected') {
        this.login.set(params.get('login'));
      } else {
        this.state.set('error');
        this.errorLabel.set('Unexpected response from GitHub.');
        return;
      }

      try {
        const patStatus = await this.oauthApi.getPackagesPatStatus();
        if (patStatus.configured || patStatus.needed === false) {
          this.state.set('success');
          setTimeout(() => this.goToRepositories(), 2000);
        } else {
          this.state.set('pat-needed');
          this.showModal.set(true);
        }
      } catch {
        this.state.set('pat-needed');
        this.showModal.set(true);
      }
    })();
  }

  onPatSaved(): void {
    this.showModal.set(false);
    this.state.set('success');
    setTimeout(() => this.goToRepositories(), 1500);
  }

  goToRepositories(): void {
    this.router.navigate(['/apps/repositories']);
  }

  private claimError(err: unknown): string {
    const status = (err as { status?: number })?.status;
    if (status === 403)
      return 'This GitHub link was started from another account. Start the connection again from your own.';
    if (status === 400)
      return 'The connection expired or was already finished. Please start it again.';
    return 'We could not complete the GitHub connection.';
  }

  private friendlyError(code: string): string {
    switch (code) {
      case 'expired_state':
        return 'The installation link expired. Please start the connection again.';
      case 'missing_state':
        return 'The install flow was started outside of Flui. Please retry from the dashboard.';
      case 'no_code':
        return 'The GitHub App was installed but the authorization step was skipped.';
      case 'exchange_failed':
        return 'GitHub rejected the authorization exchange. Please retry.';
      default:
        return 'We could not complete the GitHub connection.';
    }
  }
}
