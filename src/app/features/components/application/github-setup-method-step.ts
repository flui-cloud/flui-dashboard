import { Component, input, output } from '@angular/core';
import { SetupMethod } from '../../service/github-setup-wizard.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlTag } from '../../../ui/primitives/tag';

interface MethodOption {
  readonly id: Exclude<SetupMethod, null>;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
  readonly recommended?: boolean;
}

const OPTIONS: readonly MethodOption[] = [
  {
    id: 'pat',
    title: 'Personal access token',
    description:
      'The quickest way in. Each person pastes a classic token that covers both their repositories and container images. Nothing to register on GitHub.',
    points: [
      'Ready in a minute, no App to create',
      'Organization token policies may block it',
      'The token expires and must be rotated',
    ],
    recommended: true,
  },
  {
    id: 'github_app',
    title: 'GitHub App',
    description:
      'For teams and organizations: one App shared by everyone, created on GitHub with one click, so nobody keeps a personal token.',
    points: [
      'Works for any account or organization',
      'Webhooks for deploy on push are set up for you',
      'Bot identity, no token rotation',
    ],
  },
];

@Component({
  selector: 'app-github-setup-method-step',
  imports: [FlAlert, FlButton, FlSpinner, FlTag],
  host: { class: 'fl-stack' },
  template: `
    @if (configuredLabel()) {
      <fl-alert tone="warning" title="GitHub is already configured">
        Active: <span class="fl-mono">{{ configuredLabel() }}</span>. Setting up a new method
        replaces the current one. Reset removes the integration entirely.
        <button
          alertActions
          flButton
          size="sm"
          type="button"
          [disabled]="configuring()"
          (click)="resetIntegration.emit()"
        >
          @if (configuring()) {
            <fl-spinner label="Resetting" />
          }
          Reset
        </button>
      </fl-alert>
    }

    <fieldset class="fl-fieldset">
      <legend>Choose how Flui connects to GitHub</legend>
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">This is a one-time system configuration.</p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        @for (option of options; track option.id) {
          <label class="fl-radiocard">
            <input
              type="radio"
              name="github-setup-method"
              [checked]="method() === option.id"
              (click)="methodSelect.emit(option.id)"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title fl-row">
                {{ option.title }}
                @if (option.recommended) {
                  <fl-tag>Recommended</fl-tag>
                }
              </span>
              <span class="fl-radiocard__desc">{{ option.description }}</span>
              <ul class="m-0 mt-1 flex list-disc flex-col gap-0.5 pl-4 text-fl-ink-secondary">
                @for (point of option.points; track point) {
                  <li>{{ point }}</li>
                }
              </ul>
            </span>
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class GithubSetupMethodStep {
  readonly method = input<SetupMethod>(null);
  readonly configuredLabel = input('');
  readonly configuring = input(false);
  readonly methodSelect = output<Exclude<SetupMethod, null>>();
  readonly resetIntegration = output<void>();
  protected readonly options = OPTIONS;
}
