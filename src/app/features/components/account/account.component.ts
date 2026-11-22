import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AuthService } from '../../../core/services/auth.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';
import {
  AccountOverview,
  AccountProfile,
  AccountService,
  accountErrorMessage,
} from '../../service/account.service';
import { ProfileTabComponent } from '../settings/profile-tab.component';
import { SecurityTabComponent } from '../settings/security-tab.component';
import { AccountProfileComponent } from './account-profile.component';
import { AccountSecurityComponent } from './account-security.component';

@Component({
  selector: 'app-account',
  imports: [
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlLoadingState,
    ProfileTabComponent,
    SecurityTabComponent,
    AccountProfileComponent,
    AccountSecurityComponent,
  ],
  template: `
    <div class="fl-page">
      <fl-page-header title="Account">
        <span headerMeta>Your profile and how you sign in.</span>
      </fl-page-header>

      @if (visitor()) {
        <fl-alert tone="info" title="This demo is read-only" data-testid="visitor-note">
          <a [href]="installUrl" target="_blank" rel="noopener" class="fl-link">Install Flui</a>
          to have your own.
        </fl-alert>
      } @else if (local()) {
        <div class="fl-stack">
          <app-profile-tab />
          <app-security-tab />
        </div>
      } @else if (error()) {
        <fl-alert tone="error" title="Could not load your account" data-testid="account-error">{{
          error()
        }}</fl-alert>
      } @else if (overview(); as o) {
        <div class="fl-stack">
          <app-account-profile [profile]="o.profile" (changed)="profileChanged($event)" />
          <app-account-security [overview]="o" (changed)="load()" />
        </div>
      } @else {
        <fl-panel title="Profile">
          <fl-loading-state [rows]="4" />
        </fl-panel>
      }
    </div>
  `,
})
export class AccountComponent implements OnInit {
  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly sandbox = inject(SandboxService);
  protected readonly installUrl = INSTALL_FLUI_URL;
  private readonly destroyRef = inject(DestroyRef);

  readonly overview = signal<AccountOverview | null>(null);
  readonly error = signal<string | null>(null);
  protected readonly local = computed(() => this.cfg.authMode === 'local');
  protected readonly visitor = computed(() => this.sandbox.visitor());

  ngOnInit(): void {
    if (!this.local() && !this.visitor()) this.load();
  }

  load(): void {
    this.account
      .overview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (o) => {
          this.error.set(null);
          this.overview.set(o);
        },
        error: (err) =>
          this.error.set(accountErrorMessage(err, 'Your account could not be loaded.')),
      });
  }

  profileChanged(profile: AccountProfile): void {
    const o = this.overview();
    if (o) this.overview.set({ ...o, profile });
    this.auth.loadCurrentUser().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
