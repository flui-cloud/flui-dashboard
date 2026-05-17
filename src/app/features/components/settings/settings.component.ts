import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUser,
  lucideShield,
  lucideShieldPlus,
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

type SectionId = 'profile' | 'security' | 'auth-proxy';

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
    RouterLink,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    ProfileTabComponent,
    SecurityTabComponent,
    InfrastructureAuthProxyComponent,
  ],
  providers: [
    provideIcons({ lucideUser, lucideShield, lucideShieldPlus }),
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">

        <!-- Anchor nav (sticky) -->
        <aside class="lg:sticky lg:top-6 self-start">
          <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            @for (s of visibleSections(); track s.id) {
              <a
                [routerLink]="[]"
                [fragment]="s.id"
                (click)="onAnchorClick($event, s.id)"
                class="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap"
                [class.bg-muted]="activeSection() === s.id"
                [class.text-foreground]="activeSection() === s.id"
                [class.font-medium]="activeSection() === s.id"
                [class.text-muted-foreground]="activeSection() !== s.id"
                [class.hover:bg-muted]="activeSection() !== s.id"
                [class.hover:text-foreground]="activeSection() !== s.id"
              >
                <ng-icon [name]="s.icon" class="h-4 w-4" />
                {{ s.label }}
              </a>
            }
          </nav>
        </aside>

        <!-- Content sections -->
        <div class="space-y-10 min-w-0">

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

          <section #section id="profile" data-section="profile" class="scroll-mt-6 space-y-3">
            <header>
              <h3 class="text-lg font-semibold text-foreground">Profile</h3>
              <p class="text-sm text-muted-foreground">Your account information.</p>
            </header>
            <app-profile-tab />
          </section>

          @if (_authMode() === 'local') {
            <section #section id="security" data-section="security" class="scroll-mt-6 space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">Security</h3>
                <p class="text-sm text-muted-foreground">Manage your password and account security.</p>
              </header>
              <app-security-tab />
            </section>
          }

          @if (_isAdmin()) {
            <section #section id="auth-proxy" data-section="auth-proxy" class="scroll-mt-6 space-y-3">
              <header>
                <h3 class="text-lg font-semibold text-foreground">Auth Proxy</h3>
                <p class="text-sm text-muted-foreground">Protect internal apps with OIDC-based access per cluster.</p>
              </header>
              <app-infrastructure-auth-proxy />
            </section>
          }

        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly sectionEls = viewChildren<ElementRef<HTMLElement>>('section');
  private observer: IntersectionObserver | null = null;

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
  ];

  readonly visibleSections = computed(() =>
    this.sections.filter((s) => s.visible()),
  );

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
        if (!fragment) return;
        if (this.isSectionId(fragment)) {
          this.activeSection.set(fragment);
          queueMicrotask(() => this.scrollTo(fragment));
        }
      });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset['section'];
          if (id && this.isSectionId(id)) {
            this.activeSection.set(id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const ref of this.sectionEls()) {
      this.observer.observe(ref.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  onAnchorClick(event: MouseEvent, id: SectionId): void {
    event.preventDefault();
    this.activeSection.set(id);
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: id,
      replaceUrl: true,
    });
    this.scrollTo(id);
  }

  private scrollTo(id: SectionId): void {
    const el = this.sectionEls().find(
      (ref) => ref.nativeElement.id === id,
    )?.nativeElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private isSectionId(value: string): value is SectionId {
    return value === 'profile' || value === 'security' || value === 'auth-proxy';
  }
}
