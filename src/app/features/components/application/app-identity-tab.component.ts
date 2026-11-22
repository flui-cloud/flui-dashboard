import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideUserPlus } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import {
  AppIdentityLink,
  AppIdentityService,
  IdentityInstall,
  IdentityUser,
} from '../../service/app-identity.service';
import { consoleError } from '../database-console/search-format';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const IDENTITY_COMPONENT = 'zitadel';

const USER_TONE: Record<IdentityUser['state'], StatusTone> = {
  active: 'success',
  invited: 'progress',
  blocked: 'error',
  locked: 'warning',
};

const USER_STATE: Record<IdentityUser['state'], string> = {
  active: 'Active',
  invited: 'Invited',
  blocked: 'Blocked',
  locked: 'Locked',
};

@Component({
  selector: 'app-identity-tab',
  imports: [
    FormsModule,
    FlPanel,
    FlTable,
    FlAlert,
    FlField,
    FlCopyId,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
  ],
  providers: [provideIcons({ lucideUserPlus })],
  host: { class: 'fl-stack' },
  template: `
    @if (error()) {
      <fl-alert tone="error" title="Request failed" data-testid="identity-error">{{
        error()
      }}</fl-alert>
    }

    @if (isServer()) {
      <fl-panel
        title="People"
        [count]="loading() ? null : users().length"
        [flush]="true"
        data-testid="identity-people"
      >
        <form
          class="grid items-end gap-3 border-b border-fl-border p-4 sm:grid-cols-2 lg:grid-cols-4"
          (ngSubmit)="invite()"
        >
          <fl-field label="Email" for="identity-email">
            <div class="fl-input fl-input--lg">
              <input id="identity-email" name="email" type="email" [(ngModel)]="email" required />
            </div>
          </fl-field>
          <fl-field label="First name" for="identity-given">
            <div class="fl-input fl-input--lg">
              <input id="identity-given" name="given" [(ngModel)]="givenName" required />
            </div>
          </fl-field>
          <fl-field label="Last name" for="identity-family">
            <div class="fl-input fl-input--lg">
              <input id="identity-family" name="family" [(ngModel)]="familyName" required />
            </div>
          </fl-field>
          <div>
            <button flButton="primary" type="submit" [disabled]="busy()">
              <fl-icon name="lucideUserPlus" />
              Invite
            </button>
          </div>
        </form>
        @if (loading()) {
          <fl-loading-state [rows]="3" />
        } @else if (users().length === 0) {
          <fl-empty-state
            [compact]="true"
            title="Nobody yet"
            body="People invited here can sign in to the apps connected to this identity install."
          />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">State</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr>
                    <td>
                      @if (u.email) {
                        {{ u.email }}
                      } @else {
                        <span class="fl-mono">{{ u.username }}</span>
                      }
                    </td>
                    <td><fl-status [tone]="userTone[u.state]" [label]="userState[u.state]" /></td>
                    <td class="is-fit">
                      <button
                        flButton
                        size="sm"
                        type="button"
                        [disabled]="busy()"
                        (click)="toggle(u)"
                      >
                        {{ u.state === 'blocked' ? 'Unblock' : 'Block' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    } @else {
      <fl-panel title="Sign-in" data-testid="identity-link">
        @if (link()) {
          <button
            panelActions
            flButton
            size="sm"
            type="button"
            [disabled]="busy()"
            (click)="disconnect()"
          >
            Disconnect
          </button>
        }
        @if (link(); as l) {
          <div class="flex flex-col gap-4">
            <fl-status tone="success" label="Connected" />
            <fl-key-value>
              <fl-kv-item key="Identity" [mono]="true">{{ l.issuer }}</fl-kv-item>
              <fl-kv-item key="Client ID">
                <fl-copy-id [value]="l.clientId" label="client ID" />
              </fl-kv-item>
              <fl-kv-item key="Returns to" [mono]="true">{{
                l.redirectUris.join(', ')
              }}</fl-kv-item>
              <fl-kv-item key="Variables" [mono]="true"
                >{{ l.envNames.issuer }}, {{ l.envNames.clientId }},
                {{ l.envNames.clientSecret }}</fl-kv-item
              >
            </fl-key-value>
          </div>
        } @else if (installs().length === 0) {
          <div class="flex flex-col gap-3">
            <fl-status tone="neutral" label="Not connected" />
            <p class="text-fl-body-sm text-fl-ink-muted">
              No identity install yet. Install Zitadel from the catalog to sign this app's users in
              with it.
            </p>
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            <fl-status tone="neutral" label="Not connected" />
            <p class="text-fl-body-sm text-fl-ink-muted">
              The app receives only the issuer, client ID and client secret, and is redeployed.
            </p>
            <form class="grid items-end gap-3 sm:grid-cols-3" (ngSubmit)="connect()">
              <fl-field label="Identity install" for="identity-install">
                <span class="fl-select-wrap">
                  <select
                    id="identity-install"
                    class="fl-select"
                    name="install"
                    [(ngModel)]="installId"
                    required
                  >
                    @for (i of installs(); track i.identityInstallId) {
                      <option [value]="i.identityInstallId" [disabled]="!i.managed">
                        {{ i.name }}{{ i.managed ? '' : ' (reinstall to manage from Flui)' }}
                      </option>
                    }
                  </select>
                </span>
              </fl-field>
              <fl-field label="Callback path" for="identity-path">
                <div class="fl-input fl-input--lg">
                  <input
                    id="identity-path"
                    class="fl-mono"
                    name="path"
                    placeholder="/auth/callback"
                    [(ngModel)]="redirectPath"
                    required
                  />
                </div>
              </fl-field>
              <div>
                <button flButton="primary" type="submit" [disabled]="busy()">Connect</button>
              </div>
            </form>
          </div>
        }
      </fl-panel>
    }
  `,
})
export class AppIdentityTabComponent {
  private readonly appService = inject(ApplicationService);
  private readonly identity = inject(AppIdentityService);

  private readonly app = computed(() => this.appService.selectedApplication());
  readonly isServer = computed(
    () =>
      (this.app()?.metadata as { composedComponent?: string } | undefined)?.composedComponent ===
      IDENTITY_COMPONENT,
  );
  private readonly installId_ = computed(
    () =>
      (this.app()?.metadata as { catalogInstallId?: string } | undefined)?.catalogInstallId ?? null,
  );

  readonly users = signal<IdentityUser[]>([]);
  readonly installs = signal<IdentityInstall[]>([]);
  readonly link = signal<AppIdentityLink | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly userTone = USER_TONE;
  readonly userState = USER_STATE;

  email = '';
  givenName = '';
  familyName = '';
  installId = '';
  redirectPath = '/auth/callback';

  constructor() {
    effect(() => {
      const app = this.app();
      if (app) void this.load();
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(consoleError(e));
    } finally {
      this.busy.set(false);
    }
  }

  async load(): Promise<void> {
    const app = this.app();
    if (!app) return;
    this.loading.set(true);
    try {
      if (this.isServer()) {
        const install = this.installId_();
        if (install) this.users.set(await firstValueFrom(this.identity.users(install)));
      } else {
        this.link.set(await firstValueFrom(this.identity.link(app.id)));
        const installs = await firstValueFrom(this.identity.installs());
        this.installs.set(installs);
        this.installId = installs.find((i) => i.managed)?.identityInstallId ?? '';
      }
    } catch (e) {
      this.error.set(consoleError(e));
    } finally {
      this.loading.set(false);
    }
  }

  invite(): Promise<void> {
    const install = this.installId_();
    if (!install) return Promise.resolve();
    return this.run(async () => {
      await firstValueFrom(
        this.identity.invite(install, {
          email: this.email.trim(),
          givenName: this.givenName.trim(),
          familyName: this.familyName.trim(),
        }),
      );
      this.email = this.givenName = this.familyName = '';
      await this.load();
    });
  }

  toggle(user: IdentityUser): Promise<void> {
    const install = this.installId_();
    if (!install) return Promise.resolve();
    return this.run(async () => {
      await firstValueFrom(this.identity.setBlocked(install, user.id, user.state !== 'blocked'));
      this.users.update((list) =>
        list.map((u) =>
          u.id === user.id ? { ...u, state: user.state === 'blocked' ? 'active' : 'blocked' } : u,
        ),
      );
    });
  }

  connect(): Promise<void> {
    const app = this.app();
    if (!app || !this.installId) return Promise.resolve();
    return this.run(async () => {
      this.link.set(
        await firstValueFrom(
          this.identity.connect(app.id, {
            identityInstallId: this.installId,
            redirectPaths: [this.redirectPath.trim()],
          }),
        ),
      );
    });
  }

  disconnect(): Promise<void> {
    const app = this.app();
    if (!app) return Promise.resolve();
    return this.run(async () => {
      await firstValueFrom(this.identity.disconnect(app.id));
      this.link.set(null);
    });
  }
}
