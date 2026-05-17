import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideGithub,
  lucideCheck,
  lucideTriangleAlert,
  lucideLoader,
  lucideKey,
} from '@ng-icons/lucide';
import { GithubAppOAuthService } from '../../../core/services/github-app-oauth.service';
import { GhcrPatModalComponent } from './ghcr-pat-modal.component';

@Component({
  selector: 'app-github-installed',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, GhcrPatModalComponent],
  providers: [
    provideIcons({
      lucideGithub,
      lucideCheck,
      lucideTriangleAlert,
      lucideLoader,
      lucideKey,
    }),
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div class="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-8">
        <div class="w-16 h-16 mx-auto rounded-full bg-slate-900 dark:bg-slate-700 flex items-center justify-center mb-6">
          <ng-icon name="lucideGithub" size="32" class="text-white" />
        </div>

        @if (state() === 'error') {
          <div class="text-center">
            <div class="flex items-center justify-center gap-2 mb-3">
              <ng-icon name="lucideTriangleAlert" size="20" class="text-amber-600 dark:text-amber-400" />
              <h1 class="text-lg font-semibold text-slate-900 dark:text-white">Connection incomplete</h1>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">{{ errorLabel() }}</p>
            @if (errorDetails()) {
              <p class="text-xs text-slate-400 dark:text-slate-500 mb-6 font-mono">{{ errorDetails() }}</p>
            }
            <button
              (click)="goToRepositories()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
            >
              Return to dashboard
            </button>
          </div>
        } @else if (state() === 'pat-needed') {
          <div>
            <div class="flex items-center justify-center gap-2 mb-3">
              <ng-icon name="lucideCheck" size="20" class="text-green-600 dark:text-green-400" />
              <h1 class="text-lg font-semibold text-slate-900 dark:text-white">
                @if (login()) {
                  Connected as &#64;{{ login() }}
                } @else {
                  GitHub App connected
                }
              </h1>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              One more step: provide a classic Personal Access Token so Flui can pull
              the container images from your GHCR registry.
            </p>
            <button
              (click)="showModal.set(true)"
              class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <ng-icon name="lucideKey" size="16" />
              <span>Provide token</span>
            </button>
            <button
              (click)="goToRepositories()"
              class="w-full mt-3 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Skip for now (deploys won't be able to pull images)
            </button>
          </div>
        } @else if (state() === 'success') {
          <div class="text-center">
            <div class="flex items-center justify-center gap-2 mb-3">
              <ng-icon name="lucideCheck" size="20" class="text-green-600 dark:text-green-400" />
              <h1 class="text-lg font-semibold text-slate-900 dark:text-white">All set!</h1>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
              @if (login()) {
                Connected as <span class="font-medium text-slate-700 dark:text-slate-200">&#64;{{ login() }}</span>.
              }
              Redirecting you back to the dashboard…
            </p>
            <ng-icon name="lucideLoader" size="24" class="animate-spin text-slate-400 dark:text-slate-500 mx-auto" />
          </div>
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400 text-center">Finishing up…</p>
        }
      </div>
    </div>

    @if (showModal()) {
      <app-ghcr-pat-modal
        mode="create"
        (cancelled)="showModal.set(false)"
        (saved)="onPatSaved()"
      />
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
  
      if (status !== 'connected') {
        this.state.set('error');
        this.errorLabel.set('Unexpected response from GitHub.');
        return;
      }
  
      this.login.set(params.get('login'));
  
      try {
        const patStatus = await this.oauthApi.getPackagesPatStatus();
        if (patStatus.configured) {
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
