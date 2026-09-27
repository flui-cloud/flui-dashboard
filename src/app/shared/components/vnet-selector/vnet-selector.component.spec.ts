import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VNetService } from '../../../features/service/vnet.service';
import { ProviderWizardService } from '../../services/provider-wizard.service';
import { VNetSelectorComponent } from './vnet-selector.component';

const topology = (over: Record<string, unknown> = {}) => ({
  scope: 'regional',
  zones: [],
  supportsSubnets: true,
  vnetIpRange: null,
  subnetIpRange: null,
  ...over,
});

describe('a new network from the cluster wizard', () => {
  let fixture: ComponentFixture<VNetSelectorComponent>;
  let createVNet: jasmine.Spy;

  const build = async (vnetTopology: ReturnType<typeof topology>, region: string): Promise<void> => {
    createVNet = jasmine.createSpy('createVNet').and.resolveTo({ id: 'v1', name: 'n', subnets: [] });
    await TestBed.configureTestingModule({
      imports: [VNetSelectorComponent],
      providers: [
        {
          provide: VNetService,
          useValue: {
            vnets: signal([]),
            loadVNets: () => Promise.resolve(),
            getOccupiedSubnets: () => Promise.resolve([]),
            createVNet,
          },
        },
        {
          provide: ProviderWizardService,
          useValue: {
            loadProviders: () => Promise.resolve(),
            getProviderDefinition: () => ({ capabilities: { vnetTopology } }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VNetSelectorComponent);
    fixture.componentRef.setInput('provider', 'ovh');
    fixture.componentRef.setInput('region', region);
    fixture.detectChanges();
  };

  it('goes to the region the cluster runs in, where networks are regional and no zone is listed', async () => {
    await build(topology(), 'GRA');
    const selector = fixture.componentInstance;
    await selector.openCreateForm();
    expect(selector.newSubnetZone).toBe('GRA');
    selector.newVnetName = 'edge';
    selector.newIpRange = '10.44.0.0/16';
    await selector.submitCreateVNet();
    expect(createVNet).toHaveBeenCalledWith(
      jasmine.objectContaining({
        subnet: jasmine.objectContaining({ networkZone: 'GRA', ipRange: '10.44.0.0/24' }),
      }),
    );
  });

  it('keeps the provider’s own zone where it lists them', async () => {
    await build(topology({ zones: [{ id: 'eu-central', displayName: 'Europe' }] }), 'nbg1');
    const selector = fixture.componentInstance;
    await selector.openCreateForm();
    expect(selector.newSubnetZone).toBe('eu-central');
  });
});
