import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DnsWizardNamesStepComponent } from './dns-wizard-names-step.component';
import { DnsSetupWizardService } from './dns-setup-wizard.service';
import { wizardProviders } from './dns-setup-wizard.testing';

describe('DnsWizardNamesStepComponent', () => {
  let fixture: ComponentFixture<DnsWizardNamesStepComponent>;
  let wiz: DnsSetupWizardService;

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  const type = (app: string, value: string) => {
    const input = q(`name-input-${app}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    const built = wizardProviders({
      hostnames: {
        zoneName: 'flui.cloud',
        hostnames: [
          { app: 'flui-web', applicationId: 'w', defaultLabel: 'dashboard', label: 'dashboard', fqdn: 'dashboard.flui.cloud', currentFqdn: null },
          { app: 'flui-api', applicationId: 'a', defaultLabel: 'api', label: 'api', fqdn: 'api.flui.cloud', currentFqdn: null },
          { app: 'zitadel', applicationId: 'z', defaultLabel: 'auth', label: 'auth', fqdn: 'auth.flui.cloud', currentFqdn: null },
        ],
      },
    });
    await TestBed.configureTestingModule({
      imports: [DnsWizardNamesStepComponent],
      providers: built.providers,
    }).compileComponents();
    wiz = TestBed.inject(DnsSetupWizardService);
    await wiz.loadSystemNames('c-1');
    fixture = TestBed.createComponent(DnsWizardNamesStepComponent);
    fixture.detectChanges();
  });

  it('shows one editable name per platform address, with the domain beside it', () => {
    expect((q('name-input-flui-web') as HTMLInputElement).value).toBe('dashboard');
    expect((q('name-input-flui-api') as HTMLInputElement).value).toBe('api');
    expect((q('name-input-zitadel') as HTMLInputElement).value).toBe('auth');
    expect(q('name-row-flui-web')!.textContent).toContain('.flui.cloud');
  });

  it('accepts a different single name', () => {
    type('flui-web', 'dashboard-demo');

    expect(q('name-error-flui-web')).toBeNull();
    expect(wiz.systemNames()[0].label).toBe('dashboard-demo');
    expect(q('name-reset-flui-web')).not.toBeNull();
  });

  it('explains why a dot is not allowed', () => {
    type('flui-web', 'dashboard.demo');

    expect(q('name-error-flui-web')!.textContent).toContain(
      'One name, no dots: the certificate for *.flui.cloud covers a single level.'
    );
  });

  it('goes back to the suggested name', () => {
    type('flui-api', 'api-demo');
    (q('name-reset-flui-api') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(wiz.systemNames()[1].label).toBe('api');
    expect(q('name-reset-flui-api')).toBeNull();
  });
});
