import { Component, computed, input, output } from '@angular/core';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { GithubCredentialProblem } from '../../../core/state/github-credential';
import { GithubCredentialAlert } from '../../../shared/components/github-credential-alert.component';
import { FlowSubtype } from '../../service/deploy-wizard-state.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlStatus } from '../../../ui/primitives/status';
import { profileCpu, profileDescription, profileLabel, profileMemory } from './deploy-profiles';

@Component({
  selector: 'app-deploy-step-environment',
  imports: [FlAlert, FlField, FlStatus, GithubCredentialAlert],
  host: { class: 'fl-stack' },
  template: `
    @if (flow() === 'existing-repo') {
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fl-field
          label="Branch"
          for="deploy-branch"
          hint="Framework and runtime come from the Dockerfile in this branch."
        >
          @if (loadingBranches()) {
            <fl-status tone="progress" label="Loading branches" />
          } @else if (branches().length > 0) {
            <span class="fl-select-wrap">
              <select
                id="deploy-branch"
                class="fl-select fl-mono"
                [value]="branch()"
                (change)="branchChange.emit($any($event.target).value)"
              >
                @for (b of branches(); track b) {
                  <option [value]="b" [selected]="b === branch()">{{ b }}</option>
                }
              </select>
            </span>
          } @else {
            <div class="fl-input fl-input--lg">
              <input
                id="deploy-branch"
                type="text"
                class="fl-mono"
                placeholder="branch name"
                [value]="branch()"
                (input)="branchChange.emit($any($event.target).value)"
              />
            </div>
          }
        </fl-field>
        <fl-field label="Replicas" for="deploy-repo-replicas" hint="Number of pod replicas.">
          <div class="fl-input fl-input--lg">
            <input
              id="deploy-repo-replicas"
              type="number"
              class="fl-num"
              min="1"
              max="20"
              [value]="replicas()"
              (input)="replicasChange.emit(+$any($event.target).value)"
            />
          </div>
        </fl-field>
      </div>
      @if (branchesFailed() && !loadingBranches() && branches().length === 0) {
        @if (credentialProblem(); as problem) {
          <app-github-credential-alert [problem]="problem" />
        } @else {
          <fl-alert tone="warning" title="Branches could not be listed">
            Type the branch you want to deploy.
          </fl-alert>
        }
      }
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        The port is read from your Dockerfile (<span class="fl-mono">EXPOSE</span>).
      </p>
    }

    @if (flow() === 'template') {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Flui commits the build workflow to the default branch of
        <span class="fl-mono text-fl-ink">{{ newRepo() }}</span>. Variables set below go into the
        build and the running container. You can change them later in the application settings.
      </p>
    }

    @if (isImage()) {
      <fieldset class="fl-fieldset">
        <legend>Deployment</legend>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <fl-field label="Port" for="deploy-port" [hint]="portHint()">
            @if (exposedPorts().length > 1) {
              <span class="fl-select-wrap">
                <select
                  id="deploy-port"
                  class="fl-select fl-mono"
                  [value]="port()"
                  (change)="portChange.emit(+$any($event.target).value)"
                >
                  @for (p of exposedPorts(); track p) {
                    <option [value]="p" [selected]="p === port()">{{ p }}</option>
                  }
                </select>
              </span>
            } @else {
              <div class="fl-input fl-input--lg">
                <input
                  id="deploy-port"
                  type="number"
                  class="fl-mono"
                  min="1"
                  max="65535"
                  placeholder="80, 3000, 8080"
                  [value]="port() ?? ''"
                  (input)="portChange.emit(+$any($event.target).value || null)"
                />
              </div>
            }
          </fl-field>
          <fl-field
            label="Replicas"
            for="deploy-replicas"
            [hint]="autoscale() ? 'Fewest replicas.' : 'Number of pod replicas.'"
          >
            <div class="fl-input fl-input--lg">
              <input
                id="deploy-replicas"
                type="number"
                class="fl-num"
                min="1"
                max="20"
                [value]="replicas()"
                (input)="replicasChange.emit(+$any($event.target).value)"
              />
            </div>
          </fl-field>
        </div>
        @if (portDiscovering()) {
          <fl-status tone="progress" label="Detecting the port from the image" />
        }
        <div class="flex flex-col gap-1">
          <label class="fl-check" data-testid="wizard-autoscale">
            <input
              type="checkbox"
              [checked]="autoscale()"
              (change)="autoscaleChange.emit($any($event.target).checked)"
            />
            Follow the load, up to
            <span class="fl-input w-16">
              <input
                type="number"
                class="fl-num"
                min="2"
                max="20"
                aria-label="Most replicas"
                [value]="maxReplicas()"
                [disabled]="!autoscale()"
                (input)="maxReplicasChange.emit(+$any($event.target).value)"
                data-testid="wizard-autoscale-max"
              />
            </span>
            replicas
          </label>
          @if (autoscale() && maxReplicas() <= replicas()) {
            <span class="fl-field__error" role="alert">The most has to be above the fewest.</span>
          }
        </div>
      </fieldset>

      <fieldset class="fl-fieldset">
        <legend>Resource profile</legend>
        @if (loadingProfiles()) {
          <fl-status tone="progress" label="Loading profiles" />
        } @else if (profiles().length > 0) {
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            @for (profile of profiles(); track profile.name) {
              <label class="fl-radiocard">
                <input
                  type="radio"
                  name="deploy-resource-profile"
                  [checked]="selectedProfile() === profile.name"
                  (change)="profileChange.emit(profile.name)"
                />
                <span class="fl-radiocard__text">
                  <span class="fl-radiocard__title">{{ label(profile.name) }}</span>
                  <span class="fl-radiocard__desc fl-mono">{{ cpu(profile) }} CPU</span>
                  <span class="fl-radiocard__desc fl-mono">{{ memory(profile) }} RAM</span>
                </span>
              </label>
            }
          </div>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            @if (selectedDescription()) {
              {{ selectedDescription() }}.
            }
            You can change the limits after deployment in the application settings.
          </p>
        }
      </fieldset>
    }
  `,
})
export class DeployStepEnvironment {
  readonly flow = input<FlowSubtype>(null);
  readonly isImage = input(false);
  readonly newRepo = input('');
  readonly loadingBranches = input(false);
  readonly branches = input<readonly string[]>([]);
  readonly branch = input('');
  readonly branchesFailed = input(false);
  readonly credentialProblem = input<GithubCredentialProblem | null>(null);
  readonly port = input<number | null>(null);
  readonly portDiscovering = input(false);
  readonly portAutoDetected = input(false);
  readonly exposedPorts = input<readonly number[]>([]);
  readonly replicas = input(1);
  readonly autoscale = input(false);
  readonly maxReplicas = input(3);
  readonly loadingProfiles = input(false);
  readonly profiles = input<readonly ResourceProfileDto[]>([]);
  readonly selectedProfile = input('');
  readonly branchChange = output<string>();
  readonly portChange = output<number | null>();
  readonly replicasChange = output<number>();
  readonly autoscaleChange = output<boolean>();
  readonly maxReplicasChange = output<number>();
  readonly profileChange = output<string>();

  protected readonly label = profileLabel;
  protected readonly cpu = profileCpu;
  protected readonly memory = profileMemory;

  protected readonly selectedDescription = computed(() =>
    this.profiles().some((p) => p.name === this.selectedProfile())
      ? profileDescription(this.selectedProfile())
      : '',
  );

  protected readonly portHint = computed(() => {
    if (this.exposedPorts().length > 1) {
      return `${this.exposedPorts().length} ports found in the image.`;
    }
    if (this.portAutoDetected() && this.port()) return 'Detected from the image.';
    if (!this.port() && !this.portDiscovering()) return 'The port the container listens on.';
    return '';
  });
}
