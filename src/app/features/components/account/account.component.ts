import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShield, lucideUser } from '@ng-icons/lucide';
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

type Tab = 'profile' | 'security';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    NgIcon,
    ProfileTabComponent,
    SecurityTabComponent,
    AccountProfileComponent,
    AccountSecurityComponent,
  ],
  providers: [provideIcons({ lucideUser, lucideShield })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl mx-auto space-y-6">
      <h2 class="text-xl font-semibold text-foreground">Account</h2>

      @if (visitor()) {
        <p class="text-sm text-muted-foreground" data-testid="visitor-note">
          This demo is read-only.
          <a [href]="installUrl" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">Install Flui</a>
          to have your own.
        </p>
      } @else {
        <nav class="flex gap-1 border-b border-border">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              (click)="tab.set(t.id)"
              class="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
              [class]="tab() === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'"
              [attr.data-tab]="t.id"
            >
              <ng-icon [name]="t.icon" class="h-4 w-4" />
              {{ t.label }}
            </button>
          }
        </nav>

        @if (local()) {
          @if (tab() === 'profile') { <app-profile-tab /> } @else { <app-security-tab /> }
        } @else if (error()) {
          <p class="text-sm text-destructive" data-testid="account-error">{{ error() }}</p>
        } @else if (overview(); as o) {
          @if (tab() === 'profile') {
            <app-account-profile [profile]="o.profile" (changed)="profileChanged($event)" />
          } @else {
            <app-account-security [overview]="o" (changed)="load()" />
          }
        } @else {
          <p class="text-sm text-muted-foreground">Loading...</p>
        }
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

  protected readonly tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'profile', label: 'Profile', icon: 'lucideUser' },
    { id: 'security', label: 'Security', icon: 'lucideShield' },
  ];

  readonly tab = signal<Tab>('profile');
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
