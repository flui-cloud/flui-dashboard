import { Component, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogReusableInstanceDto } from '../../../../core/api/model/catalogReusableInstanceDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlEmptyState } from '../../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';
import { FlTag } from '../../../../ui/primitives/tag';
import { instanceState } from './catalog-instance-status';

@Component({
  selector: 'app-catalog-linked-bb-step',
  imports: [FlAlert, FlEmptyState, FlStatus, FlTag],
  providers: [provideIcons({ lucideDatabase })],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      @if (bbRefs().length > 1) {
        Optional. Pick a running instance of
        <span class="fl-mono">{{ slugList() }}</span> to connect after install. Flui wires the
        credentials.
      } @else {
        Optional. Pick a running <span class="fl-mono">{{ bbLabel() }}</span> to connect after
        install. Flui wires the credentials, so no password is asked. You can also connect later
        from the app.
      }
    </p>

    @if (bbRefs().length > 1 && !state.reusableInstancesLoading() && allInstances().length > 0) {
      <div class="fl-row" role="group" aria-label="Filter by building block">
        <button
          type="button"
          class="fl-chip"
          [attr.aria-pressed]="slugFilter() === null"
          (click)="setSlugFilter(null)"
        >
          All
        </button>
        @for (s of bbRefs(); track s) {
          <button
            type="button"
            class="fl-chip"
            [attr.aria-pressed]="slugFilter() === s"
            (click)="setSlugFilter(s)"
          >
            {{ s }}
          </button>
        }
      </div>
    }

    @if (state.reusableInstancesLoading()) {
      <fl-status tone="progress" [label]="'Looking for running ' + bbLabel() + ' instances'" />
    } @else if (state.reusableInstancesError()) {
      <fl-alert tone="error" title="Could not list instances">{{
        state.reusableInstancesError()
      }}</fl-alert>
    } @else if (instances().length === 0) {
      <fl-empty-state
        [compact]="true"
        icon="lucideDatabase"
        [title]="'No running ' + bbLabel() + ' on this cluster'"
        [body]="
          bbRefs().length > 1
            ? 'Install one of ' + slugList() + ' first, then come back to link it.'
            : 'Install a ' + bbLabel() + ' building block first, then come back to link it.'
        "
      />
    } @else {
      <fieldset class="fl-fieldset">
        <legend class="fl-sr">Instance to link</legend>
        @for (instance of instances(); track instance.catalogInstallId || instance.applicationId) {
          @let st = statusOf(instance.status);
          <label
            class="fl-radiocard"
            [class.is-checked]="isSelected(instance)"
            [class.opacity-50]="!instance.catalogInstallId"
            [class.cursor-not-allowed]="!instance.catalogInstallId"
          >
            <input
              type="radio"
              name="catalog-linked-bb"
              [checked]="isSelected(instance)"
              [disabled]="!instance.catalogInstallId"
              (change)="select(instance)"
            />
            <span class="fl-radiocard__text flex-1">
              <span class="fl-radiocard__title flex flex-wrap items-center gap-2">
                {{ instance.displayName }}
                @if (bbRefs().length > 1 && instance.catalogSlug) {
                  <fl-tag>{{ instance.catalogSlug }}</fl-tag>
                }
              </span>
              <span class="fl-radiocard__desc fl-mono">{{ instance.applicationName }}</span>
              @if (!instance.catalogInstallId) {
                <span class="fl-radiocard__desc">
                  Not created from the catalog, so it cannot be linked.
                </span>
              }
            </span>
            <fl-status [tone]="st.tone" [label]="st.label" />
          </label>
        }
      </fieldset>
    }
  `,
})
export class CatalogLinkedBbStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly bbRefs = computed(() => this.state.linkedBbRefs());
  protected readonly bbLabel = computed(() =>
    this.bbRefs().length === 1 ? this.bbRefs()[0] : 'building block',
  );
  protected readonly slugList = computed(() => this.bbRefs().join(' · '));
  protected readonly slugFilter = signal<string | null>(null);

  protected readonly allInstances = computed(() => this.state.reusableInstances());
  protected readonly instances = computed(() => {
    const filter = this.slugFilter();
    const all = this.allInstances();
    return filter ? all.filter((i) => i.catalogSlug === filter) : all;
  });

  protected isSelected(instance: CatalogReusableInstanceDto): boolean {
    return (
      !!instance.catalogInstallId &&
      this.state.pendingLinkedInstallId() === instance.catalogInstallId
    );
  }

  protected select(instance: CatalogReusableInstanceDto): void {
    if (!instance.catalogInstallId) return;
    this.state.pendingLinkedInstallId.set(instance.catalogInstallId);
  }

  protected setSlugFilter(slug: string | null): void {
    this.slugFilter.set(slug);
  }

  protected statusOf(status: CatalogReusableInstanceDto.StatusEnum): {
    tone: StatusTone;
    label: string;
  } {
    return instanceState(status);
  }
}
