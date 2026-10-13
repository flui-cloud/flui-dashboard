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

  const build = async (
    vnetTopology: ReturnType<typeof topology>,
    region: string,
    vnets: unknown[] = [],
    provider = 'ovh',
  ): Promise<void> => {
    createVNet = jasmine.createSpy('createVNet').and.resolveTo({ id: 'v1', name: 'n', subnets: [] });
    await TestBed.configureTestingModule({
      imports: [VNetSelectorComponent],
      providers: [
        {
          provide: VNetService,
          useValue: {
            vnets: signal(vnets),
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
    fixture.componentRef.setInput('provider', provider);
    fixture.componentRef.setInput('region', region);
    fixture.detectChanges();
    await fixture.whenStable();
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

  const scaleway = topology({
    supportsSubnets: false,
    zones: [
      { id: 'fr-par', displayName: 'Paris', coveredRegions: ['fr-par'] },
      { id: 'nl-ams', displayName: 'Amsterdam', coveredRegions: ['nl-ams'] },
    ],
  });
  const parisNetwork = {
    id: 'v-par',
    name: 'scaleway-fr-par',
    provider: 'scaleway',
    ipRange: '10.2.0.0/24',
    status: 'ACTIVE',
    subnets: [{ id: 's1', ipRange: '10.2.0.0/24', networkZone: 'fr-par', servedRegions: ['fr-par'], attachedServerIds: [] }],
  };

  it('puts a new network in the zone that covers the cluster’s region, and says so to the API', async () => {
    await build(scaleway, 'nl-ams', [], 'scaleway');
    const selector = fixture.componentInstance;
    await selector.openCreateForm();
    expect(selector.newSubnetZone).toBe('nl-ams');
    selector.newVnetName = 'edge';
    selector.newIpRange = '10.44.0.0/24';
    await selector.submitCreateVNet();
    expect(createVNet).toHaveBeenCalledWith(jasmine.objectContaining({ networkZone: 'nl-ams' }));
  });

  it('shows a network from another region but does not let it be picked', async () => {
    await build(scaleway, 'nl-ams', [parisNetwork], 'scaleway');
    const selector = fixture.componentInstance;
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="vnet-card-scaleway-fr-par"]');

    card.click();
    fixture.detectChanges();

    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(selector.selectedVNet()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="vnet-other-region"]').textContent).toContain('fr-par');
  });

  it('lets the same network be picked in its own region', async () => {
    await build(scaleway, 'fr-par', [parisNetwork], 'scaleway');
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="vnet-card-scaleway-fr-par"]');

    card.click();

    expect(fixture.componentInstance.selectedVNet()?.id).toBe('v-par');
  });
});
