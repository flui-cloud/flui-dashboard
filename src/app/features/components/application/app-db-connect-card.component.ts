import { Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideDatabase, lucideServer, lucideTerminal } from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api/model/models';
import { DbConnectionInfo } from '../../model/db-console.models';
import {
  DbEngine,
  consoleRouteFor,
  databaseEngineOf,
  engineDescriptor,
} from '../../model/db-engine';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-db-connect-card',
  imports: [RouterLink, NgTemplateOutlet, FlCopyId, FlKeyValue, FlKvItem, FlButton, FlIcon],
  providers: [provideIcons({ lucideDatabase, lucideServer, lucideTerminal })],
  host: { class: 'fl-stack' },
  template: `
    @let a = app();
    @if (variant() === 'card') {
      <div class="flex flex-col gap-1">
        <p class="text-fl-body-sm font-semibold text-fl-ink">Connect to this database</p>
        <p class="text-fl-body-sm text-fl-ink-muted">
          This database is not exposed outside the cluster. Use the built-in console, or open a
          local tunnel to connect a native client.
        </p>
      </div>
    }
    <div class="fl-row">
      <a flButton="primary" [routerLink]="[consoleRoute(), a.id]">
        <fl-icon name="lucideDatabase" />
        {{ openLabel() }}
      </a>
      <button
        flButton
        type="button"
        [attr.aria-expanded]="showExternal()"
        (click)="toggle('external')"
      >
        <fl-icon name="lucideTerminal" />
        External client
      </button>
      <button
        flButton
        type="button"
        [attr.aria-expanded]="showInternal()"
        (click)="toggle('internal')"
      >
        <fl-icon name="lucideServer" />
        Use from another app
      </button>
    </div>
    @if (showExternal()) {
      <ng-container *ngTemplateOutlet="externalPanel" />
    }
    @if (showInternal()) {
      <ng-container *ngTemplateOutlet="internalPanel" />
    }

    <ng-template #externalPanel>
      <section class="flex flex-col gap-3 border-t border-fl-border pt-4">
        <p class="text-fl-body-sm font-semibold text-fl-ink">
          Connect with an external client ({{ engineUi().externalClients }})
        </p>
        <div class="flex flex-col gap-1">
          <p class="text-fl-body-sm text-fl-ink-muted">
            1. Open a local tunnel (requires the flui CLI)
          </p>
          <fl-copy-id [value]="tunnelCommand(a.slug)" label="tunnel command" />
        </div>
        <p class="text-fl-body-sm text-fl-ink-muted">2. Connect your client to</p>
        @let ci = connInfo();
        <fl-key-value>
          <fl-kv-item key="Host"><fl-copy-id value="127.0.0.1" label="host" /></fl-kv-item>
          <fl-kv-item key="Port" [mono]="true">{{ localPort() }}</fl-kv-item>
          <fl-kv-item key="Database" [mono]="true">{{ ci?.database ?? '…' }}</fl-kv-item>
          <fl-kv-item key="User">
            @if (ci?.user; as user) {
              <fl-copy-id [value]="user" label="user" />
            } @else {
              <span class="fl-mono">…</span>
            }
          </fl-kv-item>
          <fl-kv-item key="Password">
            <span class="text-fl-ink-muted">Printed by the tunnel command</span>
          </fl-kv-item>
        </fl-key-value>
        <p class="text-fl-caption text-fl-ink-muted">
          The command reads the password from the cluster Secret over SSH and prints it locally. The
          dashboard never displays it.
        </p>
      </section>
    </ng-template>

    <ng-template #internalPanel>
      <section class="flex flex-col gap-3 border-t border-fl-border pt-4">
        <p class="text-fl-body-sm font-semibold text-fl-ink">Use from another app on Flui</p>
        <p class="text-fl-body-sm text-fl-ink-muted">
          An app on the same cluster connects to the internal service directly, without a tunnel.
          Add these values to its environment.
        </p>
        @let ci2 = connInfo();
        <fl-key-value>
          <fl-kv-item key="Host">
            @if (internalHost()) {
              <fl-copy-id [value]="internalHost()" label="host" />
            } @else {
              <span class="fl-mono">…</span>
            }
          </fl-kv-item>
          <fl-kv-item key="Port" [mono]="true">{{
            ci2?.remotePort ?? engineUi().defaultPort
          }}</fl-kv-item>
          <fl-kv-item key="Database" [mono]="true">{{ ci2?.database ?? '…' }}</fl-kv-item>
          <fl-kv-item key="User">
            @if (ci2?.user; as user) {
              <fl-copy-id [value]="user" label="user" />
            } @else {
              <span class="fl-mono">…</span>
            }
          </fl-kv-item>
          <fl-kv-item key="Password">
            <fl-copy-id [value]="credentialsCommand(a.slug)" label="credentials command" />
          </fl-kv-item>
          <fl-kv-item key="Connection string (DATABASE_URL)">
            @if (internalUrl()) {
              <fl-copy-id [value]="internalUrl()" label="connection string" />
            } @else {
              <span class="fl-mono">…</span>
            }
          </fl-kv-item>
        </fl-key-value>
        <p class="text-fl-caption text-fl-ink-muted">
          Get the password with the credentials command. Only the CLI shows it, never the dashboard.
        </p>
      </section>
    </ng-template>
  `,
})
export class AppDbConnectCardComponent {
  readonly app = input.required<ApplicationResponseDto>();
  readonly connInfo = input<DbConnectionInfo | null>(null);
  /** `block` sits inside a page section that names it: the three ways to connect as one row of buttons. */
  readonly variant = input<'card' | 'block'>('card');

  protected readonly showExternal = signal(false);
  protected readonly showInternal = signal(false);

  protected readonly engine = computed<DbEngine>(
    () => this.connInfo()?.engine ?? databaseEngineOf(this.app()) ?? 'postgres',
  );
  protected readonly engineUi = computed(() => engineDescriptor(this.engine()));
  protected readonly consoleRoute = computed(() => consoleRouteFor(this.app()) ?? '/db-console');

  protected openLabel(): string {
    switch (this.engineUi().family) {
      case 'keyvalue':
        return 'Open Key Browser';
      case 'document':
        return 'Open Document Browser';
      case 'object-storage':
        return 'Open Storage Browser';
      case 'search':
        return 'Open Search Console';
      case 'messaging':
        return 'Open Messaging Console';
      case 'cache':
        return 'Open Cache Console';
      case 'secrets':
        return 'Open Secrets Console';
      case 'streaming':
        return 'Open Kafka Console';
      case 'fulltext':
        return 'Open Meilisearch Console';
      default:
        return 'Open SQL Console';
    }
  }

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

  protected toggle(which: 'external' | 'internal'): void {
    const open = which === 'external' ? !this.showExternal() : !this.showInternal();
    this.showExternal.set(which === 'external' && open);
    this.showInternal.set(which === 'internal' && open);
  }
}
