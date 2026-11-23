import {
  Component,
  effect,
  inject,
  output,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';
import { SshKeySelectorComponent } from '../../../shared/components/ssh-key-selector/ssh-key-selector.component';
import { IpDetectionService } from '../../../shared/services/ip-detection.service';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlWizardSteps } from '../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { ClusterCreateStepInfrastructure } from './cluster-create-step-infrastructure';
import { ClusterCreateStepResources } from './cluster-create-step-resources';
import { ClusterCreateStepNetwork } from './cluster-create-step-network';
import { ClusterCreateStepEndpoint } from './cluster-create-step-endpoint';
import { ClusterCreateStepFirewall } from './cluster-create-step-firewall';
import { ClusterCreateStepReview } from './cluster-create-step-review';
import { ClusterCreateState } from './cluster-create.state';
import { ClusterCreateProvider } from './cluster-create-provider';
import { ClusterCreateNetwork } from './cluster-create-network.service';
import { ClusterCreateFirewall } from './cluster-create-firewall';
import { ClusterCreateSteps, EDITABLE_STEPS } from './cluster-create-steps';
import { ClusterCreateOutcome, ClusterCreateSubmit } from './cluster-create-submit';

@Component({
  selector: 'cluster-creation-wizard',
  imports: [
    SshKeySelectorComponent,
    FlAlert,
    FlPageHeader,
    FlPanel,
    FlWizardSteps,
    FlButton,
    FlSpinner,
    ClusterCreateStepInfrastructure,
    ClusterCreateStepResources,
    ClusterCreateStepNetwork,
    ClusterCreateStepEndpoint,
    ClusterCreateStepFirewall,
    ClusterCreateStepReview,
  ],
  templateUrl: './cluster-creation-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ClusterCreationWizardComponent implements OnInit {
  private readonly router = inject(Router);
  readonly ipDetectionService = inject(IpDetectionService);

  protected readonly state = new ClusterCreateState();
  protected readonly provider = new ClusterCreateProvider(this.state);
  protected readonly network = new ClusterCreateNetwork(this.state);
  protected readonly firewall = new ClusterCreateFirewall(this.state);
  protected readonly steps = new ClusterCreateSteps(this.state);
  protected readonly submit = new ClusterCreateSubmit(this.state, this.firewall);

  completeOutput = output<ClusterCreateOutcome>();
  cancelled = output<void>();

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Clusters', link: '/cluster' },
    { label: 'Create cluster' },
  ];
  protected readonly editableSteps = EDITABLE_STEPS;

  readonly dnsZonesService = this.state.dnsZonesService;
  readonly pricingService = this.state.pricingService;
  readonly selectedProvider = this.state.selectedProvider;
  readonly selectedRegion = this.state.selectedRegion;
  readonly selectedServerTypeId = this.state.selectedServerTypeId;
  readonly availability = this.state.availability;
  readonly costedNodes = this.state.costedNodes;
  readonly currentStepIndex = this.steps.currentStepIndex;
  readonly wizardSteps = this.steps.wizardSteps;
  readonly isCreating = this.submit.isCreating;
  readonly createError = this.submit.createError;

  get basicConfigForm(): FormGroup {
    return this.state.basicConfigForm;
  }

  get firewallConfigForm(): FormGroup {
    return this.state.firewallConfigForm;
  }

  protected get nameControl(): FormControl<string> {
    return this.state.basicConfigForm.get('name') as FormControl<string>;
  }

  constructor() {
    effect(() => {
      const locked = this.state.lockedProvider();
      if (locked && this.state.selectedProvider() !== locked) {
        untracked(() => this.provider.onProviderSelected(locked));
      }
    });
  }

  ngOnInit(): void {
    void (async () => {
      this.initializeForm();
      await this.firewall.initializeFirewall();
      await this.provider.loadAutoscaleDefaults();
      await this.provider.loadCatalog();

      const form = this.state.basicConfigForm;
      form.statusChanges.subscribe(() => {
        this.state.formValid.set(form.valid);
      });

      this.state.formValid.set(form.valid);
    })();
  }

  private initializeForm(): void {
    this.state.initializeForms(this.provider.nameValidator());
  }

  canComplete(): boolean {
    return this.state.canComplete();
  }

  getEstimatedMonthlyCost(): string {
    return this.state.getEstimatedMonthlyCost();
  }

  navigateBack(): void {
    this.router.navigate(['/cluster']);
  }

  createCluster(): Promise<void> {
    return this.submit.createCluster((outcome) => this.completeOutput.emit(outcome));
  }
}
