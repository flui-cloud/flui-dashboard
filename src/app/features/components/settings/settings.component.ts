import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUser,
  lucideShield,
  lucideShieldPlus,
  lucideNetwork,
} from '@ng-icons/lucide';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { ProfileTabComponent } from './profile-tab.component';
import { SecurityTabComponent } from './security-tab.component';
import { InfrastructureAuthProxyComponent } from '../infrastructure/infrastructure-auth-proxy.component';
import { InferenceConnectionsComponent } from './inference-connections.component';

type SectionId = 'profile' | 'security' | 'auth-proxy' | 'inference-connections';

interface SectionDef {
  id: SectionId;
  label: string;
  icon: string;
  visible: () => boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    ProfileTabComponent,
    SecurityTabComponent,
    InfrastructureAuthProxyComponent,
    InferenceConnectionsComponent,
  ],
  providers: [
    provideIcons({ lucideUser, lucideShield, lucideShieldPlus, lucideNetwork }),
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto space-y-6">

      <!-- User header card -->
      <div hlmCard>
        <div hlmCardContent class="pt-6">
          <div class="flex items-center gap-4">
            <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-muted border border-border text-xl font-bold text-muted-foreground select-none shrink-0">
              {{ _initials() }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-xl font-semibold text-foreground">{{ _displayName() }}</h2>
                @if (_isAdmin()) {
                  <span hlmBadge variant="default" class="text-xs">Admin</span>
                }
              </div>
              <p class="text-sm text-muted-foreground mt-0.5">{{ _email() }}</p>
              <p class="text-xs text-muted-foreground mt-1">
                {{ _authMode() === 'oidc' ? 'Managed via OIDC provider' : 'Local account' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="border-b border-border relative">
        <nav class="flex -mb-px gap-1 overflow-x-auto scrollbar-none pr-8">
          @for (s of visibleSections(); track s.id) {
            <button
              type="button"
              (click)="select(s.id)"
              [title]="s.label"
              class="inline-flex items-center gap-1.5 px-3 md:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
              [class]="activeSection() === s.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
            >
              <ng-icon [name]="s.icon" class="h-4 w-4 flex-shrink-0" />
              <span>{{ s.label }}</span>
            </button>
          }
        </nav>
        <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent"></div>
      </div>

      <!-- Active section -->
      <div class="min-w-0">
        @switch (activeSection()) {
          @case ('profile') {
            <section class="space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">Profile</h3>
                <p class="text-sm text-muted-foreground">Your account information.</p>
              </header>
              <app-profile-tab />
            </section>
          }
          @case ('security') {
            <section class="space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">Security</h3>
                <p class="text-sm text-muted-foreground">Manage your password and account security.</p>
              </header>
              <app-security-tab />
            </section>
          }
          @case ('auth-proxy') {
            <section class="space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">Auth Proxy</h3>
                <p class="text-sm text-muted-foreground">Protect internal apps with OIDC-based access per cluster.</p>
              </header>
              <app-infrastructure-auth-proxy />
            </section>
          }
          @case ('inference-connections') {
            <section class="space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">LLM Connections</h3>
                <p class="text-sm text-muted-foreground">Bring your own API key to connect any OpenAI-compatible language model.</p>
              </header>
              <app-inference-connections />
            </section>
          }
        }
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeSection = signal<SectionId>('profile');

  protected readonly _authMode = computed(() => this.cfg.authMode);
  protected readonly _isAdmin = computed(
    () => this.authService.currentUser()?.isAdmin ?? false,
  );

  private readonly sections: SectionDef[] = [
    { id: 'profile', label: 'Profile', icon: 'lucideUser', visible: () => true },
    {
      id: 'security',
      label: 'Security',
      icon: 'lucideShield',
      visible: () => this._authMode() === 'local',
    },
    {
      id: 'auth-proxy',
      label: 'Auth Proxy',
      icon: 'lucideShieldPlus',
      visible: () => this._isAdmin(),
    },
    {
      id: 'inference-connections',
      label: 'LLM Connections',
      icon: 'lucideNetwork',
      visible: () => true,
    },
  ];

  readonly visibleSections = computed(() =>
    this.sections.filter((s) => s.visible()),
  );

  constructor() {
    effect(() => {
      const visible = this.visibleSections();
      if (!visible.some((s) => s.id === this.activeSection())) {
        this.activeSection.set(visible[0]?.id ?? 'profile');
      }
    });
  }

  protected readonly _displayName = computed(() => {
    const u = this.authService.currentUser();
    return u?.name || u?.email || 'User';
  });

  protected readonly _email = computed(
    () => this.authService.currentUser()?.email ?? '',
  );

  protected readonly _initials = computed(() => {
    const u = this.authService.currentUser();
    const src = u?.name || u?.email || '';
    return src
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join('');
  });

  ngOnInit(): void {
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        if (fragment && this.isVisibleSection(fragment)) {
          this.activeSection.set(fragment);
        }
      });
  }

  select(id: SectionId): void {
    this.activeSection.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: id,
      replaceUrl: true,
    });
  }

  private isVisibleSection(value: string): value is SectionId {
    return this.visibleSections().some((s) => s.id === value);
  }
}
