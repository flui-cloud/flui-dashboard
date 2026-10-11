import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProviderCardComponent } from './provider-card.component';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { credentialKind, providerCapabilities, providerState } from './provider-presentation';

const OVH = {
  id: 'ovh',
  name: 'ovh',
  displayName: 'OVHcloud',
  description: 'OpenStack-based European public cloud',
  logoUrl: '',
  websiteUrl: 'https://www.ovhcloud.com',
  documentationUrl: 'https://help.ovhcloud.com',
  enabled: true,
  configurationSchema: {},
  capabilities: {
    supportedInstanceTypes: [],
    supportedRegions: [
      { id: 'GRA', name: 'Gravelines', displayName: 'Gravelines, France', available: true },
      { id: 'WAW', name: 'Warsaw', displayName: 'Warsaw, Poland', available: true },
    ],
    credentialType: 'api_key',
    features: {
      loadBalancers: false,
      privateNetworking: true,
      snapshots: false,
      backups: true,
      dnsZones: false,
      nodeProvisioning: true,
    },
    firewall: { backend: 'host-nftables', managedEdge: false, supportsSshAllowlist: false },
    pricing: { currency: 'EUR', billingCycle: 'hourly', minimumCost: 0.0104 },
    vnetRequired: true,
    crossClusterAllowed: false,
  },
  credentialFields: { type: 'access_key_secret', supportsExpiry: false, fields: [] },
} as unknown as ProviderDefinitionDto;

describe('provider presentation', () => {
  it('says what state a provider is in, in words', () => {
    expect(providerState(undefined)).toEqual({ label: 'Not connected', tone: 'muted' });
    expect(providerState('active')).toEqual({ label: 'Connected', tone: 'ok' });
    expect(providerState('error').tone).toBe('danger');
  });

  it('reads the credential the form asks for before the older capability flag', () => {
    expect(credentialKind(OVH)).toBe('access_key_secret');
  });

  it('lists what a provider can do, and what it cannot', () => {
    const items = providerCapabilities(OVH);
    expect(items.find((i) => i.key === 'machines')?.on).toBeTrue();
    expect(items.find((i) => i.key === 'firewall')?.on).toBeFalse();
    expect(items.find((i) => i.key === 'dns')?.on).toBeFalse();
  });
});

describe('ProviderCardComponent', () => {
  const build = (configuration?: Partial<ProviderConfigurationDto>) => {
    TestBed.configureTestingModule({
      imports: [ProviderCardComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ProviderCardComponent);
    fixture.componentRef.setInput('provider', OVH);
    if (configuration) fixture.componentRef.setInput('configuration', configuration);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('offers to connect a provider nobody connected', () => {
    const { el, fixture } = build();
    const emitted: string[] = [];
    fixture.componentInstance.configure.subscribe((id) => emitted.push(id));

    expect(el.querySelector('[data-testid="provider-state"]')?.textContent).toContain('Not connected');
    expect(el.textContent).toContain('Key and secret');
    (el.querySelector('[data-testid="provider-connect"]') as HTMLButtonElement).click();

    expect(emitted).toEqual(['ovh']);
  });

  it('colours nothing but the state', () => {
    const { el } = build({ status: 'active', enabledRegions: ['GRA'] } as Partial<ProviderConfigurationDto>);
    const coloured = Array.from(el.querySelectorAll('[class*="text-green"], [class*="text-orange"], [class*="text-purple"], [class*="text-blue"]'));

    expect(coloured.map((node) => node.getAttribute('data-testid'))).toEqual(['provider-state']);
    expect(el.textContent).toContain('Connected');
  });
});
