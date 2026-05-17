import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';

@Component({
  selector: 'app-catalog-config-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="space-y-5">
      <div>
        <h3 class="text-base font-semibold">Editable settings</h3>
        <p class="text-sm text-muted-foreground">
          Defaults are pre-filled from the app manifest. Override any value you need to change.
        </p>
      </div>

      @for (env of envs(); track env.name) {
        <div>
          <label class="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <span class="font-mono text-xs text-foreground">{{ env.name }}</span>
            @if (isOverridden(env.name, env.default)) {
              <span
                class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                Overridden
              </span>
            }
          </label>
          <input
            type="text"
            [ngModel]="valueFor(env.name)"
            (ngModelChange)="setValue(env.name, $event)"
            [placeholder]="env.default ?? 'Enter a value'"
            class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm
                   focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div class="mt-1 flex items-center justify-between gap-2">
            @if (env.description) {
              <p class="text-xs text-muted-foreground">{{ env.description }}</p>
            } @else {
              <span></span>
            }
            @if (env.default !== undefined && isOverridden(env.name, env.default)) {
              <button
                type="button"
                (click)="resetToDefault(env.name, env.default)"
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CatalogConfigStepComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly envs = computed(
    () => this.state.catalogDetail()?.editableEnv ?? [],
  );

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
