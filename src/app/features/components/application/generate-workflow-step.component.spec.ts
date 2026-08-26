import { ComponentRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerateWorkflowStepComponent } from './generate-workflow-step.component';
import { WorkflowConsent } from '../../service/application.service';

const consentOf = (over: Partial<WorkflowConsent> = {}): WorkflowConsent => ({
  repository: 'someone/their-app',
  branch: 'main',
  delivery: 'pull-request',
  deliveryNote: 'Flui opens a pull request against main.',
  writes: [
    { target: '.github/workflows/flui-their-app.yml', what: 'The workflow.' },
    { target: 'Repository secret FLUI_WEBHOOK_TOKEN', what: 'A credential.' },
    { target: 'Repository secret FLUI_GHCR_TOKEN', what: 'A credential.' },
  ],
  workflowYaml: 'name: Flui Deploy\non:\n  push:\n    branches: [main]\n',
  webhookSecretName: 'FLUI_WEBHOOK_TOKEN',
  webhookSecretNote:
    'The file above contains no credentials. The build reports back by reading ' +
    "FLUI_WEBHOOK_TOKEN from this repository's secrets. Anyone with write access " +
    'to this repository can use it.',
  usesYourActionsMinutes: true,
  builtOnFluiMachines: false,
  ...over,
});

describe('the workflow consent screen', () => {
  let fixture: ComponentFixture<GenerateWorkflowStepComponent>;
  let ref: ComponentRef<GenerateWorkflowStepComponent>;

  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateWorkflowStepComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GenerateWorkflowStepComponent);
    ref = fixture.componentRef;
  });

  it('renders the workflow body whole, not a summary of it', () => {
    const yaml = ['name: Flui Deploy', 'on:', '  push:', '    branches: [main]'].join('\n');
    ref.setInput('consent', consentOf({ workflowYaml: yaml }));
    fixture.detectChanges();

    const pre = fixture.nativeElement.querySelector('pre') as HTMLElement;
    expect(pre.textContent).toBe(yaml);
  });

  it('names every write the server declared, the repository secret included', () => {
    ref.setInput('consent', consentOf());
    fixture.detectChanges();

    expect(text()).toContain('.github/workflows/flui-their-app.yml');
    expect(text()).toContain('Repository secret FLUI_GHCR_TOKEN');
  });

  it('says whose Actions minutes this spends', () => {
    ref.setInput('consent', consentOf());
    fixture.detectChanges();
    expect(text()).toContain('Actions minutes');
  });

  it('says the code is never compiled on Flui machines', () => {
    ref.setInput('consent', consentOf());
    fixture.detectChanges();
    expect(text()).toContain('never compiled on Flui machines');
  });

  it('repeats the backend sentence about the secret, word for word', () => {
    const consent = consentOf();
    ref.setInput('consent', consent);
    fixture.detectChanges();
    expect(text()).toContain(consent.webhookSecretNote!);
    expect(text()).not.toContain('clear text');
  });

  it('says nothing about a secret when the workflow reads none', () => {
    ref.setInput(
      'consent',
      consentOf({
        webhookSecretName: null,
        webhookSecretNote: null,
        writes: [
          { target: '.github/workflows/flui-their-app.yml', what: 'The workflow.' },
        ],
      }),
    );
    fixture.detectChanges();
    expect(text()).not.toContain('FLUI_WEBHOOK_TOKEN');
  });

  it('offers to open a pull request, not to commit, when that is what would happen', () => {
    ref.setInput('consent', consentOf());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain(
      'Open the pull request',
    );
  });

  it('offers to commit to the named branch when that is what would happen', () => {
    ref.setInput('consent', consentOf({ delivery: 'push', branch: 'trunk' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain(
      'Commit to trunk',
    );
  });

  it('offers no button at all until the server has said what would be written', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(text()).toContain('Reading what would be written');
  });

  it('shows the measured expectation when there is one', () => {
    ref.setInput('consent', consentOf());
    ref.setInput('buildExpectation', {
      samples: 3,
      medianSeconds: 190,
      slowestSeconds: 240,
      source: 'this-application',
      note: 'The last 3 builds of this application took a median of 3m 10s, the slowest 4m.',
    });
    fixture.detectChanges();
    expect(text()).toContain('3m 10s');
  });

  it('sends the reader to GitHub, not to a pipeline, after a pull request', () => {
    ref.setInput('generationState', 'done');
    ref.setInput('consent', consentOf());
    ref.setInput('result', {
      committed: true,
      workflowUrl: 'https://github.com/someone/their-app/blob/flui/x',
      pullRequestUrl: 'https://github.com/someone/their-app/pull/1',
      buildStarted: false,
    });
    fixture.detectChanges();

    expect(text()).toContain('Nothing is building yet');
    expect(text()).toContain('merge');
  });
});
