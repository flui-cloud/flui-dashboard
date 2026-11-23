import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GithubCredentialAlert } from './github-credential-alert.component';

describe('GithubCredentialAlert', () => {
  let fixture: ComponentFixture<GithubCredentialAlert>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(GithubCredentialAlert);
    fixture.componentRef.setInput('problem', {
      credential: 'packages-token',
      title: 'The GitHub packages token is not valid',
      message: 'Replace the packages token in Repositories.',
    });
    fixture.detectChanges();
  });

  it('warns with the title and the API message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.fl-alert--warning')).toBeTruthy();
    expect(el.textContent).toContain('The GitHub packages token is not valid');
    expect(el.textContent).toContain('Replace the packages token in Repositories.');
  });

  it('links to the repositories page', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.textContent?.trim()).toBe('Open repositories');
    expect(link?.getAttribute('href')).toBe('/apps/repositories');
  });
});
