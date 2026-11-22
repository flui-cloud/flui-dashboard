import { Component, input, output } from '@angular/core';
import { FlowSubtype } from '../../service/deploy-wizard-state.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';

export type DeploySource = Exclude<FlowSubtype, null>;

interface SourceOption {
  readonly id: DeploySource;
  readonly title: string;
  readonly description: string;
}

const OPTIONS: readonly SourceOption[] = [
  {
    id: 'template',
    title: 'From a Flui template',
    description:
      'A framework starter such as Next.js, Spring Boot or FastAPI. Flui creates the repository in your GitHub, wires the build and deploys it.',
  },
  {
    id: 'image',
    title: 'From a Docker image',
    description:
      'A pre-built image from Docker Hub or GHCR. No build step. Settings the image does not declare are asked in the next steps.',
  },
  {
    id: 'existing-repo',
    title: 'From an existing repository',
    description:
      'A Git repository you already have. Flui reads its flui.yaml, and its Dockerfile if it builds with one.',
  },
  {
    id: 'marketplace',
    title: 'From the Marketplace',
    description:
      'A packaged app curated by Flui: databases, CMS, analytics, queues. No code and no Dockerfile.',
  },
];

@Component({
  selector: 'app-deploy-step-source',
  imports: [FlAlert, FlButton],
  host: { class: 'fl-stack' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>Choose how to deploy</legend>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        @for (option of options; track option.id) {
          <label class="fl-radiocard">
            <input
              type="radio"
              name="deploy-source"
              [checked]="flow() === option.id"
              (click)="flowSelect.emit(option.id)"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">{{ option.title }}</span>
              <span class="fl-radiocard__desc">{{ option.description }}</span>
            </span>
          </label>
        }
      </div>
    </fieldset>

    @if (flow() === 'image') {
      <fl-alert tone="info" title="What happens next">
        Flui deploys the image as it is, without rebuilding or patching it. A Flui-compliant image
        exposes one port, has a healthcheck endpoint and runs as non-root, so most settings fill in
        by themselves. Otherwise you set port, healthcheck, variables and resources in the next
        steps. Images published by Flui templates follow these conventions.
        <button alertActions flButton size="sm" type="button" (click)="openTemplates.emit()">
          View templates
        </button>
      </fl-alert>
    }

    @if (flow() === 'existing-repo') {
      <fl-alert
        tone="info"
        title="What Flui needs in the repository"
        data-testid="existing-repo-needs"
      >
        A <span class="fl-mono">flui.yaml</span> that describes the app, plus a
        <span class="fl-mono">Dockerfile</span> if it builds with one. No flui.yaml yet? A coding
        agent can write both, or <span class="fl-mono">flui app init</span> copies them from a
        framework template.
        <ng-container alertActions>
          <button flButton size="sm" type="button" (click)="openTemplates.emit()">
            View templates
          </button>
          <a
            flButton="ghost"
            size="sm"
            href="https://docs.flui.cloud/concepts/17-the-flui-manifest/"
            target="_blank"
            rel="noopener"
            >What the flui.yaml says</a
          >
        </ng-container>
      </fl-alert>
    }
  `,
})
export class DeployStepSource {
  readonly flow = input<FlowSubtype>(null);
  readonly flowSelect = output<DeploySource>();
  readonly openTemplates = output<void>();
  protected readonly options = OPTIONS;
}
