import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RepoMapControls } from './repo-map-controls';

describe('RepoMapControls', () => {
  let fixture: ComponentFixture<RepoMapControls>;

  const build = (inputs: Record<string, unknown> = {}) => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(RepoMapControls);
    fixture.componentRef.setInput('branch', '');
    fixture.componentRef.setInput('clusterId', '');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('keeps the plain hint when branches fail for another reason', () => {
    const el = build({ branchesError: 'Branches could not be listed' });
    expect(el.textContent).toContain('Branches could not be listed');
    expect(el.querySelector('app-github-credential-alert')).toBeNull();
  });

  it('warns about the credential and links to the repositories page', () => {
    const el = build({
      branchesError: 'Branches could not be listed',
      branchesProblem: {
        credential: 'repository-token',
        title: 'The repository token is not valid',
        message: 'Replace the token of this repository.',
      },
    });
    const alert = el.querySelector('app-github-credential-alert');
    expect(alert?.textContent).toContain('The repository token is not valid');
    expect(alert?.textContent).toContain('Replace the token of this repository.');
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/apps/repositories');
  });
});
