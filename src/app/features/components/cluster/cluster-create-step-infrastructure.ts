import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideWand } from '@ng-icons/lucide';
import { ProviderRegionSelectorComponent } from '../../../shared/components/provider-region-selector/provider-region-selector.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-cluster-create-step-infrastructure',
  imports: [
    ReactiveFormsModule,
    ProviderRegionSelectorComponent,
    FlAlert,
    FlField,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideWand })],
  host: { class: 'fl-stack' },
  template: `
    <fl-field label="Cluster name" for="cluster-name" [error]="nameError()" [hint]="nameHint()">
      <div class="flex max-w-md items-center gap-2">
        <div class="fl-input fl-input--lg flex-1">
          <input
            id="cluster-name"
            type="text"
            class="fl-mono"
            placeholder="workload-cluster-1"
            [formControl]="name()"
          />
        </div>
        <button
          flButton
          type="button"
          title="Generate a unique name"
          [disabled]="generating()"
          (click)="generate.emit()"
        >
          @if (generating()) {
            <fl-spinner label="Generating" />
            Generating…
          } @else {
            <fl-icon name="lucideWand" />
            Generate
          }
        </button>
      </div>
    </fl-field>

    <fieldset class="fl-fieldset">
      <legend>Cloud provider</legend>
      <app-provider-region-selector
        [currentStep]="1"
        [selectedProvider]="provider()"
        [selectedRegion]="region()"
        [selectedServerTypeId]="serverTypeId()"
        [lockedProvider]="lockedProvider()"
        (providerSelected)="providerSelected.emit($event)"
        (regionSelected)="regionSelected.emit($event)"
        (serverTypeSelected)="serverTypeSelected.emit($event)"
      />
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        You choose the region and the node size in the next step, with prices per region.
      </p>
    </fieldset>

    @if (refusal(); as reason) {
      <fl-alert
        tone="error"
        title="This provider cannot host a workload cluster here yet"
        data-testid="provider-refused"
      >
        {{ reason }}
      </fl-alert>
    }
  `,
})
export class ClusterCreateStepInfrastructure {
  readonly name = input.required<FormControl<string>>();
  readonly generating = input(false);
  readonly provider = input('');
  readonly region = input('');
  readonly serverTypeId = input('');
  readonly lockedProvider = input<string | null>(null);
  readonly refusal = input<string | null>(null);
  readonly generate = output<void>();
  readonly providerSelected = output<string>();
  readonly regionSelected = output<string>();
  readonly serverTypeSelected = output<string>();

  private readonly revision = signal(0);

  protected readonly nameError = computed<string | null>(() => {
    this.revision();
    const control = this.name();
    const errors = control.errors;
    if (!errors || !control.touched) return null;
    if (errors['required']) return 'Enter a cluster name.';
    if (errors['minlength']) return 'Use at least 3 characters.';
    if (errors['nameExists']) return 'A cluster with this name already exists. Choose another.';
    if (errors['providerCollision']) return String(errors['providerCollision']);
    return null;
  });

  protected readonly nameHint = computed<string | undefined>(() => {
    this.revision();
    const control = this.name();
    if (control.pending) return 'Checking availability…';
    if (control.valid && control.value) return 'Name available';
    return 'At least 3 characters, unique across your clusters.';
  });

  constructor() {
    effect((onCleanup) => {
      const subscription = this.name().events.subscribe(() => this.revision.update((v) => v + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
