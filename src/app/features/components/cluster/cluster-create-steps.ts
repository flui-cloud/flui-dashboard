import { computed, signal } from '@angular/core';
import { WizardStep } from '../../model/cluster.models';
import { WizardStep as FlWizardStep } from '../../../ui/patterns/wizard-steps';
import { ClusterCreateState } from './cluster-create.state';

export const EDITABLE_STEPS = [
  'infrastructure',
  'resources',
  'ssh-keys',
  'network',
  'endpoint',
  'firewall',
];

export class ClusterCreateSteps {
  readonly currentStepIndex = signal<number>(0);

  constructor(private readonly state: ClusterCreateState) {}

  readonly wizardSteps = computed<WizardStep[]>(() => {
    const currentIndex = this.currentStepIndex();
    const state = this.state;

    return [
      {
        id: 'infrastructure',
        title: 'Infrastructure',
        description: 'Configure name and provider',
        icon: 'lucideSettings',
        isValid: state.formValid() && !!state.selectedProvider() && !state.providerRefusal(),
        isCompleted: currentIndex > 0 && state.formValid() && !!state.selectedProvider(),
      },
      {
        id: 'resources',
        title: 'Resources',
        description: 'Choose region, node size and scaling',
        icon: 'lucideServer',
        isValid:
          !!state.selectedRegion() && !!state.selectedServerTypeId() && state.availability().ready,
        isCompleted: currentIndex > 1 && !!state.selectedRegion() && !!state.selectedServerTypeId(),
      },
      {
        id: 'ssh-keys',
        title: 'SSH key',
        description: 'Configure secure access',
        icon: 'lucideKey',
        isValid: true,
        isCompleted: currentIndex > 2,
      },
      {
        id: 'network',
        title: 'Network',
        description: state.vnetRequired()
          ? 'Configure virtual network'
          : 'Configure virtual network (optional)',
        icon: 'lucideNetwork',
        isValid: state.isNetworkStepValid(),
        isCompleted: currentIndex > 3,
      },
      {
        id: 'endpoint',
        title: 'Endpoint',
        description: 'Test addresses or your own domain',
        icon: 'lucideZap',
        isValid: !!state.endpointHostnameMode(),
        isCompleted: currentIndex > 4,
      },
      {
        id: 'firewall',
        title: 'Firewall',
        description: 'Configure firewall rules and source IPs',
        icon: 'lucideShield',
        isValid: state.firewallConfigForm?.valid ?? true,
        isCompleted: currentIndex > 5,
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review and create cluster',
        icon: 'lucideCheck',
        isValid: state.canComplete(),
        isCompleted: false,
      },
    ];
  });

  readonly stepList = computed<FlWizardStep[]>(() => {
    const state = this.state;
    const summaries: Record<string, string> = {
      infrastructure: [state.getClusterName(), state.getSelectedProviderName()]
        .filter(Boolean)
        .join(' · '),
      resources: [state.getSelectedRegionName(), state.selectedServerType()?.name]
        .filter(Boolean)
        .join(' · '),
    };
    return this.wizardSteps().map((step) => ({ name: step.title, summary: summaries[step.id] }));
  });

  nextStep(): void {
    if (this.canProceedFromCurrentStep()) {
      this.currentStepIndex.update((index) => Math.min(index + 1, this.wizardSteps().length - 1));
    }
  }

  previousStep(): void {
    this.currentStepIndex.update((index) => Math.max(index - 1, 0));
  }

  goToStep(index: number): void {
    if (index >= 0 && index < this.currentStepIndex()) this.currentStepIndex.set(index);
  }

  editStep(stepId: string): void {
    this.goToStep(this.wizardSteps().findIndex((step) => step.id === stepId));
  }

  canProceedFromCurrentStep(): boolean {
    const step = this.wizardSteps()[this.currentStepIndex()];
    return step?.isValid || false;
  }
}
