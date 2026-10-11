import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProviderConfigurationWizardComponent } from './provider-configuration-wizard.component';
import { ProvidersService } from '../../service/providers.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ProviderDefinitionDto } from '../../../core/api';

const SCALEWAY = {
  id: 'scaleway',
  name: 'scaleway',
  displayName: 'Scaleway',
  description: 'French cloud provider',
  logoUrl: '',
  websiteUrl: 'https://www.scaleway.com',
  documentationUrl: 'https://www.scaleway.com/en/developers/',
  accessKeyDocumentationUrl: 'https://www.scaleway.com/en/docs/iam/',
  enabled: true,
  configurationSchema: {},
  capabilities: {
    supportedInstanceTypes: [],
    supportedRegions: [],
    credentialType: 'api_key',
    features: {
      loadBalancers: true,
      privateNetworking: true,
      snapshots: true,
      backups: true,
      dnsZones: true,
      nodeProvisioning: true,
    },
    firewall: { backend: 'managed-api', managedEdge: true, supportsSshAllowlist: true },
    pricing: { currency: 'EUR', billingCycle: 'hourly', minimumCost: 0.0088 },
    vnetRequired: true,
    crossClusterAllowed: false,
  },
  credentialFields: {
    type: 'access_key_secret',
    supportsExpiry: true,
    fields: [
      { key: 'accessKey', label: 'Access Key ID', providerLabel: 'Access Key ID', hint: 'IAM', secret: false, required: true },
      { key: 'secretKey', label: 'Secret Key', providerLabel: 'Secret Key', hint: 'IAM', secret: true, required: true },
    ],
  },
} as unknown as ProviderDefinitionDto;

const REGIONS = [
  { id: 'fr-par', name: 'Paris', displayName: 'Paris, France', available: true },
  { id: 'nl-ams', name: 'Amsterdam', displayName: 'Amsterdam, Netherlands', available: true },
];

describe('ProviderConfigurationWizardComponent', () => {
  const build = async (guest: boolean) => {
    const providers = {
      getProviderRegions: jasmine.createSpy('getProviderRegions').and.resolveTo(REGIONS),
      validateProvider: jasmine.createSpy('validateProvider').and.resolveTo({ success: true }),
      configureProvider: jasmine.createSpy('configureProvider').and.resolveTo({}),
    };
    TestBed.configureTestingModule({
      imports: [ProviderConfigurationWizardComponent],
      providers: [
        { provide: ProvidersService, useValue: providers },
        { provide: SandboxService, useValue: { inSandbox: signal(guest) } },
      ],
    });
    const fixture = TestBed.createComponent(ProviderConfigurationWizardComponent);
    fixture.componentRef.setInput('provider', SCALEWAY);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = async (testId: string) => {
      (el.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, providers, click };
  };

  describe('for a demo guest', () => {
    it('shows every credential field, empty and disabled, with a placeholder', async () => {
      const { el } = await build(true);
      const inputs = Array.from(el.querySelectorAll('input[id^="credential-"]')) as HTMLInputElement[];
      const fields = inputs.filter((i) => i.id !== 'credential-expiry');

      expect(fields).toHaveSize(2);
      for (const input of fields) {
        expect(input.disabled).toBeTrue();
        expect(input.value).toBe('');
        expect(input.placeholder).toBe('Entered in your own installation');
      }
    });

    it('walks every step and ends without sending anything', async () => {
      const { el, providers, click, fixture } = await build(true);

      await click('wizard-next');
      expect(el.querySelector('[data-testid="wizard-demo-check"]')).not.toBeNull();

      await click('wizard-next');
      (el.querySelector('[data-testid="wizard-region-fr-par"] input') as HTMLInputElement).click();
      fixture.detectChanges();

      await click('wizard-complete');

      const end = el.querySelector('[data-testid="wizard-demo-end"]');
      expect(end?.textContent).toContain('In the demo, nothing is connected.');
      expect(end?.textContent).toContain('Install Flui to connect your Scaleway account.');
      expect(providers.validateProvider).not.toHaveBeenCalled();
      expect(providers.configureProvider).not.toHaveBeenCalled();
    });
  });

  it('asks an operator for the credentials before going on', async () => {
    const { el } = await build(false);
    const next = el.querySelector('[data-testid="wizard-next"]') as HTMLButtonElement;
    const field = el.querySelector('#credential-accessKey') as HTMLInputElement;

    expect(field.disabled).toBeFalse();
    expect(field.placeholder).toBe('');
    expect(next.disabled).toBeTrue();
  });
});
