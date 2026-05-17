import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideEye, lucideEyeOff, lucideKey } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { pickInputType } from '../../../model/prompt-validation';
import { CatalogUserInputPromptDto } from '../../../../core/api/model/catalogUserInputPromptDto';

@Component({
  selector: 'app-catalog-inputs-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideEye, lucideEyeOff, lucideKey })],
  template: `
    <div class="space-y-5">
      <div>
        <h3 class="text-base font-semibold">App configuration</h3>
        <p class="text-sm text-muted-foreground">
          Secrets and settings the app needs to run. Values marked <span class="text-red-500">*</span> are required.
        </p>
      </div>

      @for (prompt of prompts(); track prompt.name) {
        @let fieldError = errorFor(prompt.name);
        @let visible = revealed().has(prompt.name);
        @let baseType = inputTypeFor(prompt);
        @let type = baseType === 'password' && visible ? 'text' : baseType;
        @let canToggle = baseType === 'password';

        <div>
          <label class="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <span>{{ prompt.label ?? prompt.name }}</span>
            @if (prompt.sensitive) {
              <span
                class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              >
                <ng-icon name="lucideKey" class="mr-1 inline-block h-2.5 w-2.5" />
                Secret
              </span>
            }
            @if (prompt.default === undefined) {
              <span class="text-red-500">*</span>
            }
          </label>

          <div class="relative">
            <input
              [type]="type"
              autocomplete="off"
              [name]="prompt.name"
              [ngModel]="valueFor(prompt.name)"
              (ngModelChange)="setValue(prompt.name, $event)"
              [placeholder]="placeholderFor(prompt)"
              [attr.minlength]="prompt.minLength ?? null"
              [attr.maxlength]="prompt.maxLength ?? null"
              [class]="inputClass(!!fieldError, canToggle)"
            />
            @if (canToggle) {
              <button
                type="button"
                (click)="toggleReveal(prompt.name)"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                [attr.aria-label]="visible ? 'Hide value' : 'Show value'"
              >
                <ng-icon [name]="visible ? 'lucideEyeOff' : 'lucideEye'" class="h-4 w-4" />
              </button>
            }
          </div>

          @if (prompt.confirm) {
            <label class="mb-1.5 mt-3 block text-sm font-medium">
              Confirm {{ (prompt.label ?? prompt.name).toLowerCase() }}
              @if (prompt.default === undefined) {
                <span class="text-red-500">*</span>
              }
            </label>
            <input
              [type]="type"
              autocomplete="off"
              [name]="prompt.name + '__confirm'"
              [ngModel]="confirmFor(prompt.name)"
              (ngModelChange)="setConfirm(prompt.name, $event)"
              [placeholder]="'Repeat ' + (prompt.label ?? prompt.name)"
              [class]="inputClass(!!fieldError, false)"
            />
          }

          @if (fieldError) {
            <p class="mt-1 flex items-center gap-1 text-xs text-destructive">
              <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5" />
              {{ fieldError }}
            </p>
          } @else if (prompt.description) {
            <p class="mt-1 text-xs text-muted-foreground">{{ prompt.description }}</p>
          } @else if (prompt.patternDescription) {
            <p class="mt-1 text-xs text-muted-foreground">{{ prompt.patternDescription }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class CatalogInputsStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly prompts = computed(
    () => this.state.catalogDetail()?.userInputPrompts ?? [],
  );

  /** Names of prompts currently shown in plaintext (password-type only). */
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
    // Backend-reported error stays sticky until the user edits the field.
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

  inputClass(hasError: boolean, withToggle: boolean): string {
    const base =
      'h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2';
    const colors = hasError
      ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
      : 'border-input focus:border-primary focus:ring-primary/30';
    const padding = withToggle ? 'pr-9' : '';
    return `${base} ${colors} ${padding}`.trim();
  }
}
