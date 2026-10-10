import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCloud,
  lucideHardDrive,
  lucideInfo,
  lucideLoader,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ToastService } from '../../../shared/services/toast.service';
import {
  ConnectRegistryBucket,
  OWN_BUCKET_PROVIDERS,
  REGISTRY_TRAFFIC_WINDOWS,
  RegistryBucket,
  RegistryTrafficWindow,
  formatMbitPerSecond,
  RegistryBucketProvider,
  SCALEWAY_REGION_LABELS,
  SCALEWAY_REGISTRY_REGIONS,
  ScalewayRegistryRegion,
  formatRegistrySize,
  measuredAgo,
  registryProviderLabel,
  usageGauge,
} from '../../model/registry-storage.models';
import { RegistryStorageService } from '../../service/registry-storage.service';
import {
  RegistryConnectOption,
  RegistryStorageSurfaceInput,
  RegistryStorageSurfaceRevision,
  buildRegistryStorageSurface,
  presentedContent,
} from './registry-storage-surface';

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

@Component({
  selector: 'app-registry-storage',
  standalone: true,
  imports: [DatePipe, FormsModule, NgIcon, ExplainComponent],
  providers: [
    provideIcons({
      lucideCloud,
      lucideHardDrive,
      lucideInfo,
      lucideLoader,
      lucideRefreshCw,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 p-4 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Image registry</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Where the images Flui builds for your applications are kept.
          </p>
        </div>
        @if (usage(); as u) {
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted-foreground" data-testid="registry-measured">
              Measured {{ ago(u.measuredAt) }}
            </span>
            <button
              type="button"
              data-testid="registry-measure"
              (click)="measure()"
              [disabled]="registry.measuring()"
              class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <ng-icon
                name="lucideRefreshCw"
                class="h-3.5 w-3.5"
                [class.animate-spin]="registry.measuring()"
              />
              {{ registry.measuring() ? 'Measuring…' : 'Measure now' }}
            </button>
          </div>
        }
      </div>

      @if (registry.refused()) {
        <div
          data-testid="registry-refused"
          class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          <ng-icon name="lucideInfo" class="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{{ registry.refusalMessage() }}</span>
        </div>
      }

      @if (registry.loadError(); as message) {
        <div
          data-testid="registry-error"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <span>{{ message }}</span>
          <button type="button" class="text-xs underline" (click)="reload()">Try again</button>
        </div>
      }

      @if (registry.status(); as status) {
        @if (usage(); as u) {
          <section class="card-surface p-5 space-y-4" data-testid="registry-usage">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="icon-chip icon-chip-sm chip-brand">
                  <ng-icon
                    [name]="status.backend === 's3' ? 'lucideCloud' : 'lucideHardDrive'"
                    class="h-4 w-4"
                  />
                </div>
                <div>
                  <p class="text-label">Images are kept on</p>
                  <p class="text-value" data-testid="registry-location">{{ location() }}</p>
                </div>
              </div>
              @if (u.alerting) {
                <span class="badge bg-amber-500/10 text-amber-600 dark:text-amber-400" data-testid="registry-alerting">
                  Space alert
                </span>
              }
            </div>

            <div class="space-y-2">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span class="text-2xl font-semibold" data-testid="registry-used">{{ size(u.totalBytes) }}</span>
                  <span class="ml-1 text-sm text-muted-foreground">in use</span>
                </p>
                <p class="text-xs text-muted-foreground" data-testid="registry-limit">{{ limitLine() }}</p>
              </div>
              @if (gauge(); as g) {
                @if (g.kind !== 'none') {
                  <div
                    class="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    [attr.aria-valuenow]="round(g.percent)"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      data-testid="registry-bar"
                      [class.bg-primary]="!u.alerting"
                      [class.bg-amber-500]="u.alerting"
                      [style.width.%]="g.percent"
                    ></div>
                    @if (g.kind === 'capacity' && g.alertPercent !== null) {
                      <div
                        class="absolute top-0 h-full w-0.5 bg-amber-500/70"
                        [style.left.%]="g.alertPercent"
                        title="Space alert"
                      ></div>
                    }
                  </div>
                }
              }
              @if (u.unreadable > 0) {
                <p class="text-xs text-muted-foreground">
                  {{ u.unreadable }} {{ u.unreadable === 1 ? 'application' : 'applications' }} could not be read on this pass.
                </p>
              }
            </div>
          </section>

          @if (!registry.trafficHidden()) {
            <section class="card-surface p-5 space-y-4" data-testid="registry-traffic">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-sm font-semibold">Traffic</h2>
                <div class="inline-flex rounded-md border border-border p-0.5 text-xs" role="tablist">
                  @for (w of trafficWindows; track w) {
                    <button
                      type="button"
                      role="tab"
                      [attr.data-testid]="'registry-traffic-' + w"
                      [attr.aria-selected]="registry.trafficWindow() === w"
                      (click)="setTrafficWindow(w)"
                      class="rounded px-2.5 py-1"
                      [class.bg-muted]="registry.trafficWindow() === w"
                      [class.font-medium]="registry.trafficWindow() === w"
                    >
                      {{ w }}
                    </button>
                  }
                </div>
              </div>

              @if (registry.traffic(); as t) {
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" [class.opacity-60]="registry.trafficLoading()">
                  <div class="card-inner p-3">
                    <p class="text-label">Pulls</p>
                    <p class="text-lg font-semibold" data-testid="registry-traffic-pulls">{{ t.requests.pulls }}</p>
                  </div>
                  <div class="card-inner p-3">
                    <p class="text-label">Pushes</p>
                    <p class="text-lg font-semibold" data-testid="registry-traffic-pushes">{{ t.requests.pushes }}</p>
                  </div>
                  <div class="card-inner p-3">
                    <p class="text-label">Pulled out</p>
                    <p class="text-lg font-semibold" data-testid="registry-traffic-out">{{ size(t.bytesOut) }}</p>
                  </div>
                  <div class="card-inner p-3">
                    <p class="text-label">Pushed in</p>
                    <p class="text-lg font-semibold" data-testid="registry-traffic-in">{{ size(t.bytesIn) }}</p>
                  </div>
                </div>
                <p class="text-xs text-muted-foreground" data-testid="registry-traffic-peak">
                  Busiest 5 minutes: {{ mbit(t.peakBytesPerSecondOut) }} out · {{ mbit(t.peakBytesPerSecondIn) }} in
                </p>
                <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" data-testid="registry-traffic-outcomes">
                  <span
                    data-testid="registry-traffic-refused"
                    title="over an application quota, an upload too large, or over the rate limit"
                    [class.text-amber-600]="t.outcomes.refused > 0"
                    [class.font-medium]="t.outcomes.refused > 0"
                  >
                    {{ t.outcomes.refused }} refused
                  </span>
                  <span
                    data-testid="registry-traffic-failed"
                    [class.text-destructive]="t.outcomes.failed > 0"
                    [class.font-medium]="t.outcomes.failed > 0"
                  >
                    {{ t.outcomes.failed }} failed
                  </span>
                </p>
                @if (t.readFromBucketBytes !== null) {
                  <p class="text-xs text-muted-foreground" data-testid="registry-traffic-bucket">
                    {{ size(t.readFromBucketBytes) }} read from the bucket to serve pulls; the provider may bill it as outgoing traffic.
                  </p>
                }
              } @else if (registry.trafficFailed()) {
                <p class="text-sm text-muted-foreground" data-testid="registry-traffic-failed-load">
                  Traffic could not be read right now.
                </p>
              } @else {
                <div class="skeleton h-16 w-full"></div>
              }
            </section>
          }

          <section class="card-surface" data-testid="registry-apps">
            <div class="border-b border-border px-5 py-3">
              <h2 class="text-sm font-semibold">Largest applications</h2>
              <p class="text-xs text-muted-foreground">
                A layer shared by several applications counts in each of them.
              </p>
            </div>
            @if (u.applications.length === 0) {
              <p class="px-5 py-4 text-sm text-muted-foreground">No application images yet.</p>
            } @else {
              <table class="w-full text-sm">
                <thead class="text-left text-xs text-muted-foreground">
                  <tr>
                    <th class="px-5 py-2 font-medium">Application</th>
                    <th class="px-5 py-2 text-right font-medium">Size</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (app of u.applications; track app.applicationId) {
                    <tr>
                      <td class="px-5 py-2.5">{{ app.name }}</td>
                      <td class="px-5 py-2.5 text-right font-mono text-xs">{{ size(app.bytes) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="card-surface p-5 space-y-4" data-testid="registry-bucket">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold">Bucket</h2>
                @if (!status.connected) {
                  <p class="text-xs text-muted-foreground">
                    @if (status.backend === 's3') {
                      The registry waits for a bucket. A bucket never fills up; you pay for the space used.
                    } @else {
                      This installation keeps images on a volume. A bucket connected here is used once the installation is set to object storage.
                    }
                  </p>
                }
              </div>
              @if (status.connected && !connectOpen()) {
                <button
                  type="button"
                  data-testid="registry-replace"
                  (click)="connectOpen.set(true)"
                  class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Replace bucket
                </button>
              }
            </div>

            @if (status.connected) {
              <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="registry-connected">
                <div>
                  <dt class="text-label">Provider</dt>
                  <dd class="text-sm">{{ providerLabel(status.provider) }}</dd>
                </div>
                <div>
                  <dt class="text-label">Region</dt>
                  <dd class="text-sm">{{ status.region || '—' }}</dd>
                </div>
                <div>
                  <dt class="text-label">Bucket</dt>
                  <dd class="text-sm font-mono break-all">{{ status.bucket || '—' }}</dd>
                </div>
              </dl>
              @if (status.connectedAt) {
                <p class="text-xs text-muted-foreground">Connected {{ status.connectedAt | date: 'd MMM y, HH:mm' }}</p>
              }
              @if (status.backend === 'filesystem') {
                <p
                  class="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground"
                  data-testid="registry-not-in-use"
                >
                  <ng-icon name="lucideInfo" class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    This bucket is connected but not in use yet. The registry moves to it once
                    the installation is set to object storage.
                  </span>
                </p>
              }
            }

            @if (!status.connected || connectOpen()) {
              <div class="space-y-4" [class.border-t]="status.connected" [class.pt-4]="status.connected" data-testid="registry-connect">
                <div class="inline-flex rounded-md border border-border p-0.5 text-sm" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    data-testid="registry-option-scaleway"
                    [attr.aria-selected]="option() === 'scaleway'"
                    [disabled]="busy()"
                    (click)="option.set('scaleway')"
                    class="rounded px-3 py-1.5"
                    [class.bg-muted]="option() === 'scaleway'"
                    [class.font-medium]="option() === 'scaleway'"
                  >
                    Create on Scaleway
                  </button>
                  <button
                    type="button"
                    role="tab"
                    data-testid="registry-option-own"
                    [attr.aria-selected]="option() === 'own'"
                    [disabled]="busy()"
                    (click)="option.set('own')"
                    class="rounded px-3 py-1.5"
                    [class.bg-muted]="option() === 'own'"
                    [class.font-medium]="option() === 'own'"
                  >
                    Use a bucket of your own
                  </button>
                </div>

                @if (option() === 'scaleway') {
                  <div class="flex flex-wrap items-end gap-3">
                    <label class="block min-w-[12rem]">
                      <span class="text-sm font-medium">Region</span>
                      <select
                        name="scalewayRegion"
                        data-testid="registry-scaleway-region"
                        [ngModel]="scalewayRegion()"
                        (ngModelChange)="scalewayRegion.set($event)"
                        [disabled]="busy()"
                        [class]="inputClass"
                      >
                        @for (region of regions; track region) {
                          <option [value]="region">{{ regionLabels[region] }}</option>
                        }
                      </select>
                    </label>
                    <button
                      type="button"
                      data-testid="registry-scaleway-submit"
                      (click)="request('scaleway')"
                      [disabled]="busy()"
                      class="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      @if (registry.connecting() === 'scaleway') {
                        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                      }
                      Create bucket
                    </button>
                    <app-explain label="How this works" labelClass="text-xs text-muted-foreground">
                      Flui creates the bucket in a Scaleway project of its own, with a key that
                      reaches only Object Storage there, using the Scaleway connection this
                      installation already has. It can take up to five minutes.
                    </app-explain>
                  </div>
                  @if (registry.connecting() === 'scaleway') {
                    <p class="flex items-center gap-2 text-sm text-muted-foreground" data-testid="registry-scaleway-busy">
                      <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                      Creating the bucket. This can take up to five minutes; keep this page open.
                    </p>
                  }
                } @else {
                  <form #ownBucket="ngForm" (ngSubmit)="request('own')" class="space-y-4" data-testid="registry-own-form">
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label class="block">
                        <span class="text-sm font-medium">Provider</span>
                        <select name="provider" required [(ngModel)]="own.provider" [disabled]="busy()" [class]="inputClass">
                          @for (p of ownProviders; track p) {
                            <option [value]="p">{{ providerLabel(p) }}</option>
                          }
                        </select>
                      </label>
                      <label class="block">
                        <span class="text-sm font-medium">Region</span>
                        <input name="region" required maxlength="64" [(ngModel)]="own.region" [disabled]="busy()" [class]="inputClass" placeholder="e.g. gra" />
                      </label>
                    </div>
                    <label class="block">
                      <span class="text-sm font-medium">Endpoint</span>
                      <input name="endpoint" type="url" required [(ngModel)]="own.endpoint" [disabled]="busy()" [class]="inputClass" placeholder="https://s3.example.com" />
                    </label>
                    <label class="block">
                      <span class="text-sm font-medium">Bucket</span>
                      <input name="bucket" required pattern="[a-z0-9][a-z0-9.&#92;-]{1,61}[a-z0-9]" [(ngModel)]="own.bucket" [disabled]="busy()" [class]="inputClass + ' font-mono'" />
                    </label>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label class="block">
                        <span class="text-sm font-medium">Access key</span>
                        <input name="accessKey" required autocomplete="off" [(ngModel)]="own.accessKey" [disabled]="busy()" [class]="inputClass + ' font-mono'" />
                      </label>
                      <label class="block">
                        <span class="text-sm font-medium">Secret key</span>
                        <input
                          name="secretKey"
                          type="password"
                          required
                          autocomplete="new-password"
                          data-testid="registry-secret"
                          [(ngModel)]="own.secretKey"
                          [disabled]="busy()"
                          [class]="inputClass + ' font-mono'"
                        />
                      </label>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Use a key that reaches this bucket only, not an account key.
                    </p>

                    <button
                      type="button"
                      class="text-xs text-primary hover:underline"
                      (click)="advancedOpen.set(!advancedOpen())"
                    >
                      {{ advancedOpen() ? 'Hide advanced' : 'Advanced' }}
                    </button>
                    @if (advancedOpen()) {
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label class="block">
                          <span class="text-sm font-medium">Folder in the bucket</span>
                          <input name="prefix" pattern="[A-Za-z0-9._/&#92;-]{1,200}" [(ngModel)]="own.prefix" [disabled]="busy()" [class]="inputClass" placeholder="Default" />
                        </label>
                        <label class="flex items-center gap-2 self-end pb-2 text-sm">
                          <input name="forcePathStyle" type="checkbox" [(ngModel)]="own.forcePathStyle" [disabled]="busy()" />
                          Path-style addresses
                        </label>
                      </div>
                    }

                    <button
                      type="submit"
                      data-testid="registry-own-submit"
                      [disabled]="busy() || ownBucket.invalid"
                      class="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      @if (registry.connecting() === 'own') {
                        <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                      }
                      Connect bucket
                    </button>
                  </form>
                }

                @if (registry.connectError(); as message) {
                  <div
                    data-testid="registry-connect-error"
                    class="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {{ message }}
                  </div>
                }

                @if (status.connected) {
                  <button
                    type="button"
                    class="text-xs text-muted-foreground hover:text-foreground"
                    [disabled]="busy()"
                    (click)="closeConnect()"
                  >
                    Keep the current bucket
                  </button>
                }
              </div>
            }

            @if (replacedBuckets().length > 0) {
              <div class="space-y-2 border-t border-border pt-4" data-testid="registry-replaced">
                <h3 class="text-xs font-semibold text-muted-foreground">Replaced buckets</h3>
                <ul class="divide-y divide-border">
                  @for (b of replacedBuckets(); track b.id) {
                    <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div class="min-w-0">
                        <span class="font-mono break-all">{{ b.bucket }}</span>
                        <span class="block text-xs text-muted-foreground">
                          {{ providerLabel(b.provider) }} · {{ b.region }} · connected {{ b.connectedAt | date: 'd MMM y' }} ·
                          {{ b.createdByFlui ? 'created by Flui' : 'your own' }}
                        </span>
                      </div>
                      <button
                        type="button"
                        [attr.data-testid]="'registry-remove-' + b.id"
                        [disabled]="registry.removing() !== null"
                        (click)="askRemove(b)"
                        class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/30 hover:text-destructive disabled:opacity-50"
                      >
                        @if (registry.removing() === b.id) {
                          <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin" />
                        }
                        Remove
                      </button>
                    </li>
                  }
                </ul>
                @if (registry.removeError(); as message) {
                  <div
                    data-testid="registry-remove-error"
                    class="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {{ message }}
                  </div>
                }
              </div>
            }
          </section>
        } @else {
          <div
            data-testid="registry-ghcr"
            class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            <ng-icon name="lucideInfo" class="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>This installation keeps images on GitHub's registry. There is nothing to show here.</span>
          </div>
        }
      } @else if (registry.loading()) {
        <div class="card-surface p-5 space-y-3">
          <div class="skeleton h-5 w-1/3"></div>
          <div class="skeleton h-2 w-full"></div>
          <div class="skeleton h-16 w-full"></div>
        </div>
      }
    </div>

    @if (confirmReplace(); as kind) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="registry-confirm">
        <div class="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6" role="dialog" aria-modal="true">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div class="space-y-1">
              <h3 class="font-semibold">Replace the bucket?</h3>
              <p class="text-sm text-muted-foreground">
                {{ kind === 'scaleway' ? 'A new bucket on Scaleway' : 'The bucket you entered' }}
                takes the place of {{ registry.status()?.bucket || 'the current one' }}.
              </p>
              <p class="text-sm text-muted-foreground" data-testid="registry-confirm-images">
                Images already in the registry are not copied to the new bucket. An application
                whose image is no longer there needs a new build before it can start elsewhere.
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              (click)="confirmReplace.set(null)"
              class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="registry-confirm-submit"
              (click)="confirmed()"
              class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Replace
            </button>
          </div>
        </div>
      </div>
    }

    @if (confirmRemove(); as b) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="registry-remove-confirm">
        <div class="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6" role="dialog" aria-modal="true">
          <div class="flex items-start gap-3">
            <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <p class="text-sm" data-testid="registry-remove-message">
              @if (b.createdByFlui) {
                Delete {{ b.bucket }} with every image in it, and the project and key Flui made for it?
              } @else {
                Forget {{ b.bucket }}? What it holds stays in your account.
              }
            </p>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              (click)="confirmRemove.set(null)"
              class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="registry-remove-submit"
              (click)="remove()"
              class="rounded-md px-3 py-1.5 text-sm"
              [class.bg-destructive]="b.createdByFlui"
              [class.text-destructive-foreground]="b.createdByFlui"
              [class.bg-primary]="!b.createdByFlui"
              [class.text-primary-foreground]="!b.createdByFlui"
            >
              {{ b.createdByFlui ? 'Delete' : 'Forget' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RegistryStorageComponent implements OnInit, OnDestroy {
  protected readonly registry = inject(RegistryStorageService);
  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly toast = inject(ToastService);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly regions = SCALEWAY_REGISTRY_REGIONS;
  protected readonly regionLabels = SCALEWAY_REGION_LABELS;
  protected readonly ownProviders = OWN_BUCKET_PROVIDERS;
  protected readonly trafficWindows = REGISTRY_TRAFFIC_WINDOWS;

  protected readonly connectOpen = signal(false);
  protected readonly option = signal<RegistryConnectOption>('scaleway');
  protected readonly scalewayRegion = signal<ScalewayRegistryRegion>('fr-par');
  protected readonly advancedOpen = signal(false);
  protected readonly confirmReplace = signal<RegistryConnectOption | null>(null);
  protected readonly confirmRemove = signal<RegistryBucket | null>(null);
  protected readonly replacedBuckets = computed(() =>
    this.registry.buckets().filter((b) => !b.active),
  );

  protected own = this.emptyOwnForm();

  protected readonly usage = computed(() => this.registry.status()?.usage ?? null);
  protected readonly gauge = computed(() => {
    const usage = this.usage();
    return usage ? usageGauge(usage) : null;
  });
  protected readonly busy = computed(() => this.registry.connecting() !== null);

  protected readonly location = computed(() => {
    const status = this.registry.status();
    if (!status) return '';
    if (status.backend === 'filesystem') return 'A volume on the control cluster';
    const provider = registryProviderLabel(status.provider);
    return status.bucket ? `Bucket ${status.bucket} on ${provider}` : `A bucket on ${provider}`;
  });

  protected readonly limitLine = computed(() => {
    const usage = this.usage();
    const gauge = this.gauge();
    if (!usage || !gauge) return '';
    if (gauge.kind === 'capacity') {
      const alert = usage.alertBytes != null ? ` · alert at ${formatRegistrySize(usage.alertBytes)}` : '';
      return `of ${formatRegistrySize(gauge.limitBytes)} volume${alert}`;
    }
    if (gauge.kind === 'alert') return `alert at ${formatRegistrySize(gauge.limitBytes)}`;
    return 'No space alert set';
  });

  private readonly surfaceRevision = new RegistryStorageSurfaceRevision();

  readonly surface = computed(() => {
    const input: RegistryStorageSurfaceInput = {
      loading: this.registry.loading(),
      refused: this.registry.refused(),
      hasLoadError: !!this.registry.loadError(),
      status: this.registry.status(),
      measuring: this.registry.measuring(),
      connecting: this.registry.connecting(),
      hasConnectError: !!this.registry.connectError(),
      connectOpen: !!this.registry.status() && (!this.registry.status()!.connected || this.connectOpen()),
      confirmReplace: this.confirmReplace(),
      replacedBuckets: this.replacedBuckets().length,
      replacedCreatedByFlui: this.replacedBuckets().filter((b) => b.createdByFlui).length,
      removing: this.registry.removing() !== null,
      hasRemoveError: !!this.registry.removeError(),
      confirmRemove: this.confirmRemove() ? { createdByFlui: this.confirmRemove()!.createdByFlui } : null,
      traffic: this.registry.trafficHidden() ? null : this.registry.traffic(),
      trafficWindow: this.registry.trafficWindow(),
      trafficLoading: this.registry.trafficLoading(),
      trafficHidden: this.registry.trafficHidden(),
    };
    return buildRegistryStorageSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    void this.registry.load();
    void this.registry.loadBuckets();
    void this.registry.loadTraffic();
  }

  protected setTrafficWindow(window: RegistryTrafficWindow): void {
    if (window === this.registry.trafficWindow() && this.registry.traffic()) return;
    void this.registry.loadTraffic(window);
  }

  protected mbit(bytesPerSecond: number): string {
    return formatMbitPerSecond(bytesPerSecond);
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  protected reload(): void {
    void this.registry.load();
  }

  protected measure(): void {
    void this.registry.load(true);
  }

  protected request(kind: RegistryConnectOption): void {
    if (this.busy()) return;
    if (this.registry.status()?.connected) {
      this.confirmReplace.set(kind);
      return;
    }
    void this.submit(kind);
  }

  protected confirmed(): void {
    const kind = this.confirmReplace();
    this.confirmReplace.set(null);
    if (kind) void this.submit(kind);
  }

  protected askRemove(bucket: RegistryBucket): void {
    this.registry.clearRemoveError();
    this.confirmRemove.set(bucket);
  }

  protected async remove(): Promise<void> {
    const bucket = this.confirmRemove();
    this.confirmRemove.set(null);
    if (!bucket) return;
    const removal = await this.registry.removeBucket(bucket.id);
    if (!removal) return;
    this.toast.showSuccess(
      removal.bucketDeleted ? `Deleted ${removal.bucket}` : `Forgot ${removal.bucket}`,
    );
    await this.registry.loadBuckets();
  }

  protected closeConnect(): void {
    this.connectOpen.set(false);
    this.registry.clearConnectError();
    this.own = this.emptyOwnForm();
  }

  private async submit(kind: RegistryConnectOption): Promise<void> {
    if (kind === 'scaleway') {
      const ok = await this.registry.connectScaleway(this.scalewayRegion());
      if (ok) {
        this.connectOpen.set(false);
        void this.registry.loadBuckets();
      }
      return;
    }
    const body = this.ownBody();
    this.own = { ...this.own, secretKey: '' };
    const ok = await this.registry.connectOwn(body);
    if (ok) {
      void this.registry.loadBuckets();
      this.own = this.emptyOwnForm();
      this.advancedOpen.set(false);
      this.connectOpen.set(false);
    }
  }

  private ownBody(): ConnectRegistryBucket {
    const prefix = this.own.prefix.trim();
    return {
      provider: this.own.provider,
      endpoint: this.own.endpoint.trim(),
      region: this.own.region.trim(),
      bucket: this.own.bucket.trim(),
      ...(prefix ? { prefix } : {}),
      ...(this.own.forcePathStyle ? { forcePathStyle: true } : {}),
      accessKey: this.own.accessKey.trim(),
      secretKey: this.own.secretKey,
    };
  }

  private emptyOwnForm(): {
    provider: RegistryBucketProvider;
    endpoint: string;
    region: string;
    bucket: string;
    prefix: string;
    forcePathStyle: boolean;
    accessKey: string;
    secretKey: string;
  } {
    return {
      provider: 'ovh_object_storage',
      endpoint: '',
      region: '',
      bucket: '',
      prefix: '',
      forcePathStyle: false,
      accessKey: '',
      secretKey: '',
    };
  }

  protected size(bytes: number | null | undefined): string {
    return formatRegistrySize(bytes);
  }

  protected providerLabel(provider: string | undefined): string {
    return registryProviderLabel(provider);
  }

  protected ago(iso: string): string {
    return measuredAgo(iso);
  }

  protected round(value: number): number {
    return Math.round(value);
  }
}
