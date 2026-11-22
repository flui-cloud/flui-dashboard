import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { pickInputType } from '../../../model/prompt-validation';
import { CatalogUserInputPromptDto } from '../../../../core/api/model/catalogUserInputPromptDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlTag } from '../../../../ui/primitives/tag';

@Component({
  selector: 'app-catalog-inputs-step',
  imports: [FormsModule, FlAlert, FlKeyValue, FlKvItem, FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideEye, lucideEyeOff })],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">Secrets and settings the app needs to run.</p>

    @if (defaultCredentials(); as creds) {
      <section class="flex flex-col gap-3" aria-label="Default login">
        <h3 class="m-0 text-fl-body-sm font-semibold">Default login</h3>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          The app ships with this account. Flui does not set it.
        </p>
        <fl-key-value class="fl-kv--compact">
          @if (creds.username) {
            <fl-kv-item key="Username" [mono]="true">{{ creds.username }}</fl-kv-item>
          }
          @if (creds.password) {
            <fl-kv-item key="Password" [mono]="true">{{ creds.password }}</fl-kv-item>
          }
        </fl-key-value>
        @if (creds.changeNote) {
          <fl-alert tone="warning" title="Change the default login">{{
            creds.changeNote
          }}</fl-alert>
        }
      </section>
    }

    @for (prompt of prompts(); track prompt.name) {
      @let fieldError = errorFor(prompt.name);
      @let visible = revealed().has(prompt.name);
      @let baseType = inputTypeFor(prompt);
      @let type = baseType === 'password' && visible ? 'text' : baseType;
      @let canToggle = baseType === 'password';
      @let label = prompt.label ?? prompt.name;
      @let id = 'catalog-input-' + prompt.name;

      <div class="fl-field" [class.is-invalid]="!!fieldError">
        <label class="fl-field__label flex items-center gap-2" [attr.for]="id">
          <span>{{ label }}</span>
          @if (prompt.default === undefined) {
            <fl-tag>Required</fl-tag>
          }
          @if (prompt.sensitive) {
            <fl-tag>Secret</fl-tag>
          }
        </label>
        <div class="flex items-center gap-2">
          <div class="fl-input fl-input--lg flex-1">
            <input
              [id]="id"
              [type]="type"
              autocomplete="off"
              [name]="prompt.name"
              [ngModel]="valueFor(prompt.name)"
              (ngModelChange)="setValue(prompt.name, $event)"
              [placeholder]="placeholderFor(prompt)"
              [attr.minlength]="prompt.minLength ?? null"
              [attr.maxlength]="prompt.maxLength ?? null"
            />
          </div>
          @if (canToggle) {
            <button
              flButton
              [iconOnly]="true"
              type="button"
              [attr.aria-label]="visible ? 'Hide value' : 'Show value'"
              (click)="toggleReveal(prompt.name)"
            >
              <fl-icon [name]="visible ? 'lucideEyeOff' : 'lucideEye'" />
            </button>
          }
        </div>

        @if (prompt.confirm) {
          <label class="fl-field__label mt-2" [attr.for]="id + '-confirm'">
            Confirm {{ label.toLowerCase() }}
          </label>
          <div class="fl-input fl-input--lg">
            <input
              [id]="id + '-confirm'"
              [type]="type"
              autocomplete="off"
              [name]="prompt.name + '__confirm'"
              [ngModel]="confirmFor(prompt.name)"
              (ngModelChange)="setConfirm(prompt.name, $event)"
              [placeholder]="'Repeat ' + label"
            />
          </div>
        }

        @if (fieldError) {
          <span class="fl-field__error" role="alert">{{ fieldError }}</span>
        } @else if (prompt.description) {
          <span class="fl-field__hint">{{ prompt.description }}</span>
        } @else if (prompt.patternDescription) {
          <span class="fl-field__hint">{{ prompt.patternDescription }}</span>
        }
      </div>
    }
  `,
})
export class CatalogInputsStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly prompts = computed(() => this.state.catalogDetail()?.userInputPrompts ?? []);

  protected readonly defaultCredentials = computed(
    () => this.state.catalogDetail()?.defaultCredentials ?? null,
  );

  private readonly revealedSet = signal<Set<string>>(new Set());
  protected readonly revealed = this.revealedSet.asReadonly();

  valueFor(name: string): string {
    return this.state.userInputs()[name] ?? '';
  }

  confirmFor(name: string): string {
    return this.state.userInputConfirms()[name] ?? '';
  }

  setValue(name: string, value: string): void {
    this.state.userInputs.update((current) => ({ ...current, [name]: value }));
    this.state.clearBackendFieldError(name);
  }

  setConfirm(name: string, value: string): void {
    this.state.userInputConfirms.update((current) => ({ ...current, [name]: value }));
    this.state.clearBackendFieldError(name);
  }

  errorFor(name: string): string | null {
    const backend = this.state.backendFieldErrors()[name];
    if (backend) return backend;
    return this.state.catalogInputErrors()[name] ?? null;
  }

  inputTypeFor(prompt: CatalogUserInputPromptDto): string {
    return pickInputType(prompt);
  }

  placeholderFor(prompt: CatalogUserInputPromptDto): string {
    return prompt.placeholder ?? prompt.default ?? 'Enter a value';
  }

  toggleReveal(name: string): void {
    this.revealedSet.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
}
