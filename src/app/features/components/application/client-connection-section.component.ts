import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideDatabase,
  lucideLoader,
  lucidePlug,
  lucidePower,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import {
  CatalogDetailResponseDto,
  CatalogInstallResponseDto,
} from '../../../core/api/model/models';
import { Application } from '../../model/application.models';
import { BbInstancePickerModalComponent } from './bb-instance-picker-modal.component';

@Component({
  selector: 'app-client-connection-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, BbInstancePickerModalComponent],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideDatabase,
      lucideLoader,
      lucidePlug,
      lucidePower,
      lucideRefreshCw,
      lucideTriangleAlert,
    }),
  ],
  template: `
    @if (isClient()) {
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <ng-icon name="lucideDatabase" class="h-4 w-4 text-primary" />
          <h3 class="text-sm font-semibold text-foreground">
            Connection
          </h3>
        </div>

        @if (loading()) {
          <div class="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            Loading link status…
          </div>
        } @else if (error()) {
          <div class="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5 mt-0.5" />
            <div>{{ error() }}</div>
          </div>
        } @else if (!install()?.connectedInstallId) {
          <p class="mt-2 text-xs text-muted-foreground">
            This client is installed but not connected to a
            <span class="font-mono">{{ bbRefs().join(' / ') }}</span> yet. It will start running
            once connected.
          </p>
          <button
            type="button"
            (click)="openPicker()"
            [disabled]="submitting()"
            class="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <ng-icon name="lucidePlug" class="h-3 w-3" />
            Connect to database
          </button>
        } @else {
          <div class="mt-3 space-y-2">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <ng-icon name="lucideCircleCheck" class="h-4 w-4 text-emerald-500" />
              <span class="text-muted-foreground">Connected to</span>
              <span class="font-mono font-medium text-foreground">
                {{ install()?.connectedSlug ?? bbRef() }}
              </span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {{ install()!.connectedInstallId!.slice(0, 8) }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              Credentials are wired via the database's internal Secret. Changing the
              target will rolling-restart this client.
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                (click)="openPicker()"
                [disabled]="submitting()"
                class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                <ng-icon name="lucideRefreshCw" class="h-3 w-3" />
                Change database
              </button>
              <button
                type="button"
                (click)="disconnect()"
                [disabled]="submitting()"
                class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Remove the link. The pod stays running but disconnected."
              >
                @if (submitting()) {
                  <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                } @else {
                  <ng-icon name="lucidePower" class="h-3 w-3" />
                }
                Disconnect
              </button>
            </div>
          </div>
        }
      </div>

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
