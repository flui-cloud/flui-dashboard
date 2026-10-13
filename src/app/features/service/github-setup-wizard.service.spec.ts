import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GitHubSetupService } from '../../core/api/api/gitHubSetup.service';
import { GitHubOAuthService } from '../../core/api/api/gitHubOAuth.service';
import {
  GithubSetupWizardService,
  organizationProblem,
} from './github-setup-wizard.service';

describe('GithubSetupWizardService — creating the App under an organisation', () => {
  let service: GithubSetupWizardService;
  let manifestStart: jasmine.Spy;

  const fill = (organization: string) =>
    service.updateManifestForm({
      name: 'flui-acme',
      publicApiUrl: 'https://flui.acme.test',
      organization,
    });

  beforeEach(() => {
    manifestStart = jasmine.createSpy('manifestStart').and.returnValue(
      of({
        manifestJson: {},
        githubUrl: 'https://github.com/organizations/acme/settings/apps/new',
        state: 's1',
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        GithubSetupWizardService,
        {
          provide: GitHubSetupService,
          useValue: { gitHubSetupControllerManifestStart: manifestStart },
        },
        { provide: GitHubOAuthService, useValue: {} },
      ],
    });
    service = TestBed.inject(GithubSetupWizardService);
  });

  it('sends the organisation, trimmed, and hands back the URL the API chose', async () => {
    fill('  acme ');

    const result = await service.startManifest();

    expect(manifestStart).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ name: 'flui-acme', organization: 'acme' }),
    );
    expect(result?.githubUrl).toBe(
      'https://github.com/organizations/acme/settings/apps/new',
    );
  });

  it('sends no organisation when the field is left empty', async () => {
    fill('   ');

    await service.startManifest();

    expect(
      manifestStart.calls.mostRecent().args[0].organization,
    ).toBeUndefined();
  });

  it('refuses a value that is no GitHub login, before asking the API', async () => {
    fill('acme/../settings');

    const result = await service.startManifest();

    expect(result).toBeNull();
    expect(manifestStart).not.toHaveBeenCalled();
    expect(service.error()).toContain('GitHub login');
  });

  it('clears the organisation on reset', () => {
    fill('acme');
    service.reset();
    expect(service.manifestForm().organization).toBe('');
  });
});

describe('organizationProblem', () => {
  it('accepts an empty field and a GitHub login', () => {
    expect(organizationProblem('')).toBeNull();
    expect(organizationProblem('acme-labs2')).toBeNull();
    expect(organizationProblem('a'.repeat(39))).toBeNull();
  });

  it('refuses what GitHub would never accept as a login', () => {
    for (const value of [
      '-acme',
      'acme-',
      'ac--me',
      'ac_me',
      'a'.repeat(40),
      'https://github.com/acme',
    ]) {
      expect(organizationProblem(value)).withContext(value).not.toBeNull();
    }
  });
});
