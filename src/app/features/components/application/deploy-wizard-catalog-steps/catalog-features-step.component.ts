import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogAuthSpecDto } from '../../../../core/api/model/models';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { AppIdentityService, IdentityInstall } from '../../../service/app-identity.service';
import { catalogOptionBlocked, catalogOptionEnabled } from './catalog-options';
import { FlTag } from '../../../../ui/primitives/tag';

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
  imports: [FormsModule, FlTag],
  host: { class: 'flex flex-col gap-6' },
  template: `
    @if (state.catalogHasAuthChoice()) {
      <fieldset class="fl-fieldset">
        <legend>Authentication</legend>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          How people sign in to this app. You cannot change it after install.
        </p>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          @for (mode of state.catalogAuthModes(); track mode) {
            <label class="fl-radiocard" [class.is-checked]="state.catalogAuthMode() === mode">
              <input
                type="radio"
                name="catalog-auth-mode"
                [value]="mode"
                [checked]="state.catalogAuthMode() === mode"
                (change)="setAuthMode(mode)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title flex items-center gap-2">
                  {{ authLabel(mode) }}
                  @if (mode === state.catalogAuthDefault()) {
                    <fl-tag>Default</fl-tag>
                  }
                </span>
                <span class="fl-radiocard__desc">{{ authDescription(mode) }}</span>
              </span>
            </label>
          }
        </div>
      </fieldset>

      @if (effectiveAuth() === 'oidc') {
        <fieldset class="fl-fieldset" data-testid="sso-who">
          <legend>Who signs in?</legend>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label class="fl-radiocard">
              <input
                type="radio"
                name="sso-who"
                [checked]="!state.catalogIdentityInstallId()"
                (change)="state.catalogIdentityInstallId.set(null)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Your team</span>
                <span class="fl-radiocard__desc">Flui sign-in, for the people who use Flui.</span>
              </span>
            </label>
            @for (i of identityInstalls(); track i.identityInstallId) {
              <label
                class="fl-radiocard"
                [class.opacity-50]="!i.managed"
                [class.cursor-not-allowed]="!i.managed"
              >
                <input
                  type="radio"
                  name="sso-who"
                  [disabled]="!i.managed"
                  [checked]="state.catalogIdentityInstallId() === i.identityInstallId"
                  (change)="state.catalogIdentityInstallId.set(i.identityInstallId)"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">{{ i.name }}</span>
                  <span class="fl-radiocard__desc">
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
        </fieldset>
      }
    }

    @if (state.catalogFeatureOptions().length > 0) {
      <fieldset class="fl-fieldset">
        <legend>Features</legend>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Optional capabilities bundled with the app.
        </p>
        @for (option of state.catalogFeatureOptions(); track option.key) {
          @let blocked = isBlocked(option.key);
          <div class="flex flex-col gap-1" [class.opacity-50]="blocked">
            <label class="fl-check" [class.cursor-not-allowed]="blocked">
              <input
                type="checkbox"
                [ngModel]="isEnabled(option.key)"
                (ngModelChange)="setOption(option.key, $event)"
                [disabled]="blocked"
                [name]="'option-' + option.key"
              />
              <span class="font-medium">{{ option.label }}</span>
            </label>
            @if (option.description) {
              <p class="m-0 pl-6 text-fl-caption text-fl-ink-muted">{{ option.description }}</p>
            }
          </div>
        }
      </fieldset>
    }
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
}
