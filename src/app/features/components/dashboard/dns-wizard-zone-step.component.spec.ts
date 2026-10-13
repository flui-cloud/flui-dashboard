import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DnsWizardZoneStepComponent } from './dns-wizard-zone-step.component';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { WizardFakes, wizardProviders } from './dns-setup-wizard.testing';

describe('DnsWizardZoneStepComponent', () => {
  let fixture: ComponentFixture<DnsWizardZoneStepComponent>;

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => q(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const render = async (fakes: WizardFakes) => {
    const built = wizardProviders(fakes);
    await TestBed.configureTestingModule({
      imports: [DnsWizardZoneStepComponent],
      providers: [provideRouter([]), ...built.providers],
    }).compileComponents();
    await TestBed.inject(DnsSetupWizardService).init('c-1');
    fixture = TestBed.createComponent(DnsWizardZoneStepComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('lists registered zones and the provider zones not added yet, after a zone exists', async () => {
    await render({
      registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
      supported: ['hetzner'],
      capable: [{ id: 'hetzner', displayName: 'Hetzner' }],
      providerZones: { hetzner: [{ zoneId: 'p1', name: 'flui.cloud' }, { zoneId: 'p2', name: 'example.org' }] },
      assignment: { id: 'a1', dnsZoneId: 'z1', acmeEmail: 'ops@flui.cloud', wildcardCertificate: true },
    });

    expect(q('zone-option-flui.cloud')).not.toBeNull();
    expect(q('zone-option-example.org')).not.toBeNull();
    expect(q('zone-option-flui.cloud')!.querySelector('[data-testid="zone-not-added"]')).toBeNull();
    expect(q('zone-option-example.org')!.querySelector('[data-testid="zone-not-added"]')).not.toBeNull();
    expect(text('zone-email-fixed')).toBe('ops@flui.cloud');
    expect(q('zone-email')).toBeNull();
  });

  it('names the configured provider in the hint instead of claiming none is configured', async () => {
    await render({
      registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
      supported: ['hetzner'],
      capable: [{ id: 'hetzner', displayName: 'Hetzner' }],
      providerZones: { hetzner: [{ zoneId: 'p1', name: 'flui.cloud' }] },
    });

    expect(text('zone-hint')).toContain('Buy it on hetzner');
    expect(text('zone-hint')).not.toContain('No DNS provider is configured');
  });

  it('says no provider is configured only when that is true', async () => {
    await render({
      registered: [{ id: 'z1', zoneName: 'flui.cloud', providerZoneId: 'p1', dnsProvider: 'hetzner' as never }],
      supported: ['hetzner'],
      capable: [],
    });

    expect(text('zone-hint')).toContain('No DNS provider is configured yet.');
  });

  it('shows the empty state when there is neither a zone nor a provider', async () => {
    await render({ supported: ['hetzner'], capable: [] });

    expect(q('zone-no-provider')).not.toBeNull();
    expect(q('zone-options')).toBeNull();
  });

  it('offers the email field and the provider zones on a fresh installation', async () => {
    await render({
      supported: ['hetzner'],
      capable: [{ id: 'hetzner', displayName: 'Hetzner' }],
      providerZones: { hetzner: [{ zoneId: 'p2', name: 'example.org' }, { zoneId: 'p3', name: 'flui.cloud' }] },
    });

    expect(q('zone-email')).not.toBeNull();
    expect(q('zone-option-example.org')!.querySelector('[data-testid="zone-not-added"]')).not.toBeNull();
    expect(q('zone-option-flui.cloud')).not.toBeNull();
  });
});
