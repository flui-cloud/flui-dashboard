import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide';
import { ProviderDefinitionDto } from '../../../core/api';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlIcon } from '../../../ui/primitives/icon';
import { CredentialFieldDefinition } from './provider-presentation';

@Component({
  selector: 'app-provider-wizard-credentials',
  imports: [ReactiveFormsModule, FlAlert, FlField, FlIcon],
  providers: [provideIcons({ lucideEye, lucideEyeOff })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'fl-stack' },
  template: `
    <fl-alert tone="info" [title]="provider().displayName + ' gives you these in its console.'">
      @if (provider().accessKeyDocumentationUrl) {
        <a
          class="fl-link"
          [href]="provider().accessKeyDocumentationUrl"
          target="_blank"
          rel="noopener"
          >Where to find them</a
        >
      }
      @if (provider().dnsZoneDelegation; as dns) {
        <span class="block">
          Custom domains can be delegated to {{ provider().displayName }}.
          <a
            class="fl-link"
            [href]="dns.delegationGuideUrl"
            target="_blank"
            rel="noopener"
            title="The nameservers to set at your registrar are listed in the provider's console once the zone is registered."
            >How</a
          >
        </span>
      }
    </fl-alert>

    <form [formGroup]="form()" class="fl-stack">
      @for (field of fields(); track field.key) {
        <fl-field
          [label]="(field.providerLabel || field.label) + (field.required ? '' : ' (optional)')"
          [for]="'credential-' + field.key"
          [hint]="field.hint"
          [error]="
            form().get(field.key)?.errors && form().get(field.key)?.touched
              ? 'This field is required'
              : null
          "
        >
          <span class="fl-input fl-input--lg">
            <input
              [id]="'credential-' + field.key"
              [type]="field.secret && !showPasswords()[field.key] ? 'password' : 'text'"
              [formControlName]="field.key"
              [attr.placeholder]="demo() ? demoPlaceholder() : null"
              autocomplete="off"
              spellcheck="false"
            />
            @if (field.secret && !demo()) {
              <button
                type="button"
                class="inline-flex text-fl-ink-muted hover:text-fl-ink"
                [attr.aria-label]="showPasswords()[field.key] ? 'Hide value' : 'Show value'"
                (click)="toggleSecret.emit(field.key)"
              >
                <fl-icon [name]="showPasswords()[field.key] ? 'lucideEyeOff' : 'lucideEye'" />
              </button>
            }
          </span>
        </fl-field>
      }

      @if (supportsExpiry()) {
        <fl-field
          label="Key expiry date (optional)"
          for="credential-expiry"
          hint="Set it if the key expires in the provider console."
        >
          <span class="fl-input fl-input--lg">
            <input id="credential-expiry" type="date" formControlName="expiresAt" />
          </span>
        </fl-field>
      }
    </form>
  `,
})
export class ProviderWizardCredentials {
  readonly form = input.required<FormGroup>();
  readonly provider = input.required<ProviderDefinitionDto>();
  readonly fields = input.required<CredentialFieldDefinition[]>();
  readonly supportsExpiry = input(false);
  readonly demo = input(false);
  readonly demoPlaceholder = input('');
  readonly showPasswords = input<Record<string, boolean>>({});
  readonly toggleSecret = output<string>();
}
