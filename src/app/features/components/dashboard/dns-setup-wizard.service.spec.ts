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
