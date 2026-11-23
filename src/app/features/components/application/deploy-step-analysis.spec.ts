import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeployStepAnalysis } from './deploy-step-analysis';

describe('DeployStepAnalysis when flui.yaml cannot be read', () => {
  const build = (credentialProblem: unknown) => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DeployStepAnalysis);
    fixture.componentRef.setInput('state', 'check-failed');
    fixture.componentRef.setInput('fetchError', 'Failed to read flui.yaml manifests');
    fixture.componentRef.setInput('credentialProblem', credentialProblem);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('keeps the retry alert for an ordinary failure', () => {
    const el = build(null);
    expect(el.textContent).toContain('Could not read flui.yaml');
    expect(el.textContent).toContain('Retry');
    expect(el.querySelector('app-github-credential-alert')).toBeNull();
  });

  it('points at the credential when GitHub refused it', () => {
    const el = build({
      credential: 'github-account',
      title: 'Reconnect GitHub',
      message: 'Reconnect your GitHub account.',
    });
    expect(el.textContent).toContain('Reconnect GitHub');
    expect(el.textContent).toContain('Reconnect your GitHub account.');
    expect(el.textContent).not.toContain('Could not read flui.yaml');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/apps/repositories');
  });
});
