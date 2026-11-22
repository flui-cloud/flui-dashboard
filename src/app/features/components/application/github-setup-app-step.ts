import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GitHubAppFormData,
  ManifestFormData,
  organizationProblem,
} from '../../service/github-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { derivedUrls, isLocalUrl } from './github-setup-helpers';

@Component({
  selector: 'app-github-setup-app-step',
  imports: [FormsModule, FlAlert, FlField, FlKeyValue, FlKvItem, FlButton, FlSpinner],
  host: { class: 'fl-stack' },
  template: `
    @if (!manualMode()) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Flui sends you to GitHub with the App configuration filled in. Confirm it there and you come
        back here with everything connected.
      </p>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fl-field
          label="App name"
          for="github-app-name"
          hint="Unique across GitHub. Your company or instance name works well."
        >
          <div class="fl-input fl-input--lg">
            <input
              id="github-app-name"
              type="text"
              required
              placeholder="flui-acme"
              [ngModel]="manifest().name"
              (ngModelChange)="manifestChange.emit({ name: $event })"
            />
          </div>
        </fl-field>

        <fl-field
          label="Organization (optional)"
          for="github-app-organization"
          [error]="orgProblem()"
          hint="Leave empty to create it on your own account. You must own the organization."
        >
          <div class="fl-input fl-input--lg">
            <input
              id="github-app-organization"
              type="text"
              class="fl-mono"
              autocomplete="off"
              placeholder="acme"
              [ngModel]="manifest().organization"
              (ngModelChange)="manifestChange.emit({ organization: $event })"
            />
          </div>
        </fl-field>
      </div>

      <fl-field
        label="Flui public URL"
        for="github-app-public-url"
        hint="Where this Flui API is reachable. The OAuth callback, the manifest callback and the webhook URL derive from it."
      >
        <div class="fl-input fl-input--lg">
          <input
            id="github-app-public-url"
            type="url"
            class="fl-mono"
            required
            [placeholder]="defaultPublicApiUrl()"
            [ngModel]="manifest().publicApiUrl"
            (ngModelChange)="manifestChange.emit({ publicApiUrl: $event })"
          />
        </div>
      </fl-field>

      @if (urls(); as u) {
        <section class="flex flex-col gap-2" aria-label="GitHub configuration">
          <h3 class="m-0 text-fl-body-sm font-semibold">GitHub is configured with</h3>
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="OAuth callback" [mono]="true">
              <span class="break-all">{{ u.callback }}</span>
            </fl-kv-item>
            <fl-kv-item key="Manifest redirect" [mono]="true">
              <span class="break-all">{{ u.redirect }}</span>
            </fl-kv-item>
            @if (manifest().webhooksEnabled) {
              <fl-kv-item key="Webhook" [mono]="true">
                <span class="break-all">{{ u.webhook }}</span>
              </fl-kv-item>
            }
          </fl-key-value>
        </section>
      }

      @if (isLocal()) {
        <fl-alert tone="warning" title="GitHub cannot reach localhost">
          GitHub cannot call the webhook or complete the authorization redirect from another
          machine. In development, expose the API through a tunnel and paste its public URL here.
        </fl-alert>
      }

      <div class="flex flex-col gap-3">
        <label class="fl-check items-start">
          <input
            type="checkbox"
            [ngModel]="manifest().webhooksEnabled"
            (ngModelChange)="manifestChange.emit({ webhooksEnabled: $event })"
          />
          <span class="flex flex-col gap-0.5">
            <span>Enable webhooks for deploy on push</span>
            <span class="text-fl-caption text-fl-ink-muted">
              The Flui public URL must be reachable from github.com.
            </span>
          </span>
        </label>
        <label class="fl-check items-start">
          <input
            type="checkbox"
            [ngModel]="manifest().publicApp"
            (ngModelChange)="manifestChange.emit({ publicApp: $event })"
          />
          <span class="flex flex-col gap-0.5">
            <span>Allow installation on other accounts and organizations</span>
            <span class="text-fl-caption text-fl-ink-muted">
              Off by default: only the account that owns the App can install it. Turn it on to reach
              repositories under other accounts or organizations.
            </span>
          </span>
        </label>
      </div>

      <div>
        <button flButton="ghost" size="sm" type="button" (click)="toggleManual.emit()">
          I already have a GitHub App
        </button>
      </div>
    } @else {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Paste the credentials of your existing GitHub App. For a new installation the guided flow is
        simpler.
      </p>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fl-field label="App ID" for="github-app-id">
          <div class="fl-input fl-input--lg">
            <input
              id="github-app-id"
              type="text"
              class="fl-mono"
              required
              placeholder="123456"
              [ngModel]="appForm().appId"
              (ngModelChange)="appFormChange.emit({ appId: $event })"
            />
          </div>
        </fl-field>
        <fl-field label="App slug" for="github-app-slug">
          <div class="fl-input fl-input--lg">
            <input
              id="github-app-slug"
              type="text"
              class="fl-mono"
              required
              placeholder="flui-cloud"
              [ngModel]="appForm().appSlug"
              (ngModelChange)="appFormChange.emit({ appSlug: $event })"
            />
          </div>
        </fl-field>
      </div>

      <fl-field label="Private key (PEM)" for="github-app-private-key">
        <textarea
          id="github-app-private-key"
          class="fl-textarea fl-mono"
          rows="4"
          required
          placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
          [ngModel]="appForm().privateKey"
          (ngModelChange)="appFormChange.emit({ privateKey: $event })"
        ></textarea>
      </fl-field>

      <fl-field label="Webhook secret" for="github-app-webhook-secret">
        <div class="fl-input fl-input--lg">
          <input
            id="github-app-webhook-secret"
            type="password"
            required
            autocomplete="off"
            [ngModel]="appForm().webhookSecret"
            (ngModelChange)="appFormChange.emit({ webhookSecret: $event })"
          />
        </div>
      </fl-field>

      <div>
        <button flButton="ghost" size="sm" type="button" (click)="toggleManual.emit()">
          Back to the guided flow
        </button>
      </div>
    }

    @if (configuring()) {
      <p class="fl-row m-0 text-fl-body-sm text-fl-ink-muted">
        <fl-spinner [label]="manualMode() ? 'Validating' : 'Preparing'" />
        {{
          manualMode()
            ? 'Validating the credentials with GitHub…'
            : 'Preparing the manifest and opening GitHub…'
        }}
      </p>
    }

    @if (error()) {
      <fl-alert tone="error" title="GitHub setup failed">{{ error() }}</fl-alert>
    }
  `,
})
export class GithubSetupAppStep {
  readonly manualMode = input(false);
  readonly manifest = input.required<ManifestFormData>();
  readonly appForm = input.required<GitHubAppFormData>();
  readonly defaultPublicApiUrl = input('');
  readonly configuring = input(false);
  readonly error = input<string | null>(null);
  readonly manifestChange = output<Partial<ManifestFormData>>();
  readonly appFormChange = output<Partial<GitHubAppFormData>>();
  readonly toggleManual = output<void>();

  protected readonly orgProblem = computed(() => organizationProblem(this.manifest().organization));
  protected readonly urls = computed(() => derivedUrls(this.manifest().publicApiUrl));
  protected readonly isLocal = computed(() => isLocalUrl(this.manifest().publicApiUrl));
}
