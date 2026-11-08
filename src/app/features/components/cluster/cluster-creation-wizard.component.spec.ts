import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';
import { AccessManagementService } from '../../../core/api/api/accessManagement.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { InfrastructureOperationsService } from '../../../core/api/api/infrastructureOperations.service';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { ProviderManagementService } from '../../../core/api/api/providerManagement.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterAutoscaleService } from '../../service/cluster-autoscale.service';
import { ClusterNameAvailabilityService } from '../../service/cluster-name-availability.service';
import { VNetService } from '../../service/vnet.service';
import { DnsZonesService } from '../../service/dns-zones.service';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { InfrastructureWebSocketService } from '../../service/infrastructure-websocket.service';
import { InstallLogService } from '../../service/install-log.service';
import { ProviderWizardService } from '../../../shared/services/provider-wizard.service';
import { IpDetectionService } from '../../../shared/services/ip-detection.service';
import { ClusterConfiguration } from '../../model/cluster.models';
import { ClusterCreationWizardComponent } from './cluster-creation-wizard.component';
import { AvailabilityChoice } from './cluster-availability-choice.component';

const threeLocations = (ready: boolean): AvailabilityChoice => ({
  level: 'three-locations',
  shapes: ['cpx22', 'cx23'],
  completeLater: true,
  servers: ready
    ? [
        { zone: 'fsn1', shape: 'cpx22', role: 'data', first: true },
        { zone: 'nbg1', shape: 'cx23', role: 'data', first: false },
        { zone: 'hel1', shape: 'cpx22', role: 'vote', first: false },
      ]
    : [],
  later: [],
  pricePerHour: ready ? 0.05 : null,
  ready,
});

describe('ClusterCreationWizardComponent across three locations', () => {
  let wizard: ClusterCreationWizardComponent;
  let createCluster: jasmine.Spy;

  beforeEach(fakeAsync(() => {
    createCluster = jasmine
      .createSpy('createCluster')
      .and.resolveTo({ operationId: 'op-1', clusterId: 'c-1' });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClusterService,
          useValue: { clusters: signal([]), createCluster, highAvailabilityPlan: jasmine.createSpy() },
        },
        { provide: ClusterAutoscaleService, useValue: {} },
        {
          provide: ClusterNameAvailabilityService,
          useValue: { check: () => Promise.resolve({ available: true }) },
        },
        {
          provide: ProviderWizardService,
          useValue: {
            serverTypesData: signal({
              'hetzner:fsn1': [{ id: 'cpx22', name: 'cpx22', pricePerHour: 0.02, architecture: 'x86' }],
            }),
            providersData: signal([]),
            regionsData: signal({}),
            sshKeysData: signal([]),
            getProviderDefinition: () => undefined,
          },
        },
        { provide: VNetService, useValue: {} },
        { provide: AccessManagementService, useValue: {} },
        { provide: ClusterDnsZoneService, useValue: {} },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: HttpClient, useValue: {} },
        { provide: AppConfigService, useValue: { apiBaseUrl: '' } },
        { provide: DnsZonesService, useValue: { zones: signal([]), loading: signal(false) } },
        { provide: IpDetectionService, useValue: {} },
      ],
    });
    wizard = TestBed.runInInjectionContext(() => new ClusterCreationWizardComponent());
    (wizard as unknown as { initializeForm(): void }).initializeForm();
    wizard.firewallConfigForm.patchValue({ enabled: false });
    wizard.basicConfigForm.patchValue({ name: 'ha-hz' });
    flush();
    wizard.selectedProvider.set('hetzner');
    wizard.selectedRegion.set('fsn1');
    wizard.selectedServerTypeId.set('cpx22');
  }));

  it('blocks the resources step and creation while the plan refuses', () => {
    wizard.availability.set(threeLocations(false));
    expect(wizard.wizardSteps()[1].isValid).toBeFalse();
    expect(wizard.canComplete()).toBeFalse();

    wizard.availability.set(threeLocations(true));
    expect(wizard.wizardSteps()[1].isValid).toBeTrue();
    expect(wizard.canComplete()).toBeTrue();
  });

  it('costs the servers the plan buys', () => {
    wizard.availability.set(threeLocations(true));
    expect(wizard.costedNodes()).toBe(3);
    expect(wizard.getEstimatedMonthlyCost()).toBe((0.05 * 730).toFixed(2));
  });

  it('creates with the chosen sizes and the first location', fakeAsync(() => {
    wizard.availability.set(threeLocations(true));
    void wizard.createCluster();
    flush();

    expect(createCluster).toHaveBeenCalledTimes(1);
    const config = createCluster.calls.mostRecent().args[0] as ClusterConfiguration;
    expect(config.region).toBe('fsn1');
    expect(config.nodeTypeId).toBe('cpx22');
    expect(config.highAvailability).toEqual({ shapes: ['cpx22', 'cx23'], completeLater: true });
  }));

  it('creates a standard cluster without the three-location fields', fakeAsync(() => {
    void wizard.createCluster();
    flush();

    const config = createCluster.calls.mostRecent().args[0] as ClusterConfiguration;
    expect(config.highAvailability).toBeUndefined();
    expect(config.minNodes).toBe(1);
  }));
});

describe('ClusterService.createCluster across three locations', () => {
  let create: jasmine.Spy;
  let service: ClusterService;

  beforeEach(() => {
    create = jasmine
      .createSpy('clustersControllerCreateCluster')
      .and.returnValue(of({ operation_id: 'op-1', cluster_id: 'c-1' }));
    TestBed.configureTestingModule({
      providers: [
        { provide: InfrastructureClustersService, useValue: { clustersControllerCreateCluster: create } },
        {
          provide: InfrastructureOperationsService,
          useValue: { infrastructureOperationsControllerGetOperationStatus: () => NEVER },
        },
        { provide: VirtualInstancesService, useValue: {} },
        { provide: ProviderManagementService, useValue: {} },
        {
          provide: InfrastructureWebSocketService,
          useValue: { subscribeToOperation: () => undefined, unsubscribeFromOperation: () => undefined },
        },
        { provide: InstallLogService, useValue: {} },
        { provide: SandboxService, useValue: {} },
      ],
    });
    service = TestBed.inject(ClusterService);
  });

  const base: ClusterConfiguration = {
    name: 'ha-hz',
    provider: 'hetzner' as ClusterConfiguration['provider'],
    region: 'fsn1',
    nodeTypeId: 'cpx22',
    minNodes: 3,
    maxNodes: 3,
  };

  it('sends three-locations with the sizes, complete-later and no workers', async () => {
    await service.createCluster({
      ...base,
      highAvailability: { shapes: ['cpx22', 'cx23'], completeLater: true },
    });

    const dto = create.calls.mostRecent().args[0];
    expect(dto).toEqual(
      jasmine.objectContaining({
        region: 'fsn1',
        nodeSize: 'cpx22',
        workerCount: 0,
        highAvailability: 'three-locations',
        shapes: ['cpx22', 'cx23'],
        completeLater: true,
      }),
    );
    expect(dto.minNodes).toBeUndefined();
    expect(dto.maxNodes).toBeUndefined();
  });

  it('leaves a standard cluster as it was', async () => {
    await service.createCluster({ ...base, minNodes: 2, maxNodes: 2 });

    const dto = create.calls.mostRecent().args[0];
    expect(dto.highAvailability).toBeUndefined();
    expect(dto.shapes).toBeUndefined();
    expect(dto.minNodes).toBe(2);
  });
});
