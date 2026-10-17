import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegionServerSelectorComponent } from './region-server-selector.component';
import { ARM_WARNING } from '../architecture-badge.component';
import {
  ProviderRegion,
  ProviderWizardService,
  ServerTypeOption,
} from '../../services/provider-wizard.service';

function size(id: string, architecture: 'x86' | 'arm', pricePerHour: number): ServerTypeOption {
  return {
    id,
    name: id,
    vcpu: 2,
    ram: 4,
    disk: 40,
    storageType: 'local',
    pricePerHour,
    cpuType: 'shared',
    architecture,
    bareMetal: false,
    managedFirewall: true,
    supportsHourlyBilling: true,
    blockStoragePricePerGbMonthly: null,
  };
}

const REGION: ProviderRegion = {
  id: 'fsn1',
  name: 'Falkenstein',
  country: 'DE',
  flagEmoji: '',
  available: true,
};

describe('the node size picker', () => {
  let fixture: ComponentFixture<RegionServerSelectorComponent>;

  const card = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`[data-testid="server-type-${id}"]`);

  function render(types: ServerTypeOption[], selected = ''): void {
    const wizard = {
      isRegionLoading: signal(false),
      isServerTypeLoading: signal(false),
      serverTypeError: signal<string | null>(null),
      regionsData: signal({ hetzner: [REGION] }),
      serverTypesData: signal({ 'hetzner:fsn1': types }),
      loadServerTypesAllRegions: () => Promise.resolve([REGION]),
    };
    TestBed.configureTestingModule({
      imports: [RegionServerSelectorComponent],
      providers: [{ provide: ProviderWizardService, useValue: wizard }],
    });
    fixture = TestBed.createComponent(RegionServerSelectorComponent);
    fixture.componentRef.setInput('selectedProvider', 'hetzner');
    fixture.componentRef.setInput('selectedRegion', 'fsn1');
    fixture.componentRef.setInput('selectedServerTypeId', selected);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('names the architecture on every size', () => {
    render([size('cx23', 'x86', 0.005)]);
    expect(card('cx23').querySelector('[data-testid="architecture-badge"]')?.textContent?.trim()).toBe('x86');
    expect(card('cx23').disabled).toBeFalse();
    expect(card('cx23').getAttribute('title')).toBeNull();
  });

  it('offers an arm size, with the warning on hover', () => {
    render([size('cx23', 'x86', 0.005), size('cax21', 'arm', 0.006)]);
    const arm = card('cax21');
    expect(arm.disabled).toBeFalse();
    expect(arm.getAttribute('title')).toBe(ARM_WARNING);
    expect(arm.querySelector('[data-testid="architecture-badge"]')?.textContent?.trim()).toBe('Arm');
  });

  it('selects an arm size', () => {
    render([size('cax21', 'arm', 0.006)]);
    const picked: string[] = [];
    fixture.componentInstance.serverTypeSelected.subscribe((id) => picked.push(id));
    fixture.componentInstance.selectServerType(size('cax21', 'arm', 0.006));
    expect(picked).toEqual(['cax21']);
  });

  it('warns under the sizes once an arm size is selected', () => {
    render([size('cx23', 'x86', 0.005), size('cax21', 'arm', 0.006)], 'cax21');
    expect(fixture.nativeElement.querySelector('[data-testid="architecture-warning"]')?.textContent?.trim()).toBe(
      ARM_WARNING,
    );
  });

  it('says nothing about architecture when an x86 size is selected', () => {
    render([size('cx23', 'x86', 0.005), size('cax21', 'arm', 0.006)], 'cx23');
    expect(fixture.nativeElement.querySelector('[data-testid="architecture-warning"]')).toBeNull();
  });

  it('prices a region from every size, arm included', () => {
    render([size('cax11', 'arm', 0.001), size('cx23', 'x86', 0.005)]);
    expect(fixture.componentInstance.cheapestByRegion()['fsn1']).toBe(0.001);
  });
});
