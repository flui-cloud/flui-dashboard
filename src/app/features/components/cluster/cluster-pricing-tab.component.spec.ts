import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { ClusterPricingTabComponent } from './cluster-pricing-tab.component';
import { ClusterService } from '../../service/cluster.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { ClusterBilling, NodeMtd, groupNodes, vatLabel } from './cluster-pricing-view';

const breakdown = (compute: string, storage: string) => ({
  computeGross: compute,
  computeNet: compute,
  storageGross: storage,
  storageNet: storage,
  trafficGross: '0.0000',
  trafficNet: '0.0000',
});

const node = (name: string, status: 'active' | 'terminated', cost: string): NodeMtd => ({
  nodeId: name,
  serverName: name,
  nodeType: name.includes('master') ? 'master' : 'worker',
  currentServerType: 'cx23',
  providerResourceId: null,
  status,
  billableHours: 10,
  costGross: cost,
  costNet: cost,
  segments: [],
});

const BILLING: ClusterBilling = {
  clusterId: 'c1',
  clusterName: 'control-cluster-staging-hz',
  provider: 'hetzner',
  region: 'fsn1',
  currency: 'EUR',
  billingPeriod: {
    start: '2026-09-01T00:00:00.000Z',
    end: '2026-09-30T23:59:59.999Z',
    totalHours: 720,
    elapsedHours: 614,
  },
  monthToDate: {
    totalGross: '11.2400',
    totalNet: '9.4454',
    breakdown: breakdown('10.4900', '0.7500'),
    nodes: [
      node('control-master', 'active', '10.1900'),
      ...Array.from({ length: 15 }, (_, i) => node(`worker-${i}`, 'terminated', '0.0200')),
    ],
    volumes: [],
    traffic: {
      outgoingBytes: 0,
      ingoingBytes: 0,
      includedBytes: 0,
      overageBytes: 0,
      overageCostGross: '0.0000',
      overageCostNet: '0.0000',
    },
  },
  runRate: {
    monthlyGross: '11.24',
    monthlyNet: '9.45',
    breakdown: breakdown('10.36', '0.88'),
    activeNodes: 1,
    activeVolumes: 1,
  },
  forecast: {
    totalGross: '11.3900',
    totalNet: '9.5700',
    breakdown: breakdown('10.51', '0.88'),
    remainingHours: 105,
  },
  vat: { included: true, ratePercent: '19' },
  billedAs: 'Billed by the hour, never more than the monthly price in one month',
  unpricedItems: 0,
  listPricedItems: 16,
  calculatedAt: '2026-09-26T14:00:00.000Z',
};

describe('the Pricing tab', () => {
  const render = async (billing: ClusterBilling) => {
    await TestBed.configureTestingModule({
      imports: [ClusterPricingTabComponent],
      providers: [
        provideRouter([]),
        { provide: ClusterService, useValue: { cluster: signal({ id: 'c1' }) } },
        {
          provide: InfrastructureClustersService,
          useValue: { clustersControllerGetClusterBilling: () => of(billing) },
        },
        { provide: MaskModeService, useValue: { enabled: () => false } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ClusterPricingTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  };

  it('shows the spend so far, the forecast to the month end and the monthly cost apart', async () => {
    const text = await render(BILLING);
    expect(text).toContain('Spent so far');
    expect(text).toContain('€11.24');
    expect(text).toContain('Expected by month end');
    expect(text).toContain('€11.39');
    expect(text).toContain('Monthly cost of this setup');
    expect(text).toContain('incl. 19% VAT');
    expect(text).not.toContain('Run rate');
  });

  it('writes every amount with two decimals', async () => {
    const text = await render(BILLING);
    expect(text).not.toMatch(/€\d+\.\d{3,}/);
    expect(text).not.toMatch(/EUR \d/);
  });

  it('folds the machines removed this month into one line', async () => {
    const text = await render(BILLING);
    expect(text).toContain('Machines (1)');
    expect(text).toContain('15 removed this month');
    expect(text).toContain('€0.30');
    expect(text).not.toContain('worker-3');
  });

  it('says excl. VAT where the provider publishes no rate', () => {
    expect(vatLabel({ ...BILLING, vat: { included: false, ratePercent: null } })).toBe('excl. VAT');
    const groups = groupNodes(BILLING.monthToDate.nodes);
    expect(groups.active).toHaveSize(1);
    expect(groups.removedGross).toBeCloseTo(0.3, 6);
  });
});
