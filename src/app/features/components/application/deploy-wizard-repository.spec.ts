import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ApplicationsService } from '../../../core/api/api/applications.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ClusterService } from '../../service/cluster.service';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';
import { PlatformVersionService } from '../../service/platform-version.service';
import { RepositoryService } from '../../service/repository.service';
import { TemplateService } from '../../service/template.service';
import { DeployWizardEnv } from './deploy-wizard-env';
import { DeployWizardRepository } from './deploy-wizard-repository';
import { DeployWizardForm } from './deploy-wizard.state';

const invalid = (credential: string) =>
  new HttpErrorResponse({
    status: 424,
    statusText: 'Failed Dependency',
    error: {
      statusCode: 424,
      code: 'GITHUB_TOKEN_INVALID',
      credential,
      message: 'Replace the repository token in Repositories.',
    },
  });

describe('DeployWizardRepository GitHub credential failures', () => {
  let repoService: {
    connectedRepositories: ReturnType<typeof signal>;
    getRepositoryBranches: jasmine.Spy;
    getFluiManifests: jasmine.Spy;
  };
  let form: DeployWizardForm;
  let repository: DeployWizardRepository;

  beforeEach(() => {
    repoService = {
      connectedRepositories: signal([]),
      getRepositoryBranches: jasmine.createSpy('getRepositoryBranches'),
      getFluiManifests: jasmine.createSpy('getFluiManifests'),
    };
    TestBed.configureTestingModule({
      providers: [
        DeployWizardForm,
        DeployWizardRepository,
        { provide: RepositoryService, useValue: repoService },
        { provide: DeployWizardStateService, useValue: { flowSubtype: signal(null) } },
        { provide: ClusterService, useValue: { clusters: signal([]) } },
        { provide: TemplateService, useValue: { templates: signal([]) } },
        { provide: DeployWizardEnv, useValue: {} },
        { provide: ApplicationsService, useValue: {} },
        { provide: PlatformVersionService, useValue: { version: signal(null) } },
        { provide: ToastService, useValue: {} },
      ],
    });
    form = TestBed.inject(DeployWizardForm);
    repository = TestBed.inject(DeployWizardRepository);
    form.selectedRepo.set({ id: 'r1', fullName: 'acme/api', branch: 'main' } as never);
  });

  it('keeps the credential problem when branches cannot be listed', async () => {
    repoService.getRepositoryBranches.and.rejectWith(invalid('repository-token'));
    await repository.loadBranches();
    expect(form.branchesFailed()).toBeTrue();
    expect(form.branchesProblem()?.title).toBe('The repository token is not valid');
  });

  it('shows no credential problem for other branch failures', async () => {
    repoService.getRepositoryBranches.and.rejectWith(new Error('boom'));
    await repository.loadBranches();
    expect(form.branchesFailed()).toBeTrue();
    expect(form.branchesProblem()).toBeNull();
  });

  it('clears the problem once branches load', async () => {
    repoService.getRepositoryBranches.and.rejectWith(invalid('github-app'));
    await repository.loadBranches();
    repoService.getRepositoryBranches.and.resolveTo([{ name: 'main' }]);
    await repository.loadBranches();
    expect(form.branchesProblem()).toBeNull();
  });

  it('keeps the credential problem when manifest discovery fails', async () => {
    repoService.getFluiManifests.and.rejectWith(invalid('github-account'));
    await repository.triggerManifestCheck();
    expect(form.analysisBranch()).toBe('check-failed');
    expect(form.manifestProblem()?.title).toBe('Reconnect your GitHub account');
    expect(form.manifestFetchError()).toBe('Replace the repository token in Repositories.');
  });

  it('keeps the plain error for other manifest failures', async () => {
    repoService.getFluiManifests.and.rejectWith(new Error('Failed to read flui.yaml manifests'));
    await repository.triggerManifestCheck();
    expect(form.manifestProblem()).toBeNull();
    expect(form.manifestFetchError()).toBe('Failed to read flui.yaml manifests');
  });
});
