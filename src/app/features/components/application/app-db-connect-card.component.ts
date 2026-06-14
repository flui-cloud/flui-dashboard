import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideCopy,
  lucideDatabase,
  lucideServer,
  lucideTerminal,
} from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api/model/models';
import { DbConnectionInfo } from '../../model/db-console.models';
import {
  DbEngine,
  consoleRouteFor,
  databaseEngineOf,
  engineDescriptor,
} from '../../model/db-engine';

@Component({
  selector: 'app-db-connect-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIcon],
  providers: [
    provideIcons({
      lucideChevronRight,
      lucideCopy,
      lucideDatabase,
      lucideServer,
      lucideTerminal,
    }),
  ],
  template: `
    @let a = app();
    <div class="mt-6 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div class="flex items-start gap-3">
        <ng-icon name="lucideDatabase" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-foreground">Connect to this database</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            This database isn't exposed outside the cluster. Use the built-in
            console, or open a local tunnel to connect a native client.
          </p>
        </div>
      </div>

      <a
        [routerLink]="[consoleRoute(), a.id]"
        class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <ng-icon name="lucideDatabase" class="h-4 w-4" />
        {{ engineUi().family === 'keyvalue' ? 'Open Key Browser' : 'Open SQL Console' }}
      </a>

      <div class="rounded-md border border-border bg-background">
        <button
          type="button"
          (click)="showExternal.set(!showExternal())"
          class="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground"
        >
          <ng-icon name="lucideTerminal" class="h-3.5 w-3.5" />
          Connect with an external client ({{ engineUi().externalClients }})
          <ng-icon
            name="lucideChevronRight"
            class="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform"
            [class.rotate-90]="showExternal()"
          />
        </button>
        @if (showExternal()) {
          <div class="space-y-2 border-t border-border px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              1 — open a local tunnel (requires the flui CLI):
            </p>
            <div class="flex items-center gap-2">
              <code class="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{{ tunnelCommand(a.slug) }}</code>
              <button
                type="button"
                (click)="copyText(tunnelCommand(a.slug))"
                class="shrink-0 rounded border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copy"
              >
                <ng-icon name="lucideCopy" class="h-3.5 w-3.5" />
              </button>
            </div>
            <p class="text-xs text-muted-foreground">2 — connect your client to:</p>
            @let ci = connInfo();
            <div class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <span class="text-muted-foreground">Host</span><span>127.0.0.1</span>
              <span class="text-muted-foreground">Port</span><span>{{ localPort() }}</span>
              <span class="text-muted-foreground">Database</span><span>{{ ci?.database ?? '…' }}</span>
              <span class="text-muted-foreground">User</span><span>{{ ci?.user ?? '…' }}</span>
              <span class="text-muted-foreground">Password</span>
              <span class="text-muted-foreground">printed by the command above</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              The command prints the password locally (read from the cluster
              Secret over SSH). The dashboard never displays or exposes it.
            </p>
          </div>
        }
      </div>

      <div class="rounded-md border border-border bg-background">
        <button
          type="button"
          (click)="showInternal.set(!showInternal())"
          class="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground"
        >
          <ng-icon name="lucideServer" class="h-3.5 w-3.5" />
          Use from another app on Flui
          <ng-icon
            name="lucideChevronRight"
            class="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform"
            [class.rotate-90]="showInternal()"
          />
        </button>
        @if (showInternal()) {
          <div class="space-y-2 border-t border-border px-3 py-2.5">
            <p class="text-xs text-muted-foreground">
              An app running on Flui (same cluster) connects directly to the
              internal service — no tunnel. Wire these into its environment.
            </p>
            @let ci2 = connInfo();
            <div class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <span class="text-muted-foreground">Host</span>
              <span class="flex min-w-0 items-center gap-2">
                <span class="min-w-0 truncate">{{ internalHost() }}</span>
                <button
                  type="button"
                  (click)="copyText(internalHost())"
                  class="shrink-0 rounded border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy"
                >
                  <ng-icon name="lucideCopy" class="h-3 w-3" />
                </button>
              </span>
              <span class="text-muted-foreground">Port</span><span>{{ ci2?.remotePort ?? engineUi().defaultPort }}</span>
              <span class="text-muted-foreground">Database</span><span>{{ ci2?.database ?? '…' }}</span>
              <span class="text-muted-foreground">User</span><span>{{ ci2?.user ?? '…' }}</span>
              <span class="text-muted-foreground">Password</span>
              <span class="flex min-w-0 items-center gap-2">
                <code class="min-w-0 truncate rounded bg-muted px-1.5 py-0.5">{{ credentialsCommand(a.slug) }}</code>
                <button
                  type="button"
                  (click)="copyText(credentialsCommand(a.slug))"
                  class="shrink-0 rounded border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Copy"
                >
                  <ng-icon name="lucideCopy" class="h-3 w-3" />
                </button>
              </span>
            </div>
            <p class="text-xs text-muted-foreground">Connection string (DATABASE_URL):</p>
            <div class="flex items-center gap-2">
              <code class="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{{ internalUrl() }}</code>
              <button
                type="button"
                (click)="copyText(internalUrl())"
                class="shrink-0 rounded border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copy"
              >
                <ng-icon name="lucideCopy" class="h-3.5 w-3.5" />
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Same-cluster apps reach it at this internal address. Get the password
              with the command above (CLI only — the dashboard never shows it).
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class AppDbConnectCardComponent {
  readonly app = input.required<ApplicationResponseDto>();
  readonly connInfo = input<DbConnectionInfo | null>(null);

  protected readonly showExternal = signal(false);
  protected readonly showInternal = signal(false);

  protected readonly engine = computed<DbEngine>(
    () => this.connInfo()?.engine ?? databaseEngineOf(this.app()) ?? 'postgres',
  );
  protected readonly engineUi = computed(() => engineDescriptor(this.engine()));
  protected readonly consoleRoute = computed(
    () => consoleRouteFor(this.app()) ?? '/db-console',
  );

  protected localPort(): number {
    return this.engineUi().tunnelPort;
  }

  protected internalHost(): string {
    const ci = this.connInfo();
    if (!ci) return '';
    return `${this.app().slug}-svc.${ci.namespace}.svc.cluster.local`;
  }

  protected internalUrl(): string {
    const ci = this.connInfo();
    const host = this.internalHost();
    if (!ci || !host) return '';
    return `${this.engineUi().urlScheme}://${ci.user}:<password>@${host}:${ci.remotePort}/${ci.database}`;
  }

  protected tunnelCommand(slug: string): string {
    return `flui db tunnel ${slug}`;
  }

  protected credentialsCommand(slug: string): string {
    return `flui db credentials ${slug} --show`;
  }

  protected copyText(text: string): void {
    void navigator.clipboard?.writeText(text);
  }
}
