import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideLoader, lucideUserPlus } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ApplicationService } from '../../service/application.service';
import { AppIdentityLink, AppIdentityService, IdentityInstall, IdentityUser } from '../../service/app-identity.service';
import { consoleError } from '../database-console/search-format';

const IDENTITY_COMPONENT = 'zitadel';

@Component({
  selector: 'app-identity-tab',
  standalone: true,
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideKeyRound, lucideLoader, lucideUserPlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (error()) {
        <p class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="identity-error">
          {{ error() }}
        </p>
      }

      @if (isServer()) {
        <section class="rounded-xl border border-border bg-card p-5" data-testid="identity-people">
          <h2 class="text-base font-semibold text-foreground">People</h2>
          <p class="mt-1 text-sm text-muted-foreground">Who can sign in to the apps connected to this identity install.</p>

          <form class="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" (ngSubmit)="invite()">
            <input class="rounded-md border border-input bg-background px-3 py-2 text-sm" name="email" type="email" placeholder="Email" [(ngModel)]="email" required />
            <input class="rounded-md border border-input bg-background px-3 py-2 text-sm" name="given" placeholder="First name" [(ngModel)]="givenName" required />
            <input class="rounded-md border border-input bg-background px-3 py-2 text-sm" name="family" placeholder="Last name" [(ngModel)]="familyName" required />
            <button type="submit" [disabled]="busy()" class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <ng-icon name="lucideUserPlus" class="h-4 w-4" /> Invite
            </button>
          </form>

          @if (loading()) {
            <p class="mt-4 text-sm text-muted-foreground"><ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" /> Loading…</p>
          } @else if (users().length === 0) {
            <p class="mt-4 text-sm text-muted-foreground">Nobody yet.</p>
          } @else {
            <ul class="mt-4 divide-y divide-border">
              @for (u of users(); track u.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span class="text-sm text-foreground">{{ u.email ?? u.username }}</span>
                  <span class="flex items-center gap-3">
                    <span class="text-xs" [class.text-muted-foreground]="u.state === 'active'" [class.text-destructive]="u.state !== 'active'">{{ u.state }}</span>
                    <button type="button" class="text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-50" [disabled]="busy()" (click)="toggle(u)">
                      {{ u.state === 'blocked' ? 'Unblock' : 'Block' }}
                    </button>
                  </span>
                </li>
              }
            </ul>
          }
        </section>
      } @else {
        <section class="rounded-xl border border-border bg-card p-5" data-testid="identity-link">
          <h2 class="flex items-center gap-2 text-base font-semibold text-foreground">
            <ng-icon name="lucideKeyRound" class="h-4 w-4" /> Sign-in for this app's users
          </h2>
          @if (link(); as l) {
            <dl class="mt-3 grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
              <dt class="text-muted-foreground">Identity</dt><dd class="text-foreground">{{ l.issuer }}</dd>
              <dt class="text-muted-foreground">Client id</dt><dd class="font-mono text-foreground">{{ l.clientId }}</dd>
              <dt class="text-muted-foreground">Returns to</dt><dd class="text-foreground">{{ l.redirectUris.join(', ') }}</dd>
              <dt class="text-muted-foreground">Variables</dt>
              <dd class="font-mono text-foreground">{{ l.envNames.issuer }}, {{ l.envNames.clientId }}, {{ l.envNames.clientSecret }}</dd>
            </dl>
            <button type="button" class="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50" [disabled]="busy()" (click)="disconnect()">
              Disconnect
            </button>
          } @else if (installs().length === 0) {
            <p class="mt-2 text-sm text-muted-foreground">
              No identity install yet. Install Zitadel from the catalog to sign this app's users in with it.
            </p>
          } @else {
            <p class="mt-1 text-sm text-muted-foreground">
              The app receives only the issuer, client id and client secret, and is redeployed.
            </p>
            <form class="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" (ngSubmit)="connect()">
              <select class="rounded-md border border-input bg-background px-3 py-2 text-sm" name="install" [(ngModel)]="installId" required>
                @for (i of installs(); track i.identityInstallId) {
                  <option [value]="i.identityInstallId" [disabled]="!i.managed">{{ i.name }}{{ i.managed ? '' : ' — reinstall to manage from Flui' }}</option>
                }
              </select>
              <input class="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" name="path" placeholder="/auth/callback" [(ngModel)]="redirectPath" required />
              <button type="submit" [disabled]="busy()" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Connect</button>
            </form>
          }
        </section>
      }
    </div>
  `,
})
export class AppIdentityTabComponent {
  private readonly appService = inject(ApplicationService);
  private readonly identity = inject(AppIdentityService);

  private readonly app = computed(() => this.appService.selectedApplication());
  readonly isServer = computed(
    () => (this.app()?.metadata as { composedComponent?: string } | undefined)?.composedComponent === IDENTITY_COMPONENT,
  );
  private readonly installId_ = computed(
    () => (this.app()?.metadata as { catalogInstallId?: string } | undefined)?.catalogInstallId ?? null,
  );

  readonly users = signal<IdentityUser[]>([]);
  readonly installs = signal<IdentityInstall[]>([]);
  readonly link = signal<AppIdentityLink | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

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
        this.identity.invite(install, { email: this.email.trim(), givenName: this.givenName.trim(), familyName: this.familyName.trim() }),
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
        list.map((u) => (u.id === user.id ? { ...u, state: user.state === 'blocked' ? 'active' : 'blocked' } : u)),
      );
    });
  }

  connect(): Promise<void> {
    const app = this.app();
    if (!app || !this.installId) return Promise.resolve();
    return this.run(async () => {
      this.link.set(
        await firstValueFrom(this.identity.connect(app.id, { identityInstallId: this.installId, redirectPaths: [this.redirectPath.trim()] })),
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
