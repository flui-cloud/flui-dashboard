import { Component, signal } from '@angular/core';
import { RemoteData } from '../../core/state/remote-data';
import { FlAlert } from '../patterns/alert';
import { FlField } from '../patterns/field';
import { FlPanel } from '../patterns/panel';
import { FlRemote } from '../patterns/states';
import { FlWizardSteps } from '../patterns/wizard-steps';
import { FlButton } from '../primitives/button';

const STATES: Record<'loading' | 'empty' | 'error' | 'ready', RemoteData<string[]>> = {
  loading: { status: 'loading', data: null, error: null, refreshing: false },
  empty: { status: 'empty', data: null, error: null, refreshing: false },
  error: { status: 'error', data: null, error: 'the API did not answer', refreshing: false },
  ready: { status: 'ready', data: ['postgres-main'], error: null, refreshing: false },
};

@Component({
  selector: 'fl-kit-flows',
  host: { class: 'fl-stack' },
  imports: [FlPanel, FlField, FlAlert, FlRemote, FlWizardSteps, FlButton],
  template: `
    <fl-alert tone="warning" title="Backup never completed">
      The last 3 runs failed before upload. Check the bucket credentials in Backups.
      <button alertActions flButton size="sm" type="button">Open backups</button>
    </fl-alert>
    <fl-alert tone="error" title="Cluster unreachable"
      >The API server did not answer for 6 minutes.</fl-alert
    >
    <fl-alert title="Maintenance window">Node images are updated on Sunday at 03:00.</fl-alert>

    <fl-panel title="Data states">
      <div class="fl-row mb-4">
        @for (key of stateKeys; track key) {
          <button
            flButton
            size="sm"
            type="button"
            [attr.aria-pressed]="current() === key"
            (click)="current.set(key)"
          >
            {{ key }}
          </button>
        }
      </div>
      <fl-remote
        [state]="states[current()]"
        emptyTitle="No databases yet"
        emptyBody="Databases you create or import appear here."
        (retry)="current.set('loading')"
      >
        <button emptyActions flButton="primary" size="sm" type="button">Create database</button>
        <p>postgres-main</p>
      </fl-remote>
    </fl-panel>

    <fl-panel title="Wizard">
      <div class="fl-wizard">
        <fl-wizard-steps [steps]="steps" [current]="step()" (stepSelect)="step.set($event)" />
        <div class="flex flex-col gap-4">
          <fl-field
            label="Application name"
            for="kit-app-name"
            hint="Lowercase letters, digits and hyphens."
          >
            <div class="fl-input fl-input--lg"><input id="kit-app-name" value="billing-api" /></div>
          </fl-field>
          <fl-field label="Region" for="kit-region">
            <span class="fl-select-wrap">
              <select id="kit-region" class="fl-select">
                <option>fsn1 · Falkenstein</option>
                <option>nbg1 · Nuremberg</option>
              </select>
            </span>
          </fl-field>
          <fl-field
            label="Domain"
            for="kit-domain"
            error="Enter a domain you own, such as app.example.com."
          >
            <div class="fl-input fl-input--lg"><input id="kit-domain" value="localhost" /></div>
          </fl-field>
          <fieldset class="fl-fieldset">
            <legend>Plan</legend>
            <label class="fl-radiocard"
              ><input type="radio" name="kit-plan" checked />
              <span class="fl-radiocard__text"
                ><span class="fl-radiocard__title">Shared</span
                ><span class="fl-radiocard__desc">Runs on the existing cluster nodes.</span></span
              >
            </label>
            <label class="fl-radiocard"
              ><input type="radio" name="kit-plan" />
              <span class="fl-radiocard__text"
                ><span class="fl-radiocard__title">Dedicated</span
                ><span class="fl-radiocard__desc"
                  >Adds a node only this application uses.</span
                ></span
              >
            </label>
          </fieldset>
          <label class="fl-check"><input type="checkbox" checked /> Back up every day</label>
          <div class="fl-wizard__footer">
            <button flButton="ghost" type="button">Cancel</button>
            <button flButton type="button" [disabled]="step() === 0" (click)="step.set(step() - 1)">
              Previous
            </button>
            <button
              flButton="primary"
              type="button"
              [disabled]="step() === steps.length - 1"
              (click)="step.set(step() + 1)"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </fl-panel>
  `,
})
export class KitFlows {
  protected readonly states = STATES;
  protected readonly stateKeys = Object.keys(STATES) as (keyof typeof STATES)[];
  protected readonly current = signal<keyof typeof STATES>('empty');
  protected readonly step = signal(1);
  protected readonly steps = [
    { name: 'Source', summary: 'GitHub · dawit-io' },
    { name: 'Configure' },
    { name: 'Resources' },
    { name: 'Review and deploy' },
  ];
}
