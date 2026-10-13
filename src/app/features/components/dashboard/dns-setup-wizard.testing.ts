import { Provider, signal } from '@angular/core';
import { DnsZonesService, DnsCapableProvider } from '../../service/dns-zones.service';
import { ClusterDnsZoneService, SystemHostnames, SystemHostnamesCheck } from '../../service/cluster-dns-zone.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRuntimeWebSocketService } from '../../service/app-runtime-websocket.service';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { ClusterDNSZoneService as ClusterDNSZoneApiService } from '../../../core/api/api/clusterDNSZone.service';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { SANCertificatesService } from '../../../core/api/api/sANCertificates.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { DnsZoneResponseDto } from '../../../core/api/model/dnsZoneResponseDto';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { ProviderZone } from '../../model/dns.models';
import { DnsSetupWizardService } from './dns-setup-wizard.service';

export interface WizardFakes {
  registered?: Partial<DnsZoneResponseDto>[];
  supported?: string[];
  capable?: DnsCapableProvider[];
  providerZones?: Record<string, ProviderZone[] | Error>;
  assignment?: Partial<ClusterDnsZoneResponseDto> | null;
  hostnames?: SystemHostnames;
  check?: SystemHostnamesCheck;
  appEndpoints?: object;
}

export function wizardProviders(fakes: WizardFakes = {}) {
  const zones = signal((fakes.registered ?? []) as DnsZoneResponseDto[]);
  const providers = signal<string[]>([]);
  const capable = signal<DnsCapableProvider[]>([]);
  const error = signal<string | null>(null);
  const assignment = signal((fakes.assignment ?? null) as ClusterDnsZoneResponseDto | null);

  const dnsZones = {
    zones,
    providers,
    dnsCapableProviders: capable,
    error,
    loadZones: jasmine.createSpy('loadZones').and.resolveTo(),
    loadProviders: jasmine.createSpy('loadProviders').and.callFake(async () => providers.set(fakes.supported ?? [])),
    loadDnsCapableProviders: jasmine.createSpy('loadDnsCapableProviders').and.callFake(async () => capable.set(fakes.capable ?? [])),
    fetchProviderZones: jasmine.createSpy('fetchProviderZones').and.callFake(async (provider: string) => {
      const found = fakes.providerZones?.[provider];
      if (found instanceof Error) throw found;
      return found ?? [];
    }),
    registerZone: jasmine.createSpy('registerZone').and.callFake(async (dto: { zoneName: string; providerZoneId?: string; dnsProvider: string }) => {
      const zone = { id: `reg-${dto.zoneName}`, zoneName: dto.zoneName, providerZoneId: dto.providerZoneId, dnsProvider: dto.dnsProvider } as DnsZoneResponseDto;
      zones.update(list => [...list, zone]);
      return zone;
    }),
  };

  const clusterDnsZone = {
    assignment,
    error: signal<string | null>(null),
    loadAssignment: jasmine.createSpy('loadAssignment').and.resolveTo(),
    getIssuers: jasmine.createSpy('getIssuers').and.resolveTo([]),
    getSystemHostnames: jasmine.createSpy('getSystemHostnames').and.callFake(async () => fakes.hostnames ?? { zoneName: null, hostnames: [] }),
    checkSystemHostnames: jasmine.createSpy('checkSystemHostnames').and.callFake(async () => fakes.check ?? { ok: true, result: { zoneName: null, hostnames: [] } }),
  };

  const providersList: Provider[] = [
    DnsSetupWizardService,
    { provide: DnsZonesService, useValue: dnsZones },
    { provide: ClusterDnsZoneService, useValue: clusterDnsZone },
    { provide: AppEndpointsService, useValue: fakes.appEndpoints ?? {} },
    { provide: AppRuntimeWebSocketService, useValue: {} },
    { provide: DNSZonesService, useValue: {} },
    { provide: InfrastructureClustersService, useValue: {} },
    { provide: ClusterDNSZoneApiService, useValue: {} },
    { provide: ApplicationsService, useValue: {} },
    { provide: SANCertificatesService, useValue: {} },
    { provide: AppConfigService, useValue: { certificateMode: 'production' } },
  ];
  return { providers: providersList, dnsZones, clusterDnsZone };
}
