import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { FlButton } from '../../../../ui/primitives/button';
import { FlTag } from '../../../../ui/primitives/tag';

@Component({
  selector: 'app-catalog-config-step',
  imports: [FormsModule, FlButton, FlTag],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Defaults come from the app manifest. Override a value only where you need to.
    </p>

    @for (env of envs(); track env.name) {
      @let id = 'catalog-env-' + env.name;
      @let overridden = isOverridden(env.name, env.default);
      <div class="fl-field">
        <div class="flex items-center justify-between gap-2">
          <label class="fl-field__label flex items-center gap-2" [attr.for]="id">
            <span class="fl-mono">{{ env.name }}</span>
            @if (overridden) {
              <fl-tag>Overridden</fl-tag>
            }
          </label>
          @if (env.default !== undefined && overridden) {
            <button
              flButton="ghost"
              size="sm"
              type="button"
              (click)="resetToDefault(env.name, env.default)"
            >
              Reset to default
            </button>
          }
        </div>
        <div class="fl-input fl-input--lg">
          <input
            [id]="id"
            type="text"
            [ngModel]="valueFor(env.name)"
            (ngModelChange)="setValue(env.name, $event)"
            [placeholder]="env.default ?? 'Enter a value'"
          />
        </div>
        @if (env.description) {
          <span class="fl-field__hint">{{ env.description }}</span>
        }
      </div>
    }
  `,
})
export class CatalogConfigStepComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly envs = computed(() => this.state.catalogDetail()?.editableEnv ?? []);

  valueFor(name: string): string {
    return this.state.envOverrides()[name] ?? '';
  }

  setValue(name: string, value: string): void {
    this.state.envOverrides.update((current) => ({ ...current, [name]: value }));
  }

  isOverridden(name: string, def: string | undefined): boolean {
    const current = this.valueFor(name);
    if (def === undefined) return current.length > 0;
    return current !== def;
  }

  resetToDefault(name: string, def: string): void {
    this.setValue(name, def);
  }
}
