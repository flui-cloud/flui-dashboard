import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideSlidersHorizontal } from '@ng-icons/lucide';
import { CatalogAuthSpecDto } from '../../../../core/api/model/models';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { AppIdentityService, IdentityInstall } from '../../../service/app-identity.service';
import { catalogOptionBlocked, catalogOptionEnabled } from './catalog-options';

type AuthMode = CatalogAuthSpecDto.ModesEnum;

export const CATALOG_AUTH_LABELS: Record<AuthMode, string> = {
  native: 'Built-in',
  oidc: 'Single sign-on',
  proxy: 'Proxy auth',
  none: 'No authentication',
};

export function catalogAuthLabel(mode: string): string {
  return CATALOG_AUTH_LABELS[mode as AuthMode] ?? mode;
}

const AUTH_DESCRIPTIONS: Record<AuthMode, string> = {
  native: "Use the app's own login. You manage accounts inside the app.",
  oidc: 'Sign in through Flui for your team, or through one of your identity installs for the app’s own users.',
  proxy: "Flui's authenticating proxy gates access in front of the app.",
  none: 'No login required. Use only on trusted, internal-only networks.',
};

@Component({
  selector: 'app-catalog-features-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [provideIcons({ lucideShieldCheck, lucideSlidersHorizontal })],
  template: `
    <div class="space-y-8">
      @if (state.catalogHasAuthChoice()) {
        <div class="space-y-3">
          <div>
            <h3 class="flex items-center gap-2 text-base font-semibold">
              <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-primary" />
              Authentication
            </h3>
            <p class="text-sm text-muted-foreground">
              Choose how users sign in to this app. You can't change this after install.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (mode of state.catalogAuthModes(); track mode) {
              <button
                type="button"
                (click)="setAuthMode(mode)"
                [class]="cardClass(state.catalogAuthMode() === mode)"
              >
                <div class="flex w-full items-center justify-between">
                  <span class="text-sm font-medium">{{ authLabel(mode) }}</span>
                  @if (mode === state.catalogAuthDefault()) {
                    <span
                      class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      Default
                    </span>
                  }
                </div>
                <p class="mt-1 text-xs text-muted-foreground">{{ authDescription(mode) }}</p>
              </button>
            }
          </div>

          @if (effectiveAuth() === 'oidc') {
            <div class="space-y-2" data-testid="sso-who">
              <p class="text-sm font-medium">Who signs in?</p>
              <label class="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="sso-who"
                  class="mt-1"
                  [checked]="!state.catalogIdentityInstallId()"
                  (change)="state.catalogIdentityInstallId.set(null)"
                />
                <span>
                  <span class="font-medium">Your team</span>
                  <span class="block text-xs text-muted-foreground"
                    >Flui sign-in: the people who use Flui.</span
                  >
                </span>
              </label>
              @for (i of identityInstalls(); track i.identityInstallId) {
                <label class="flex items-start gap-2 text-sm" [class.opacity-50]="!i.managed">
                  <input
                    type="radio"
                    name="sso-who"
                    class="mt-1"
                    [disabled]="!i.managed"
                    [checked]="state.catalogIdentityInstallId() === i.identityInstallId"
                    (change)="state.catalogIdentityInstallId.set(i.identityInstallId)"
                  />
                  <span>
                    <span class="font-medium">{{ i.name }}</span>
                    <span class="block text-xs text-muted-foreground">
                      {{
                        i.managed
                          ? 'The app’s own users, from this identity install.'
                          : 'Reinstall it to manage it from Flui.'
                      }}
                    </span>
                  </span>
                </label>
              }
            </div>
          }
        </div>
      }

      @if (state.catalogFeatureOptions().length > 0) {
        <div class="space-y-3">
          <div>
            <h3 class="flex items-center gap-2 text-base font-semibold">
              <ng-icon name="lucideSlidersHorizontal" class="h-4 w-4 text-primary" />
              Features
            </h3>
            <p class="text-sm text-muted-foreground">
              Enable optional capabilities bundled with this app.
            </p>
          </div>

          <div class="space-y-2">
            @for (option of state.catalogFeatureOptions(); track option.key) {
              <label [class]="optionClass(option.key)">
                <input
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 shrink-0"
                  [ngModel]="isEnabled(option.key)"
                  (ngModelChange)="setOption(option.key, $event)"
                  [disabled]="isBlocked(option.key)"
                  [name]="'option-' + option.key"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium">{{ option.label }}</span>
                  @if (option.description) {
                    <span class="mt-0.5 block text-xs text-muted-foreground">
                      {{ option.description }}
                    </span>
                  }
                </span>
              </label>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CatalogFeaturesStepComponent {
  protected readonly state = inject(DeployWizardStateService);
  private readonly identity = inject(AppIdentityService);
  protected readonly identityInstalls = signal<IdentityInstall[]>([]);
  private identityLoaded = false;

  constructor() {
    effect(() => {
      if (this.effectiveAuth() === 'oidc' && !this.identityLoaded) {
        this.identityLoaded = true;
        this.identity.installs().subscribe({
          next: (list) => this.identityInstalls.set(list),
          error: () => this.identityInstalls.set([]),
        });
      }
    });
  }

  protected effectiveAuth(): AuthMode | null {
    return this.state.catalogAuthMode() ?? this.state.catalogAuthDefault() ?? null;
  }

  authLabel(mode: AuthMode): string {
    return CATALOG_AUTH_LABELS[mode] ?? mode;
  }

  authDescription(mode: AuthMode): string {
    return AUTH_DESCRIPTIONS[mode] ?? '';
  }

  setAuthMode(mode: AuthMode): void {
    this.state.catalogAuthMode.set(mode);
  }

  isEnabled(key: string): boolean {
    return catalogOptionEnabled(
      this.state.catalogFeatureOptions(),
      this.state.catalogFeatureToggles(),
      key,
    );
  }

  isBlocked(key: string): boolean {
    return catalogOptionBlocked(
      this.state.catalogFeatureOptions(),
      this.state.catalogFeatureToggles(),
      key,
    );
  }

  setOption(key: string, enabled: boolean): void {
    this.state.catalogFeatureToggles.update((current) => ({ ...current, [key]: enabled }));
  }

  optionClass(key: string): string {
    const base = 'flex items-start gap-3 rounded-lg border border-border p-3 transition';
    return this.isBlocked(key) ? `${base} opacity-60` : `${base} cursor-pointer hover:bg-accent/40`;
  }

  cardClass(active: boolean): string {
    const base = 'flex flex-col items-start rounded-lg border p-4 text-left transition w-full';
    return active
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }
}
