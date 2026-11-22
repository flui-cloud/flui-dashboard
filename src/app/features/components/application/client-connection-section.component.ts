import { Component, OnChanges, computed, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlug, lucidePower, lucideRefreshCw } from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import {
  CatalogDetailResponseDto,
  CatalogInstallResponseDto,
} from '../../../core/api/model/models';
import { Application } from '../../model/application.models';
import { BbInstancePickerModalComponent } from './bb-instance-picker-modal.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-client-connection-section',
  imports: [
    BbInstancePickerModalComponent,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlAlert,
    FlCopyId,
    FlLoadingState,
    FlStatus,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucidePlug, lucidePower, lucideRefreshCw })],
  template: `
    @if (isClient()) {
      <fl-panel title="Connection" [flush]="loading()">
        @if (loading()) {
          <fl-loading-state [rows]="2" />
        } @else if (error()) {
          <fl-alert tone="error" title="Connection error">{{ error() }}</fl-alert>
        } @else if (!install()?.connectedInstallId) {
          <div class="flex flex-col gap-3">
            <fl-status tone="neutral" label="Not connected" />
            <p class="text-fl-body-sm text-fl-ink-muted">
              This client is installed but not connected to
              <span class="fl-mono">{{ bbRefs().join(' / ') }}</span> yet. It starts once connected.
            </p>
            <div>
              <button
                flButton="secondary"
                size="sm"
                type="button"
                (click)="openPicker()"
                [disabled]="submitting()"
              >
                <fl-icon name="lucidePlug" />
                Connect to database
              </button>
            </div>
          </div>
        } @else {
          <div class="flex flex-col gap-4">
            <fl-status tone="success" label="Connected" />
            <fl-key-value class="fl-kv--compact">
              <fl-kv-item key="Database" [mono]="true">{{
                install()?.connectedSlug ?? bbRef()
              }}</fl-kv-item>
              <fl-kv-item key="Instance">
                <fl-copy-id
                  [value]="install()!.connectedInstallId!"
                  label="instance ID"
                  [display]="install()!.connectedInstallId!.slice(0, 8)"
                />
              </fl-kv-item>
            </fl-key-value>
            <p class="text-fl-body-sm text-fl-ink-muted">
              Credentials come from the database's internal secret. Changing the target restarts
              this client.
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <button
                flButton="secondary"
                size="sm"
                type="button"
                (click)="openPicker()"
                [disabled]="submitting()"
              >
                <fl-icon name="lucideRefreshCw" />
                Change database
              </button>
              <button
                flButton="secondary"
                size="sm"
                type="button"
                (click)="disconnect()"
                [disabled]="submitting()"
                title="Remove the link. The pod stays running but disconnected."
              >
                @if (submitting()) {
                  <fl-spinner label="Disconnecting" />
                } @else {
                  <fl-icon name="lucidePower" />
                }
                Disconnect
              </button>
            </div>
          </div>
        }
      </fl-panel>

      @if (pickerOpen() && bbRefs().length > 0 && clusterId()) {
        <app-bb-instance-picker-modal
          [bbSlugs]="bbRefs()"
          [clusterId]="clusterId()!"
          [currentConnectedInstallId]="install()?.connectedInstallId ?? null"
          [initialSlugFilter]="install()?.connectedSlug ?? null"
          [title]="install()?.connectedInstallId ? 'Change database' : 'Connect to database'"
          [confirmLabel]="install()?.connectedInstallId ? 'Switch' : 'Connect'"
          [submitting]="submitting()"
          (picked)="onPicked($event)"
          (cancelled)="pickerOpen.set(false)"
        />
      }
    }
  `,
})
export class ClientConnectionSectionComponent implements OnChanges {
  private readonly catalog = inject(CatalogService);

  readonly application = input.required<Application | null>();

  protected readonly detail = signal<CatalogDetailResponseDto | null>(null);
  protected readonly install = signal<CatalogInstallResponseDto | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pickerOpen = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  protected readonly bbRefs = computed<string[]>(() => {
    const links = this.detail()?.linkedBuildingBlocks as Array<{ ref?: string }> | undefined;
    if (!links?.length) return [];
    return links.map((l) => l?.ref).filter((r): r is string => !!r);
  });
  protected readonly bbRef = computed<string | null>(() => this.bbRefs()[0] ?? null);
  protected readonly isClient = computed(() => this.bbRefs().length > 0);
  protected readonly clusterId = computed(() => this.application()?.clusterId ?? null);

  ngOnChanges(): void {
    this.reload();
  }

  private async reload(): Promise<void> {
    const app = this.application();
    if (!app?.catalogSlug || !app?.catalogInstallId) {
      this.detail.set(null);
      this.install.set(null);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const [detail, install] = await Promise.all([
        this.catalog.loadDetail(app.catalogSlug),
        this.catalog.getInstall(app.catalogInstallId),
      ]);
      this.detail.set(detail);
      this.install.set(install);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.error.set(e?.error?.message || e?.message || 'Failed to load connection info.');
    } finally {
      this.loading.set(false);
    }
  }

  protected openPicker(): void {
    this.pickerOpen.set(true);
  }

  protected async disconnect(): Promise<void> {
    const app = this.application();
    if (!app?.catalogInstallId) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const updated = await this.catalog.disconnect(app.catalogInstallId);
      if (updated) this.install.set(updated);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.error.set(e?.error?.message || e?.message || 'Disconnect failed.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onPicked(targetInstallId: string): Promise<void> {
    const app = this.application();
    if (!app?.catalogInstallId) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const updated = await this.catalog.connect(app.catalogInstallId, targetInstallId);
      if (updated) this.install.set(updated);
      this.pickerOpen.set(false);
    } catch (err) {
      const e = err as { error?: { message?: string }; message?: string };
      this.error.set(e?.error?.message || e?.message || 'Connect failed.');
    } finally {
      this.submitting.set(false);
    }
  }
}
