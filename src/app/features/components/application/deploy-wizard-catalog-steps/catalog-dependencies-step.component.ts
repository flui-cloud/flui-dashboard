import { Component, computed, inject } from '@angular/core';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogDependencyDto } from '../../../../core/api/model/catalogDependencyDto';
import { CatalogReusableInstanceDto } from '../../../../core/api/model/catalogReusableInstanceDto';
import { DependencyChoiceDto } from '../../../../core/api/model/dependencyChoiceDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';
import { FlTag } from '../../../../ui/primitives/tag';
import { instanceState } from './catalog-instance-status';

@Component({
  selector: 'app-catalog-dependencies-step',
  imports: [FlAlert, FlStatus, FlTag],
  host: { class: 'flex flex-col gap-6' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      The app needs these building blocks. Reuse a running instance or let Flui create a dedicated
      one with the install.
    </p>

    @if (state.dependencyInstancesLoading()) {
      <fl-status tone="progress" label="Looking for compatible instances" />
    } @else if (state.dependencyInstancesError()) {
      <fl-alert tone="error" title="Could not list instances">{{
        state.dependencyInstancesError()
      }}</fl-alert>
    } @else {
      @for (dep of dependencies(); track dep.as) {
        @let reusable = instancesFor(dep.ref);
        <fieldset class="fl-fieldset">
          <legend class="flex flex-wrap items-center gap-2">
            <span class="fl-mono">{{ dep.ref }}</span>
            <fl-tag>Alias {{ dep.as }}</fl-tag>
            @if (dep.required) {
              <fl-tag>Required</fl-tag>
            }
          </legend>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label class="fl-radiocard" [class.is-checked]="isDedicated(dep)">
              <input
                type="radio"
                [name]="'catalog-dep-' + dep.as"
                [checked]="isDedicated(dep)"
                (change)="pickDedicated(dep)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Create a dedicated one</span>
                <span class="fl-radiocard__desc"
                  >Flui installs a new {{ dep.ref }} that only this app uses.</span
                >
              </span>
            </label>
            @for (instance of reusable; track instance.applicationId) {
              @let st = statusOf(instance.status);
              <label class="fl-radiocard" [class.is-checked]="isReuseSelected(dep, instance)">
                <input
                  type="radio"
                  [name]="'catalog-dep-' + dep.as"
                  [checked]="isReuseSelected(dep, instance)"
                  (change)="pickReuse(dep, instance)"
                />
                <span class="fl-radiocard__text flex-1">
                  <span class="fl-radiocard__title">Reuse {{ instance.displayName }}</span>
                  <span class="fl-radiocard__desc fl-mono">{{ instance.applicationName }}</span>
                </span>
                <fl-status [tone]="st.tone" [label]="st.label" />
              </label>
            }
          </div>
          @if (reusable.length === 0) {
            <p class="m-0 text-fl-caption text-fl-ink-muted">
              No running {{ dep.ref }} on this cluster, so Flui creates a dedicated one.
            </p>
          }
        </fieldset>
      }
    }
  `,
})
export class CatalogDependenciesStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly dependencies = computed(() => this.state.catalogDependencies());

  protected instancesFor(ref: string): CatalogReusableInstanceDto[] {
    return this.state.dependencyInstances()[ref] ?? [];
  }

  protected isDedicated(dep: CatalogDependencyDto): boolean {
    return this.state.dependencyChoices()[dep.as]?.mode === DependencyChoiceDto.ModeEnum.Dedicated;
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

  protected pickReuse(dep: CatalogDependencyDto, instance: CatalogReusableInstanceDto): void {
    this.state.setDependencyChoice(dep.as, {
      mode: DependencyChoiceDto.ModeEnum.ReuseExisting,
      existingApplicationId: instance.applicationId,
    });
  }

  protected statusOf(status: CatalogReusableInstanceDto.StatusEnum): {
    tone: StatusTone;
    label: string;
  } {
    return instanceState(status);
  }
}
