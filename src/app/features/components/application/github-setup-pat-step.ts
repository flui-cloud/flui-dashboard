import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { PatValidationResultDto } from '../../../core/api/model/patValidationResultDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import { PAT_DEEP_LINK, patErrorLabel } from './github-setup-helpers';

@Component({
  selector: 'app-github-setup-pat-step',
  imports: [FormsModule, FlAlert, FlField, FlButton, FlIcon, FlSpinner, FlStatus],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'fl-stack' },
  template: `
    <fl-alert tone="info" title="Create a classic token on GitHub">
      GitHub opens with the required scopes selected. Generate the token, then paste it here: Flui
      validates it before saving. The one token covers cloning private repositories, registering
      webhooks and pulling images from GHCR.
      <a
        alertActions
        flButton
        size="sm"
        [href]="patDeepLink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Create a token on GitHub
        <fl-icon name="lucideExternalLink" [size]="14" />
      </a>
    </fl-alert>

    <fl-field
      label="Personal access token"
      for="github-pat-token"
      hint="Classic tokens only. Fine-grained tokens cannot grant admin:repo_hook, which webhooks need."
    >
      <div class="flex flex-wrap items-center gap-2">
        <div class="fl-input fl-input--lg min-w-0 flex-1">
          <input
            id="github-pat-token"
            type="password"
            class="fl-mono"
            autocomplete="off"
            required
            placeholder="ghp_…"
            [ngModel]="token()"
            (ngModelChange)="tokenChange.emit($event)"
          />
        </div>
        <button
          flButton
          type="button"
          [disabled]="!token() || configuring()"
          (click)="validate.emit()"
        >
          @if (configuring()) {
            <fl-spinner label="Validating" />
          }
          Validate
        </button>
      </div>
    </fl-field>

    @if (validation(); as v) {
      @if (v.valid && (v.missingScopes?.length ?? 0) === 0) {
        <div class="flex flex-col gap-1" role="status">
          <fl-status tone="success" [label]="'Authenticated as @' + v.login" />
          <span class="text-fl-caption text-fl-ink-muted">
            Scopes: <span class="fl-mono">{{ (v.scopes ?? []).join(', ') }}</span>
          </span>
        </div>
      } @else if (v.valid) {
        <fl-alert tone="warning" title="The token is missing scopes">
          Authenticated as <span class="font-medium">&#64;{{ v.login }}</span
          >. Missing: <span class="fl-mono">{{ (v.missingScopes ?? []).join(', ') }}</span>. Create
          the token again with these scopes, otherwise webhooks and packages do not work.
        </fl-alert>
      } @else {
        <fl-alert tone="error" title="Token not valid">
          {{ errorLabel(v.error, v.message) }}
        </fl-alert>
      }
    }

    @if (error() && !validation()) {
      <fl-alert tone="error" title="GitHub setup failed">{{ error() }}</fl-alert>
    }
  `,
})
export class GithubSetupPatStep {
  readonly token = input('');
  readonly validation = input<PatValidationResultDto | null>(null);
  readonly configuring = input(false);
  readonly error = input<string | null>(null);
  readonly tokenChange = output<string>();
  readonly validate = output<void>();
  protected readonly patDeepLink = PAT_DEEP_LINK;
  protected readonly errorLabel = patErrorLabel;
}
