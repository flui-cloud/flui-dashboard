import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink, lucideGithub, lucideShieldAlert } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { GitHubSetupStatusResponseDto } from '../../../core/api/model/gitHubSetupStatusResponseDto';
import { GithubConnectComponent } from './github-connect.component';
import { RepositoriesPageState } from './repositories-list-surface';

const STATE_STATUS: Record<RepositoriesPageState, { tone: StatusTone; label: string }> = {
  initializing: { tone: 'progress', label: 'Checking' },
  refused: { tone: 'neutral', label: 'Not available' },
  'not-configured-admin': { tone: 'neutral', label: 'Not set up' },
  'not-configured-user': { tone: 'neutral', label: 'Not set up' },
  'misconfigured-admin': { tone: 'error', label: 'Check failed' },
  'misconfigured-user': { tone: 'error', label: 'Check failed' },
  'not-connected': { tone: 'neutral', label: 'Not connected' },
  connected: { tone: 'success', label: 'Connected' },
};

@Component({
  selector: 'app-repositories-connection',
  imports: [
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
    GithubConnectComponent,
  ],
  providers: [provideIcons({ lucideExternalLink, lucideGithub, lucideShieldAlert })],
  template: `
    <fl-panel title="GitHub connection">
      <ng-container panelActions>
        <fl-status [tone]="status().tone" [label]="status().label" />
        @if (state() === 'connected') {
          @if (isApp()) {
            <a flButton size="sm" [href]="configUrl()" target="_blank" rel="noopener noreferrer">
              Manage permissions
              <fl-icon name="lucideExternalLink" [size]="14" />
            </a>
          } @else {
            <button flButton size="sm" type="button" (click)="disconnect.emit()">Disconnect</button>
          }
        }
      </ng-container>

      @switch (state()) {
        @case ('initializing') {
          <fl-loading-state [rows]="2" />
        }
        @case ('connected') {
          <fl-key-value>
            <fl-kv-item key="Method">{{
              isApp() ? 'GitHub App' : 'Personal access token'
            }}</fl-kv-item>
            @if (!isApp() && username()) {
              <fl-kv-item key="Account" [mono]="true">&#64;{{ username() }}</fl-kv-item>
            }
          </fl-key-value>
        }
        @case ('not-connected') {
          @if (authMethod(); as method) {
            <app-github-connect
              [authMethod]="method"
              [appSlug]="appSlug()"
              (connected)="connected.emit($event)"
            />
          }
        }
        @case ('refused') {
          <fl-empty-state
            [compact]="true"
            icon="lucideGithub"
            title="Not part of the trial"
            body="Connecting a source repository belongs to the instance, not to a tenancy. Deploy from a container image here: your own applications are real and yours to change."
          />
        }
        @case ('not-configured-admin') {
          <fl-empty-state
            [compact]="true"
            icon="lucideGithub"
            title="GitHub is not set up"
            body="Set up the GitHub integration before anyone can connect an account."
          >
            <button flButton="primary" size="sm" type="button" (click)="setup.emit()">
              Set up GitHub
            </button>
          </fl-empty-state>
        }
        @case ('not-configured-user') {
          <fl-empty-state
            [compact]="true"
            icon="lucideShieldAlert"
            title="GitHub is not set up"
            body="Ask an administrator to set up the GitHub integration."
          />
        }
        @case ('misconfigured-admin') {
          <fl-alert tone="error" title="GitHub check failed">
            Flui has GitHub App credentials, but a live check against GitHub failed. The app may
            have been deleted or its private key revoked.
            <span class="fl-mono block">{{ healthError() }}</span>
            <button alertActions flButton="primary" size="sm" type="button" (click)="setup.emit()">
              Reconfigure GitHub
            </button>
          </fl-alert>
        }
        @case ('misconfigured-user') {
          <fl-alert tone="error" title="GitHub check failed">
            Connecting to GitHub is failing. Ask an administrator to reconfigure the integration.
          </fl-alert>
        }
      }
    </fl-panel>
  `,
})
export class RepositoriesConnection {
  readonly state = input.required<RepositoriesPageState>();
  readonly authMethod = input<GitHubSetupStatusResponseDto.AuthMethodEnum | null>(null);
  readonly appSlug = input<string>();
  readonly username = input<string>();
  readonly configUrl = input.required<string>();
  readonly healthError = input('');
  readonly setup = output<void>();
  readonly disconnect = output<void>();
  readonly connected = output<{ username: string }>();

  protected readonly isApp = computed(() => this.authMethod() === 'github_app');
  protected readonly status = computed(() => STATE_STATUS[this.state()]);
}
