import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideDatabase,
  lucideLoader,
  lucidePlus,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogDependencyDto } from '../../../../core/api/model/catalogDependencyDto';
import { CatalogReusableInstanceDto } from '../../../../core/api/model/catalogReusableInstanceDto';
import { DependencyChoiceDto } from '../../../../core/api/model/dependencyChoiceDto';

@Component({
  selector: 'app-catalog-dependencies-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideDatabase,
      lucideLoader,
      lucidePlus,
    }),
  ],
  template: `
    <div class="space-y-6">
      <div>
        <h3 class="text-base font-semibold">Dependencies</h3>
        <p class="text-sm text-muted-foreground">
          This app needs other building blocks to run. For each one, pick a running
          instance to reuse or let Flui create a dedicated one alongside the install.
        </p>
      </div>

      @if (state.dependencyInstancesLoading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Looking for compatible instances…
        </div>
      } @else if (state.dependencyInstancesError()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <div>{{ state.dependencyInstancesError() }}</div>
        </div>
      } @else {
        @for (dep of dependencies(); track dep.as) {
          <div class="space-y-3 rounded-lg border border-border bg-card p-4">
            <div class="flex flex-wrap items-center gap-2">
              <ng-icon name="lucideDatabase" class="h-4 w-4 text-primary" />
              <span class="text-sm font-semibold text-foreground">{{ dep.ref }}</span>
              <span class="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                alias: {{ dep.as }}
              </span>
              @if (dep.required) {
                <span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  required
                </span>
              }
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                (click)="pickDedicated(dep)"
                [class]="optionClass(isDedicated(dep))"
              >
                <div class="flex items-start gap-3">
                  <ng-icon name="lucidePlus" class="h-5 w-5 text-primary mt-0.5" />
                  <div class="min-w-0 flex-1 text-left">
                    <div class="text-sm font-semibold text-foreground">
                      Create new dedicated
                    </div>
                    <div class="mt-0.5 text-xs text-muted-foreground">
                      Flui installs a fresh {{ dep.ref }} as a private dependency of this app.
                    </div>
                  </div>
                  @if (isDedicated(dep)) {
                    <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-primary" />
                  }
                </div>
              </button>

              @if (instancesFor(dep.ref).length > 0) {
                <div [class]="optionClass(isReuse(dep))" class="cursor-default">
                  <div class="space-y-2">
                    <div class="text-sm font-semibold text-foreground">
                      Reuse existing
                    </div>
                    <ul class="space-y-1.5">
                      @for (instance of instancesFor(dep.ref); track instance.applicationId) {
                        <li>
                          <button
                            type="button"
                            (click)="pickReuse(dep, instance)"
                            [class]="instanceClass(isReuseSelected(dep, instance))"
                          >
                            <div class="flex items-center gap-2">
                              <ng-icon name="lucideDatabase" class="h-4 w-4 text-muted-foreground" />
                              <span class="text-xs font-medium text-foreground">
                                {{ instance.displayName }}
                              </span>
                              <span [class]="statusBadgeClass(instance.status)">
                                {{ instance.status }}
                              </span>
                              @if (isReuseSelected(dep, instance)) {
                                <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-primary ml-auto" />
                              }
                            </div>
                            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {{ instance.applicationName }}
                            </div>
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                </div>
              } @else {
                <div class="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                  No running {{ dep.ref }} on this cluster — Flui will create a dedicated one.
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class CatalogDependenciesStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly dependencies = computed(() => this.state.catalogDependencies());

  protected instancesFor(ref: string): CatalogReusableInstanceDto[] {
    return this.state.dependencyInstances()[ref] ?? [];
  }

  protected isDedicated(dep: CatalogDependencyDto): boolean {
    return (
      this.state.dependencyChoices()[dep.as]?.mode ===
      DependencyChoiceDto.ModeEnum.Dedicated
    );
  }

  protected isReuse(dep: CatalogDependencyDto): boolean {
    return (
      this.state.dependencyChoices()[dep.as]?.mode ===
      DependencyChoiceDto.ModeEnum.ReuseExisting
    );
  }

  protected isReuseSelected(
    dep: CatalogDependencyDto,
    instance: CatalogReusableInstanceDto,
  ): boolean {
    const c = this.state.dependencyChoices()[dep.as];
    return (
      c?.mode === DependencyChoiceDto.ModeEnum.ReuseExisting &&
      c.existingApplicationId === instance.applicationId
    );
  }

  protected pickDedicated(dep: CatalogDependencyDto): void {
    this.state.setDependencyChoice(dep.as, {
      mode: DependencyChoiceDto.ModeEnum.Dedicated,
    });
  }

  protected pickReuse(
    dep: CatalogDependencyDto,
    instance: CatalogReusableInstanceDto,
  ): void {
    this.state.setDependencyChoice(dep.as, {
      mode: DependencyChoiceDto.ModeEnum.ReuseExisting,
      existingApplicationId: instance.applicationId,
    });
  }

  protected optionClass(active: boolean): string {
    const base =
      'flex w-full rounded-lg border p-3 text-left transition';
    return active
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }

  protected instanceClass(active: boolean): string {
    const base =
      'flex w-full flex-col rounded-md border px-2.5 py-1.5 text-left transition';
    return active
      ? `${base} border-primary bg-primary/10`
      : `${base} border-border hover:bg-accent/40`;
  }

  protected statusBadgeClass(status: CatalogReusableInstanceDto.StatusEnum): string {
    const base =
      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize';
    switch (status) {
      case CatalogReusableInstanceDto.StatusEnum.Running:
        return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
      case CatalogReusableInstanceDto.StatusEnum.Degraded:
        return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`;
      case CatalogReusableInstanceDto.StatusEnum.Failed:
        return `${base} bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400`;
      default:
        return `${base} bg-muted text-muted-foreground`;
    }
  }
}
