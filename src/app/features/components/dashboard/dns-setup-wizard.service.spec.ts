import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DnsSetupWizardService, wildcardLabelHint } from './dns-setup-wizard.service';
import { WizardFakes, wizardProviders } from './dns-setup-wizard.testing';

const HETZNER = { id: 'hetzner', displayName: 'Hetzner' };

function setup(fakes: WizardFakes) {
  const built = wizardProviders(fakes);
  TestBed.configureTestingModule({ providers: built.providers });
  return { ...built, wiz: TestBed.inject(DnsSetupWizardService) };
}

describe('DnsSetupWizardService', () => {
  describe('zone choice', () => {
    it('offers registered zones and the provider zones not registered yet', async () => {
      const { wiz } = setup({
        registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
        supported: ['hetzner', 'scaleway'],
        capable: [HETZNER],
        providerZones: { hetzner: [{ zoneId: 'p1', name: 'flui.cloud' }, { zoneId: 'p2', name: 'example.org' }] },
      });

      await wiz.init('c-1');

      expect(wiz.zoneOptions().map(o => [o.zoneName, o.registeredId])).toEqual([
        ['flui.cloud', 'z1'],
        ['example.org', null],
      ]);
      expect(wiz.configuredDnsProviders()).toEqual(['hetzner']);
    });

    it('reads only configured providers and names the ones it could not read', async () => {
      const { wiz, dnsZones } = setup({
        supported: ['hetzner', 'scaleway'],
        capable: [HETZNER, { id: 'scaleway', displayName: 'Scaleway' }],
        providerZones: { hetzner: [{ zoneId: 'p2', name: 'example.org' }], scaleway: new Error('denied') },
      });

      await wiz.init('c-1');

      expect(dnsZones.fetchProviderZones).toHaveBeenCalledTimes(2);
      expect(wiz.zoneOptions().map(o => o.zoneName)).toEqual(['example.org']);
      expect(wiz.unreadableZoneProviders()).toEqual(['scaleway']);
    });

    it('keeps the zone already assigned to the cluster selected, with its email', async () => {
      const { wiz } = setup({
        registered: [
          { id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never },
          { id: 'z2', zoneName: 'other.cloud', providerZoneId: 'p3', dnsProvider: 'hetzner' as never },
        ],
        supported: ['hetzner'],
        capable: [HETZNER],
        providerZones: { hetzner: [{ zoneId: 'p2', name: 'example.org' }] },
        assignment: { id: 'a1', dnsZoneId: 'z2', acmeEmail: 'ops@example.org', wildcardCertificate: true },
      });

      await wiz.init('c-1');

      expect(wiz.selectedZoneKey()).toBe('zone:z2');
      expect(wiz.acmeEmail()).toBe('ops@example.org');
      expect(wiz.existingZone()).not.toBeNull();
      expect(wiz.zoneOptions()).toHaveSize(3);
    });

    it('registers a provider zone when it is chosen', async () => {
      const { wiz, dnsZones } = setup({
        registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
        supported: ['hetzner'],
        capable: [HETZNER],
        providerZones: { hetzner: [{ zoneId: 'p2', name: 'example.org' }] },
      });
      await wiz.init('c-1');

      wiz.selectZone('provider:hetzner:p2');
      wiz.acmeEmail.set('me@example.org');
      expect(wiz.selectedZoneId()).toBe('');

      expect(await wiz.ensureSelectedZoneRegistered()).toBeTrue();
      expect(dnsZones.registerZone).toHaveBeenCalledWith({
        providerZoneId: 'p2',
        zoneName: 'example.org',
        dnsProvider: 'hetzner' as never,
      });
      expect(wiz.selectedZoneId()).toBe('reg-example.org');
      expect(wiz.selectedZoneKey()).toBe('zone:reg-example.org');
      expect(wiz.selectedZoneName()).toBe('example.org');
    });

    it('does not register a zone that is registered already', async () => {
      const { wiz, dnsZones } = setup({
        registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
      });
      await wiz.init('c-1');

      expect(wiz.selectedZoneKey()).toBe('zone:z1');
      expect(await wiz.ensureSelectedZoneRegistered()).toBeTrue();
      expect(dnsZones.registerZone).not.toHaveBeenCalled();
      expect(wiz.selectedZoneId()).toBe('z1');
    });
  });

  describe('names of the platform addresses', () => {
    const hostnames = {
      zoneName: 'flui.cloud',
      hostnames: [
        { app: 'flui-web' as const, applicationId: 'w', defaultLabel: 'dashboard', label: 'dashboard', fqdn: 'dashboard.flui.cloud', currentFqdn: null },
        { app: 'flui-api' as const, applicationId: 'a', defaultLabel: 'api', label: 'api', fqdn: 'api.flui.cloud', currentFqdn: null },
      ],
    };

    it('starts from the names the API suggests', async () => {
      const { wiz, clusterDnsZone } = setup({ hostnames });
      wiz.selectedZoneId.set('z1');

      await wiz.loadSystemNames('c-1');

      expect(clusterDnsZone.getSystemHostnames).toHaveBeenCalledWith('c-1', 'z1');
      expect(wiz.namesZoneName()).toBe('flui.cloud');
      expect(wiz.systemNames().map(r => r.label)).toEqual(['dashboard', 'api']);
    });

    it('refuses a dot in a wildcard name and says why', async () => {
      const { wiz } = setup({ hostnames });
      await wiz.loadSystemNames('c-1');

      wiz.setSystemName('flui-web', 'dashboard.demo');

      expect(wiz.systemNames()[0].error).toBe(
        'One name, no dots: the certificate for *.flui.cloud covers a single level.'
      );
    });

    it('accepts a single custom label', async () => {
      const { wiz } = setup({ hostnames });
      await wiz.loadSystemNames('c-1');

      wiz.setSystemName('flui-web', ' Dashboard-Demo ');

      expect(wiz.systemNames()[0]).toEqual(jasmine.objectContaining({ label: 'dashboard-demo', error: null }));
    });

    it('sends the labels to the API and puts a refusal on the right row', async () => {
      const { wiz, clusterDnsZone } = setup({
        hostnames,
        check: { ok: false, field: 'flui-web', message: 'dashboard.flui.cloud already points to 198.51.100.7.' },
      });
      wiz.selectedZoneId.set('z1');
      await wiz.loadSystemNames('c-1');

      expect(await wiz.checkSystemNames('c-1')).toBeFalse();

      expect(clusterDnsZone.checkSystemHostnames).toHaveBeenCalledWith('c-1', {
        dnsZoneId: 'z1',
        hostnames: [{ app: 'flui-web', label: 'dashboard' }, { app: 'flui-api', label: 'api' }],
      });
      expect(wiz.systemNames()[0].error).toBe('dashboard.flui.cloud already points to 198.51.100.7.');
      expect(wiz.systemNames()[1].error).toBeNull();
    });
  });

  it('keeps the addresses the API resolved for the endpoints it creates next', async () => {
    const { wiz } = setup({
      check: {
        ok: true,
        result: {
          zoneName: 'flui.cloud',
          hostnames: [
            { app: 'flui-web', applicationId: 'w', defaultLabel: 'dashboard', label: 'dashboard-demo', fqdn: 'dashboard-demo.flui.cloud', currentFqdn: null },
          ],
        },
      },
    });

    expect(await wiz.checkSystemNames('c-1')).toBeTrue();
    expect(wiz['chosenFqdns']()).toEqual({ 'flui-web': 'dashboard-demo.flui.cloud' });
  });

  describe('choosing another zone', () => {
    const check = {
      ok: true as const,
      result: {
        zoneName: 'flui.cloud',
        hostnames: [
          { app: 'flui-web' as const, applicationId: 'w', defaultLabel: 'dashboard', label: 'dashboard', fqdn: 'dashboard.flui.cloud', currentFqdn: 'old.flui.cloud' },
        ],
      },
    };

    it('forgets the addresses chosen under the previous zone', async () => {
      const { wiz } = setup({ check });
      wiz.selectZone('zone:z1');
      await wiz.checkSystemNames('c-1');
      wiz['namesLoadedForZone'] = 'z1';

      wiz.selectZone('zone:z2');

      expect(wiz['chosenFqdns']()).toEqual({});
      expect(wiz['currentFqdns']()).toEqual({});
      expect(wiz['namesLoadedForZone']).toBeNull();
    });

    it('keeps them when the same zone is selected again', async () => {
      const { wiz } = setup({ check });
      wiz.selectZone('zone:z1');
      await wiz.checkSystemNames('c-1');

      wiz.selectZone('zone:z1');

      expect(wiz['chosenFqdns']()).toEqual({ 'flui-web': 'dashboard.flui.cloud' });
    });
  });

  describe('changing the address of an exposed platform application', () => {
    const def = { key: 'flui-web', label: 'Dashboard', fqdn: 'console.flui.cloud', slug: 'flui-web', hostnameMode: 'domain' as const };
    const systemAppDefs = [{ key: 'flui-web', label: 'Dashboard', slug: 'flui-web', applicationId: 'w' }];

    function withEndpoints(existing: { id: string; applicationId: string; fqdn: string; hostnameMode: 'ip' | 'domain' }[], currentFqdn: string | null) {
      const endpoints = signal(existing as never[]);
      const appEndpoints = {
        endpoints,
        error: signal<string | null>(null),
        updateEndpoint: jasmine.createSpy('updateEndpoint').and.callFake(async (id: string, dto: { fqdn: string }) => ({ id, applicationId: 'w', fqdn: dto.fqdn })),
        createEndpoint: jasmine.createSpy('createEndpoint').and.callFake(async () => ({ id: 'ep-new', applicationId: 'w' })),
        reconcileEndpoint: jasmine.createSpy('reconcileEndpoint').and.resolveTo({}),
        loadEndpoints: jasmine.createSpy('loadEndpoints').and.resolveTo(),
      };
      const built = setup({
        appEndpoints,
        check: {
          ok: true,
          result: {
            zoneName: 'flui.cloud',
            hostnames: [{ app: 'flui-web', applicationId: 'w', defaultLabel: 'dashboard', label: 'console', fqdn: def.fqdn, currentFqdn }],
          },
        },
      });
      return { ...built, appEndpoints, existing: existing as never[] };
    }

    async function run(wiz: DnsSetupWizardService, existing: never[]) {
      await wiz.checkSystemNames('c-1');
      wiz['seedEndpointStatuses'](false, [def], systemAppDefs, existing);
      await wiz['processEndpointSetupDef'](def, 'c-1', 'a1', false, null);
    }

    it('renames the endpoint it already has instead of adding a second one', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints(
        [{ id: 'ep-old', applicationId: 'w', fqdn: 'dashboard.flui.cloud', hostnameMode: 'domain' }],
        'dashboard.flui.cloud',
      );

      await run(wiz, existing);

      expect(appEndpoints.createEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.updateEndpoint).toHaveBeenCalledOnceWith('ep-old', jasmine.objectContaining({
        fqdn: 'console.flui.cloud',
        clusterDnsZoneId: 'a1',
        certChallenge: 'dns-01',
        hostnameMode: 'domain',
      }));
      expect(appEndpoints.reconcileEndpoint).toHaveBeenCalledWith('ep-old');
      expect(wiz.appEndpoints()[0]).toEqual(jasmine.objectContaining({ endpointId: 'ep-old', fqdn: 'console.flui.cloud' }));
    });

    it('leaves an endpoint that already has the chosen address alone', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints(
        [{ id: 'ep-1', applicationId: 'w', fqdn: 'console.flui.cloud', hostnameMode: 'domain' }],
        'console.flui.cloud',
      );

      await run(wiz, existing);

      expect(appEndpoints.updateEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.createEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.reconcileEndpoint).toHaveBeenCalledWith('ep-1');
    });

    it('creates the domain endpoint beside the install address of a fresh installation', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints(
        [{ id: 'ep-ip', applicationId: 'w', fqdn: 'flui-web.203-0-113-10.nip.io', hostnameMode: 'ip' }],
        'flui-web.203-0-113-10.nip.io',
      );

      await run(wiz, existing);

      expect(appEndpoints.updateEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.createEndpoint).toHaveBeenCalledOnceWith('c-1', jasmine.objectContaining({
        applicationId: 'w',
        fqdn: 'console.flui.cloud',
        hostnameMode: 'domain',
      }));
      expect(wiz.appEndpoints()[0].endpointId).toBe('ep-new');
    });

    it('renames the domain endpoint, not the install address, when both exist', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints(
        [
          { id: 'ep-ip', applicationId: 'w', fqdn: 'flui-web.203-0-113-10.nip.io', hostnameMode: 'ip' },
          { id: 'ep-old', applicationId: 'w', fqdn: 'dashboard.flui.cloud', hostnameMode: 'domain' },
        ],
        'dashboard.flui.cloud',
      );

      await run(wiz, existing);

      expect(appEndpoints.createEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.updateEndpoint).toHaveBeenCalledOnceWith('ep-old', jasmine.objectContaining({ fqdn: 'console.flui.cloud' }));
    });

    it('creates the endpoint when the application has none yet', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints([], null);

      await run(wiz, existing);

      expect(appEndpoints.updateEndpoint).not.toHaveBeenCalled();
      expect(appEndpoints.createEndpoint).toHaveBeenCalledTimes(1);
    });

    it('shows the refusal when the rename fails', async () => {
      const { wiz, appEndpoints, existing } = withEndpoints(
        [{ id: 'ep-old', applicationId: 'w', fqdn: 'dashboard.flui.cloud', hostnameMode: 'domain' }],
        'dashboard.flui.cloud',
      );
      appEndpoints.updateEndpoint.and.resolveTo(null);
      appEndpoints.error.set('console.flui.cloud is already used by another endpoint.');

      await run(wiz, existing);

      expect(appEndpoints.reconcileEndpoint).not.toHaveBeenCalled();
      expect(wiz.appEndpoints()[0]).toEqual(jasmine.objectContaining({
        status: 'error',
        errorMessage: 'console.flui.cloud is already used by another endpoint.',
      }));
    });
  });

  describe('wildcardLabelHint', () => {
    it('allows one DNS label', () => {
      expect(wildcardLabelHint('dashboard-demo', 'flui.cloud')).toBeNull();
    });

    it('explains the other refusals briefly', () => {
      expect(wildcardLabelHint('', 'flui.cloud')).toBe('Enter a name.');
      expect(wildcardLabelHint('-x', 'flui.cloud')).toContain('not at the start or end');
      expect(wildcardLabelHint('a'.repeat(64), 'flui.cloud')).toBe('At most 63 characters.');
    });
  });
});
