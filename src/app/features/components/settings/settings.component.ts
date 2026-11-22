import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import {
  SettingsSurfaceInput,
  SettingsSurfaceRevision,
  SettingsTabId,
  buildSettingsSurface,
  presentedContent,
} from './settings-surface';
import { ProfileTabComponent } from './profile-tab.component';
import { SecurityTabComponent } from './security-tab.component';
import { InfrastructureAuthProxyComponent } from '../infrastructure/infrastructure-auth-proxy.component';
import { InferenceConnectionsComponent } from './inference-connections.component';
import { AgentKeysComponent } from './agent-keys/agent-keys.component';
import { DemoSignInComponent } from './demo-sign-in.component';
import { DemoVisitorsComponent } from './demo-visitors.component';
import { InferenceUsageComponent } from './inference-usage.component';
import { PermissionService } from '../../../core/services/permission.service';
import { SandboxSignInService } from '../../service/sandbox-sign-in.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlTag } from '../../../ui/primitives/tag';

type SectionId =
  'profile' | 'security' | 'agent-keys' | 'auth-proxy' | 'inference-connections' | 'demo-sign-in';

interface SectionDef {
  id: SectionId;
  label: string;
  description: string;
  visible: () => boolean;
}

@Component({
  selector: 'app-settings',
  imports: [
    FlPageHeader,
    FlTag,
    ProfileTabComponent,
    SecurityTabComponent,
    InfrastructureAuthProxyComponent,
    InferenceConnectionsComponent,
    AgentKeysComponent,
    DemoSignInComponent,
    DemoVisitorsComponent,
    InferenceUsageComponent,
  ],
  template: `
    <div class="fl-page">
      <fl-page-header title="Settings">
        <ng-container headerMeta>
          <span>{{ _displayName() }}</span>
          @if (_email()) {
            <span class="fl-muted">{{ _email() }}</span>
          }
          <span class="fl-muted">{{
            _authMode() === 'oidc' ? 'Managed by the OIDC provider' : 'Local account'
          }}</span>
          @if (_isAdmin()) {
            <fl-tag>Admin</fl-tag>
          }
        </ng-container>
        <nav ngProjectAs="fl-tabs" class="fl-tabs" role="tablist" aria-label="Settings sections">
          @for (s of visibleSections(); track s.id) {
            <button
              type="button"
              role="tab"
              class="fl-tab"
              [id]="'settings-tab-' + s.id"
              aria-controls="settings-section"
              [attr.aria-selected]="activeSection() === s.id"
              (click)="select(s.id)"
            >
              {{ s.label }}
            </button>
          }
        </nav>
      </fl-page-header>

      <div
        id="settings-section"
        role="tabpanel"
        class="fl-stack min-w-0"
        [attr.aria-labelledby]="'settings-tab-' + activeSection()"
      >
        @if (activeDescription(); as description) {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ description }}</p>
        }
        @switch (activeSection()) {
          @case ('profile') {
            <app-profile-tab />
          }
          @case ('security') {
            <app-security-tab />
          }
          @case ('agent-keys') {
            <app-agent-keys />
          }
          @case ('auth-proxy') {
            <app-infrastructure-auth-proxy />
          }
          @case ('inference-connections') {
            <app-inference-connections />
            <app-inference-usage />
          }
          @case ('demo-sign-in') {
            <app-demo-sign-in />
            <app-demo-visitors />
          }
        }
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly inference = inject(InferenceSettingsService);
  private readonly perms = inject(PermissionService);
  private readonly signIn = inject(SandboxSignInService);

  private readonly demoInstall = signal(false);
  private demoAsked = false;
  private readonly requestedSection = signal<string | null>(null);

  readonly activeSection = signal<SectionId>('profile');

  protected readonly _authMode = computed(() => this.cfg.authMode);
  protected readonly _isAdmin = computed(() => this.authService.currentUser()?.isAdmin ?? false);

  private readonly sections: SectionDef[] = [
    {
      id: 'profile',
      label: 'Profile',
      description: 'Your account information.',
      visible: () => true,
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Manage your password and account security.',
      visible: () => this._authMode() === 'local',
    },
    {
      id: 'agent-keys',
      label: 'Agent keys',
      description:
        'Hand a coding agent a key of your own, see what each one can do, and take it back.',
      visible: () => true,
    },
    {
      id: 'auth-proxy',
      label: 'Auth proxy',
      description: 'Protect internal apps with OIDC-based access per cluster.',
      visible: () => this._isAdmin(),
    },
    {
      id: 'inference-connections',
      label: 'LLM connections',
      description: 'Bring your own API key to connect any OpenAI-compatible language model.',
      visible: () => true,
    },
    {
      id: 'demo-sign-in',
      label: 'Demo sign-in',
      description: "Let the demo's guests sign in with GitHub or Google.",
      visible: () => this.perms.can('sandbox:operate') && this.demoInstall(),
    },
  ];

  readonly visibleSections = computed(() => this.sections.filter((s) => s.visible()));

  protected readonly activeDescription = computed(
    () => this.sections.find((s) => s.id === this.activeSection())?.description ?? null,
  );

  private readonly surfaceRevision = new SettingsSurfaceRevision();

  readonly surface = computed(() => {
    const user = this.authService.currentUser();
    const input: SettingsSurfaceInput = {
      userId: user?.userId ?? null,
      displayName: this._displayName() || null,
      email: this._email() || null,
      isAdmin: this._isAdmin(),
      authMode: this._authMode(),
      activeTab: this.activeSection() as SettingsTabId,
      inferenceConnections: this.inference.connections().map((c) => ({
        id: c.id,
        label: c.label,
        baseUrl: c.baseUrl,
        modelsCount: c.models.length,
        isDefault: c.isDefault,
      })),
    };
    const content = presentedContent(input);
    if (!content) return null;
    return buildSettingsSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      if (!this.perms.can('sandbox:operate') || this.demoAsked) return;
      this.demoAsked = true;
      untracked(() =>
        this.signIn
          .list()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (view) => this.demoInstall.set(view.demo),
            error: () => this.demoInstall.set(false),
          }),
      );
    });

    effect(() => {
      const wanted = this.requestedSection();
      if (wanted && this.isVisibleSection(wanted)) {
        this.activeSection.set(wanted);
        this.requestedSection.set(null);
      }
    });

    effect(() => {
      const visible = this.visibleSections();
      if (!visible.some((s) => s.id === this.activeSection())) {
        this.activeSection.set(visible[0]?.id ?? 'profile');
      }
    });

    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  protected readonly _displayName = computed(() => {
    const u = this.authService.currentUser();
    return u?.name || u?.email || 'User';
  });

  protected readonly _email = computed(() => this.authService.currentUser()?.email ?? '');

  ngOnInit(): void {
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((fragment) => {
      this.requestedSection.set(fragment);
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
