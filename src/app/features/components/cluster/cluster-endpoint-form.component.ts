import { Component, inject, input, output, signal, OnChanges, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideX, lucideShieldCheck, lucideShieldAlert, lucideCopy, lucideCheck,
  lucideLoader, lucideCircleCheck, lucideCircleX, lucideWand2,
  lucideZap, lucideGlobe, lucidePencil, lucideTriangleAlert,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { ClusterDnsZoneResponseDto } from '../../../core/api/model/clusterDnsZoneResponseDto';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { CreateAppEndpointDto } from '../../../core/api/model/createAppEndpointDto';
import { UpdateAppEndpointDto } from '../../../core/api/model/updateAppEndpointDto';
import { CatalogClusterCapabilitiesDto } from '../../../core/api/model/catalogClusterCapabilitiesDto';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';
import { AppConfigService } from '../../../core/services/app-config.service';

type InternalHostingMissing = CatalogClusterCapabilitiesDto.InternalHostingMissingEnum;
type EndpointType = CreateAppEndpointDto.EndpointTypeEnum;

interface DnsCheckResult {
  ok: boolean;
  resolvedAddresses: string[];
}

export interface AppOption {
  id: string;
  name: string;
  slug: string;
  isInternal?: boolean;
}

@Component({
  selector: 'app-cluster-endpoint-form',
  standalone: true,
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideX, lucideShieldCheck, lucideShieldAlert, lucideCopy, lucideCheck, lucideLoader, lucideCircleCheck, lucideCircleX, lucideWand2, lucideZap, lucideGlobe, lucidePencil, lucideTriangleAlert })],
  template: `
    <div class="p-4 border border-border rounded-lg card-inner space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-foreground">
          {{ endpoint() ? 'Edit Endpoint' : 'New Endpoint' }}
        </h4>
        <button
          (click)="cancelled.emit()"
          class="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ng-icon name="lucideX" class="h-4 w-4" />
        </button>
      </div>

      <!-- Application select (only when list is provided, read-only when editing) -->
      @if (applications().length > 0) {
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Application</label>
          @if (endpoint()) {
            <div class="w-full px-3 py-2 border border-border rounded-md bg-muted text-sm text-muted-foreground">
              {{ selectedAppName() }}
              <span class="ml-1 text-xs text-muted-foreground">(cannot be changed)</span>
            </div>
          } @else {
            <select
              [(ngModel)]="form.applicationId"
              (ngModelChange)="onAppChange($event)"
              class="w-full px-3 py-2 border border-border rounded-md bg-background text-sm text-foreground"
            >
              <option value="">— Select application —</option>
              @for (app of applications(); track app.id) {
                <option [value]="app.id">{{ app.name }}</option>
              }
            </select>
          }
        </div>
      }

      <!-- Endpoint type — Public vs Internal (Auth Proxy) -->
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-2">
          Endpoint type <span class="text-red-500 ml-0.5">*</span>
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            (click)="onEndpointTypeChange('public')"
            [disabled]="isEditMode()"
            [class]="modeCardClass(endpointType() === 'public', isEditMode() && endpointType() !== 'public')"
            [title]="isEditMode() ? 'Endpoint type cannot be changed after creation' : ''"
          >
            <div class="flex items-center gap-1.5">
              <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">Public</span>
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Reachable from the internet via public DNS + TLS certificate.
            </p>
          </button>
          <button
            type="button"
            (click)="onEndpointTypeChange('internal')"
            [disabled]="!internalAvailable() || (isEditMode() && endpointType() !== 'internal')"
            [class]="modeCardClass(endpointType() === 'internal', !internalAvailable() || (isEditMode() && endpointType() !== 'internal'))"
            [title]="internalTypeTooltip()"
          >
            <div class="flex items-center gap-1.5">
              <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">Internal</span>
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Private URL on the cluster's <span class="font-mono">.internal.&lt;zone&gt;</span> wildcard, gated by the Flui Auth Proxy.
            </p>
          </button>
        </div>

        @if (endpointType() === 'internal' && !internalHostingAvailable()) {
          <div class="mt-2 flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-800 dark:text-amber-300">
            <ng-icon name="lucideTriangleAlert" class="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div class="flex-1 space-y-1">
              <div class="font-medium">Internal endpoints not available on this cluster</div>
              <div>Missing: {{ internalHostingMissingLabel() }}.</div>
              <button
                type="button"
                (click)="configureInternalHosting.emit()"
                class="underline hover:no-underline font-medium"
              >Configure now →</button>
            </div>
          </div>
        }

        @if (endpointType() === 'internal' && internalHostingAvailable() && !authzReady()) {
          <div class="mt-2 flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-800 dark:text-amber-300">
            <ng-icon name="lucideShieldAlert" class="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div class="flex-1 space-y-1">
              <div class="font-medium">Auth Proxy not running</div>
              <div>Internal endpoints require the Flui Auth Proxy to be installed and running on this cluster.</div>
              <button
                type="button"
                (click)="installAuthz.emit()"
                [disabled]="authzInstalling()"
                class="underline hover:no-underline font-medium disabled:opacity-50 disabled:no-underline"
              >
                @if (authzInstalling()) {
                  <ng-icon name="lucideLoader" class="h-3 w-3 inline animate-spin" /> Installing…
                } @else {
                  Install Auth Proxy →
                }
              </button>
            </div>
          </div>
        }
      </div>

      @if (endpointType() === 'public') {
      <!-- Hostname source — explicit choice -->
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-2">
          Hostname source <span class="text-red-500 ml-0.5">*</span>
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            (click)="onHostnameModeChange('ip')"
            [disabled]="!masterIp()"
            [class]="modeCardClass(form.hostnameMode === 'ip', !masterIp())"
            [title]="!masterIp() ? 'Cluster IP not available yet' : 'Auto-generated test address'"
          >
            <div class="flex items-center gap-1.5">
              <ng-icon name="lucideZap" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">Test address</span>
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Instant address derived from your cluster IP — no DNS setup required.
            </p>
          </button>
          <button
            type="button"
            (click)="onHostnameModeChange('domain')"
            [class]="modeCardClass(form.hostnameMode === 'domain')"
          >
            <div class="flex items-center gap-1.5">
              <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">Your domain</span>
            </div>
            <p class="mt-1 text-[11px] text-muted-foreground">
              {{ effectiveAssignment() ? 'Pick a subdomain under your cluster zone or use a different one.' : 'Use a domain you own — point its DNS to the cluster.' }}
            </p>
          </button>
        </div>
      </div>

      <!-- Test address preview -->
      @if (form.hostnameMode === 'ip') {
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">
            Public address
          </label>
          @if (masterIp()) {
            @if (ipSlugEditing()) {
              <div class="flex items-stretch">
                <input
                  type="text"
                  [(ngModel)]="form.ipSlugOverride"
                  (ngModelChange)="onIpSlugChange()"
                  [placeholder]="currentSlug() || 'app'"
                  [class]="'flex-1 min-w-0 px-3 py-2 border rounded-l-md bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:border-transparent ' +
                    (ipSlugError() ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-border focus:ring-blue-500')"
                />
                <span class="inline-flex items-center px-3 py-2 border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground font-mono whitespace-nowrap select-none">
                  .{{ ipDashed() }}.nip.io
                </span>
              </div>
              @if (ipSlugError()) {
                <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ ipSlugError() }}</p>
              } @else {
                <p class="mt-1 text-xs text-muted-foreground">
                  Edit only the app name. Leave empty to use the default ({{ currentSlug() || 'app' }}).
                </p>
              }
            } @else {
              <div class="flex items-stretch">
                <div class="flex-1 min-w-0 px-3 py-2 border border-border rounded-l-md bg-muted text-sm text-foreground font-mono break-all">
                  {{ ipFqdnPreview() }}
                </div>
                <button
                  type="button"
                  (click)="ipSlugEditing.set(true)"
                  class="inline-flex items-center gap-1 px-2 py-2 border border-l-0 border-border rounded-r-md bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  title="Edit app name"
                >
                  <ng-icon name="lucidePencil" class="h-3.5 w-3.5" />
                </button>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                Auto-generated from the cluster IP. Includes a free Let's Encrypt certificate.
              </p>
            }
          } @else {
            <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p class="text-xs text-amber-800 dark:text-amber-300">
                Cluster IP not ready yet. Wait until the cluster finishes setting up, then come back here.
              </p>
            </div>
          }
        </div>
      }

      <!-- FQDN / Subdomain (only when domain mode) -->
      @if (form.hostnameMode === 'domain') {
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">
          Domain (FQDN) <span class="text-red-500 ml-0.5">*</span>
        </label>

        @if (effectiveAssignment(); as zone) {
          <!-- Zone mode: split pill — user types only the subdomain prefix -->
          <div class="flex items-stretch">
            <input
              type="text"
              [(ngModel)]="form.subdomainPrefix"
              (ngModelChange)="onSubdomainChange()"
              [placeholder]="subdomainPlaceholder()"
              [class]="'flex-1 min-w-0 px-3 py-2 border rounded-l-md bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:border-transparent ' +
                (subdomainError() ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-border focus:ring-blue-500')"
            />
            <button
              type="button"
              (click)="autoGenerate()"
              [disabled]="!currentSlug()"
              class="inline-flex items-center gap-1 px-2 py-2 border border-l-0 bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Auto-generate from app slug"
            >
              <ng-icon name="lucideWand2" class="h-3.5 w-3.5" />
            </button>
            @if (assignments().length > 1) {
              <select
                [ngModel]="selectedAssignment()?.id"
                (ngModelChange)="onZoneSelect($event)"
                class="px-2 py-2 border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground font-mono whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                title="Choose the DNS zone for this endpoint"
              >
                @for (a of assignments(); track a.id) {
                  <option [value]="a.id">.{{ a.dnsZone.zoneName }}</option>
                }
              </select>
            } @else {
              <span class="inline-flex items-center px-3 py-2 border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground font-mono whitespace-nowrap select-none">
                .{{ zoneSuffix() }}
              </span>
            }
          </div>
          @if (subdomainError()) {
            <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ subdomainError() }}</p>
          } @else if (!form.subdomainPrefix.trim()) {
            <p class="mt-1 text-xs text-muted-foreground">Required — or click <ng-icon name="lucideWand2" class="h-3 w-3 inline" /> to generate from app slug.</p>
          }

        } @else {
          <!-- BYOD mode: full FQDN free-text -->
          <div class="flex items-stretch">
            <input
              type="text"
              [(ngModel)]="form.fqdn"
              (ngModelChange)="onFqdnChange()"
              [placeholder]="fqdnPlaceholder()"
              [class]="'flex-1 min-w-0 px-3 py-2 border rounded-l-md bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:border-transparent font-mono ' +
                (fqdnError() ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-border focus:ring-blue-500')"
            />
            <button
              type="button"
              (click)="autoGenerate()"
              [disabled]="!currentSlug()"
              class="inline-flex items-center gap-1 px-2 py-2 border border-l-0 rounded-r-md bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Auto-generate from app slug"
            >
              <ng-icon name="lucideWand2" class="h-3.5 w-3.5" />
            </button>
          </div>
          @if (fqdnError()) {
            <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fqdnError() }}</p>
          }
          @if (masterIp() && form.fqdn.trim() && !fqdnError()) {
            <div class="mt-1.5 flex items-center gap-1.5 text-xs">
              @if (dnsChecking()) {
                <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin text-muted-foreground" />
                <span class="text-muted-foreground">Verifying DNS…</span>
              } @else if (dnsResult()) {
                @if (dnsResult()!.ok) {
                  <ng-icon name="lucideCircleCheck" class="h-3 w-3 text-green-500 dark:text-green-400" />
                  <span class="text-green-700 dark:text-green-400">Resolves correctly to {{ masterIp() }}</span>
                } @else {
                  <ng-icon name="lucideCircleX" class="h-3 w-3 text-red-500 dark:text-red-400" />
                  <span class="text-red-700 dark:text-red-400">
                    Does not point to {{ masterIp() }}
                    @if (dnsResult()!.resolvedAddresses.length > 0) {
                      — found: {{ dnsResult()!.resolvedAddresses.join(', ') }}
                    } @else {
                      — no A record found
                    }
                  </span>
                }
              }
            </div>
          }
        }
        @if (assignment() && endpointType() === 'public') {
          <button
            type="button"
            (click)="toggleByodOverride()"
            class="mt-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            @if (byodOverride()) {
              @if (assignments().length > 1) {
                ← Use a cluster zone
              } @else {
                ← Use the cluster zone ({{ assignment()!.dnsZone.zoneName }})
              }
            } @else {
              Use a different domain (BYOD) →
            }
          </button>
        }
      </div>

      <!-- BYOD instructions (no zone assigned, or zone assigned + user opted out via byodOverride) -->
      @if (!effectiveAssignment()) {
        <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
          <p class="text-xs text-amber-800 dark:text-amber-300 font-medium">No DNS zone — manual configuration required</p>
          <p class="text-xs text-amber-700 dark:text-amber-400">
            Create an <strong>A record</strong> on your DNS provider pointing the FQDN above to the cluster master IP:
          </p>
          @if (masterIp()) {
            <div class="inline-flex items-center gap-1.5">
              <code class="px-2 py-0.5 bg-background border border-amber-200 dark:border-amber-700 rounded text-xs font-mono text-foreground select-all">{{ masterIp() }}</code>
              <button
                type="button"
                (click)="copyIp()"
                class="p-1 rounded text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                [title]="copied() ? 'Copied!' : 'Copy IP'"
              >
                <ng-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" class="h-3 w-3" />
              </button>
            </div>
          } @else {
            <p class="text-xs text-amber-600 dark:text-amber-500 italic">Master IP not yet available.</p>
          }
        </div>
      }

      <!-- Certificate type (domain mode only) -->
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-2">
          Certificate
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            (click)="form.certChallenge = 'http-01'"
            [class]="modeCardClass(form.certChallenge === 'http-01')"
          >
            <span class="text-xs font-medium">Single domain</span>
            <p class="mt-1 text-[11px] text-muted-foreground">
              One certificate just for this address. Works with any DNS setup.
            </p>
          </button>
          <button
            type="button"
            (click)="onCertChallengeChange('dns-01')"
            [disabled]="!canUseDns01()"
            [class]="modeCardClass(form.certChallenge === 'dns-01', !canUseDns01())"
            [title]="!canUseDns01() ? 'Available when a managed DNS zone with wildcard support is configured' : ''"
          >
            <span class="text-xs font-medium">Wildcard</span>
            <p class="mt-1 text-[11px] text-muted-foreground">
              Covers all subdomains of your cluster zone in one certificate. Requires managed DNS.
            </p>
          </button>
        </div>
      </div>
      } <!-- end @if hostnameMode === 'domain' -->

      <!-- TLS -->
      <div class="space-y-3">
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input type="checkbox" [(ngModel)]="form.certificateRequired" class="rounded" />
          <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-green-600 dark:text-green-400" />
          Provision TLS certificate (HTTPS)
        </label>

        @if (!effectiveAssignment() && form.certificateRequired) {
          <p class="ml-6 text-xs text-amber-600 dark:text-amber-400">
            Single-domain certificate only — wildcard requires a managed DNS zone.
          </p>
        }

        @if (form.certificateRequired && !issuersReady()) {
          <div class="ml-6 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
            <ng-icon name="lucideShieldAlert" class="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>
              No certificate issuer ready — TLS provisioning will fail.
              <button
                type="button"
                (click)="configureIssuers.emit()"
                class="ml-1 underline hover:no-underline"
              >Configure issuers →</button>
            </span>
          </div>
        }

        @if (form.certificateRequired) {
          <div class="ml-6 space-y-2">
            <!-- CREATE MODE: callout depends on certificateMode config -->
            @if (!isEditMode()) {
              @switch (certificateMode) {
                @case ('staging') {
                  <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                    <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>
                      A <strong>staging</strong> certificate will be issued (Let's Encrypt Staging — not trusted by browsers).
                      It will not auto-promote to production.
                    </span>
                  </div>
                }
                @case ('preflight') {
                  <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                    <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>
                      Configured for <strong>preflight</strong>: a staging certificate will be issued first.
                      Once it's valid, promote to production from the endpoint details.
                    </span>
                  </div>
                }
                @default {
                  <div class="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-xs text-green-800 dark:text-green-300">
                    <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                    <span>
                      A <strong>production</strong> certificate will be issued (Let's Encrypt — browser-trusted).
                    </span>
                  </div>
                }
              }
            }
            <!-- EDIT: staging provider -->
            @if (isEditMode() && isStagingCert()) {
              <!-- Staging not yet valid -->
              @if (!stagingCertValid()) {
                <div class="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-xs text-yellow-800 dark:text-yellow-300">
                  <ng-icon name="lucideShieldAlert" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Using <strong>staging</strong> certificate (Let's Encrypt Staging). Promote to production once the staging cert is valid.</span>
                </div>
              }
              <!-- Staging valid → show promote callout -->
              @if (stagingCertValid()) {
                <div class="p-3 border rounded-lg"
                  [class]="promoteToProd() ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-border bg-muted/30'">
                  <label class="flex items-start gap-2 cursor-pointer select-none">
                    <input type="checkbox" [checked]="promoteToProd()" (change)="promoteToProd.set(!promoteToProd())" class="mt-0.5 rounded" />
                    <div>
                      <p class="text-sm font-medium text-foreground">Promote to Production</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Staging certificate is valid. Switch to a browser-trusted Let's Encrypt production certificate.</p>
                    </div>
                  </label>
                </div>
              }
            }
            <!-- EDIT: already on production -->
            @if (isEditMode() && isProdCert()) {
              <div class="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-xs text-green-800 dark:text-green-300">
                <ng-icon name="lucideShieldCheck" class="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <span>Using <strong>production</strong> certificate (Let's Encrypt).</span>
              </div>
            }
          </div>
        }
      </div>
      } <!-- end @if endpointType === 'public' -->

      @if (endpointType() === 'internal') {
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Internal URL</label>
          @if (assignment(); as zone) {
            <div class="flex items-stretch">
              <input
                type="text"
                [(ngModel)]="form.subdomainPrefix"
                (ngModelChange)="onSubdomainChange()"
                [placeholder]="subdomainPlaceholder()"
                [disabled]="isEditMode()"
                [class]="'flex-1 min-w-0 px-3 py-2 border rounded-l-md bg-background text-sm text-foreground font-mono disabled:bg-muted disabled:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:border-transparent ' +
                  (subdomainError() ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : 'border-border focus:ring-blue-500')"
              />
              <button
                type="button"
                (click)="autoGenerate()"
                [disabled]="!currentSlug() || isEditMode()"
                class="inline-flex items-center gap-1 px-2 py-2 border border-l-0 bg-muted text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Auto-generate from app slug"
              >
                <ng-icon name="lucideWand2" class="h-3.5 w-3.5" />
              </button>
              <span class="inline-flex items-center px-3 py-2 border border-l-0 rounded-r-md bg-muted text-sm text-muted-foreground font-mono whitespace-nowrap select-none">
                .internal.{{ zone.dnsZone.zoneName }}
              </span>
            </div>
            @if (subdomainError()) {
              <p class="mt-1 text-xs text-red-600 dark:text-red-400">{{ subdomainError() }}</p>
            } @else {
              <p class="mt-1 text-xs text-muted-foreground">
                Reachable only through the Flui Auth Proxy. The TLS certificate is provisioned by the cluster wildcard issuer — no per-endpoint cert configuration needed.
              </p>
            }
          } @else {
            <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p class="text-xs text-amber-800 dark:text-amber-300">
                No DNS zone assigned. Internal endpoints require a managed DNS zone with a wildcard certificate on the cluster.
              </p>
            </div>
          }
        </div>
      }

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-1">
        <button
          (click)="cancelled.emit()"
          class="px-3 py-1.5 text-xs border border-border rounded-md text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          (click)="submit()"
          [disabled]="!isValid()"
          class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ endpoint() ? 'Save Changes' : 'Create Endpoint' }}
        </button>
      </div>
    </div>
  `,
})
export class ClusterEndpointFormComponent implements OnChanges {
  clusterId = input.required<string>();
  assignments = input<ClusterDnsZoneResponseDto[]>([]);
  endpoint = input<AppEndpointResponseDto | undefined>(undefined);
  /** When provided, a select is shown to pick the target application. */
  applications = input<AppOption[]>([]);
  /** Pre-set applicationId — used when the form is opened from the app context. */
  fixedApplicationId = input<string>('');
  /** Pre-set slug used to suggest the FQDN placeholder. */
  fixedAppSlug = input<string>('');
  /** Master IP of the cluster — shown in BYOD mode so the user knows where to point the A record. */
  masterIp = input<string>('');
  /** Whether at least one certificate issuer is ready on this cluster. */
  issuersReady = input<boolean>(true);
  /** Initial endpoint type when creating — `internal` if the app is private, `public` otherwise. Ignored in edit mode. */
  defaultEndpointType = input<EndpointType>('public');
  /** True when the cluster supports internal hosting (DNS zone + wildcard issuer). Gates the "Internal" option. */
  internalHostingAvailable = input<boolean>(false);
  /** Granular list of missing prerequisites when internalHostingAvailable=false. */
  internalHostingMissing = input<readonly InternalHostingMissing[]>([]);
  /** True when the Flui Auth Proxy is installed and running on the cluster — required for internal endpoints. */
  authzReady = input<boolean>(false);
  /** True while an Auth Proxy install request is in flight. */
  authzInstalling = input<boolean>(false);

  save = output<{ clusterId: string; dto: CreateAppEndpointDto } | { id: string; dto: UpdateAppEndpointDto }>();
  cancelled = output<void>();
  configureIssuers = output<void>();
  /** Fired when the user clicks "Configure now" on the missing-prereqs banner. */
  configureInternalHosting = output<void>();
  /** Fired when the user clicks "Install Auth Proxy". */
  installAuthz = output<void>();

  private readonly dnsZonesApi = inject(DNSZonesService);
  private readonly appConfig = inject(AppConfigService);
  private dnsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected certificateMode = this.appConfig.certificateMode;
  protected startsInStaging = this.certificateMode === 'staging' || this.certificateMode === 'preflight';

  // Declared above `form`: emptyForm() reads effectiveAssignment().
  protected byodOverride = signal(false);
  /** Assignment id of the zone this endpoint is placed under; '' falls back to the primary zone. */
  protected selectedZoneId = signal('');
  /** Primary (first-assigned) zone — internal endpoints and cluster-wide hints use it. */
  protected assignment = computed(() => this.assignments()[0] ?? null);
  protected selectedAssignment = computed(() =>
    this.assignments().find(a => a.id === this.selectedZoneId()) ?? this.assignment(),
  );
  protected effectiveAssignment = computed(() =>
    this.byodOverride() ? null : this.selectedAssignment(),
  );

  protected form = this.emptyForm();
  protected copied = signal(false);
  protected fqdnError = signal<string | null>(null);
  protected subdomainError = signal<string | null>(null);
  protected ipSlugError = signal<string | null>(null);
  protected ipSlugEditing = signal(false);
  protected dnsChecking = signal(false);
  protected dnsResult = signal<DnsCheckResult | null>(null);
  protected promoteToProd = signal(false);

  protected selectedAppId = signal<string>('');

  /** User-chosen endpoint type for the current form. Persisted in submit DTO. */
  protected endpointType = signal<EndpointType>('public');

  protected isInternal = computed(() => this.endpointType() === 'internal');

  /** True when the user is allowed to pick "Internal" — both cluster capability and Auth Proxy must be present. */
  protected internalAvailable = computed(
    () => this.internalHostingAvailable() && this.authzReady(),
  );

  protected internalHostingMissingLabel = computed(() => {
    const labels = this.internalHostingMissing().map(m => {
      switch (m) {
        case 'dns_zone': return 'DNS zone';
        case 'wildcard_issuer': return 'wildcard TLS issuer';
        case 'internal_wildcard_dns': return 'internal wildcard DNS';
        default: return m;
      }
    });
    return labels.length ? labels.join(', ') : 'cluster prerequisites';
  });

  protected internalTypeTooltip = computed(() => {
    if (this.isEditMode() && this.endpointType() !== 'internal') {
      return 'Endpoint type cannot be changed after creation';
    }
    if (!this.internalHostingAvailable()) {
      return `Cluster missing: ${this.internalHostingMissingLabel()}`;
    }
    if (!this.authzReady()) {
      return 'Auth Proxy must be installed and running on the cluster';
    }
    return '';
  });

  protected onEndpointTypeChange(t: EndpointType): void {
    if (this.isEditMode()) return;
    if (t === 'internal' && !this.internalAvailable()) return;
    this.endpointType.set(t);
    if (t === 'internal') {
      // Internal endpoints always use domain + wildcard cert managed at cluster level.
      this.form.hostnameMode = 'domain';
      this.form.certificateRequired = true;
    }
  }

  /** Suffix appended to the prefix in zone mode — `internal.<zone>` for internal apps, `<zone>` otherwise. */
  protected zoneSuffix = computed(() => {
    const zone = this.effectiveAssignment();
    if (!zone) return '';
    return this.isInternal() ? `internal.${zone.dnsZone.zoneName}` : zone.dnsZone.zoneName;
  });

  protected canUseDns01 = computed(() => {
    const zone = this.effectiveAssignment();
    return !!zone && !!zone.wildcardCertificate;
  });

  protected ipDashed = computed(() => this.masterIp().replaceAll('.',  '-'));

  protected effectiveIpSlug = computed(() => {
    const override = this.form.ipSlugOverride.trim();
    return override || this.currentSlug() || 'app';
  });

  protected ipFqdnPreview = computed(() => {
    const ip = this.masterIp();
    if (!ip) return '';
    return `${this.effectiveIpSlug()}.${ip.replaceAll('.',  '-')}.nip.io`;
  });

  protected modeCardClass(active: boolean, disabled = false): string {
    const base = 'flex flex-col items-start rounded-md border p-2.5 text-left transition w-full';
    if (disabled) return `${base} border-border bg-muted/20 opacity-50 cursor-not-allowed`;
    return active
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }

  protected onHostnameModeChange(mode: 'ip' | 'domain'): void {
    this.form.hostnameMode = mode;
    if (mode === 'ip') {
      this.form.certChallenge = 'http-01';
    } else if (this.form.certChallenge !== 'dns-01' && this.canUseDns01()) {
      // leave as-is
    }
  }

  protected onCertChallengeChange(c: 'http-01' | 'dns-01'): void {
    if (c === 'dns-01' && !this.canUseDns01()) return;
    this.form.certChallenge = c;
  }

  protected isEditMode = computed(() => !!this.endpoint());
  protected isStagingCert = computed(() =>
    this.endpoint()?.certificateProvider === 'lets_encrypt_staging'
  );
  protected isProdCert = computed(() =>
    this.endpoint()?.certificateProvider === 'lets_encrypt'
  );
  protected stagingCertValid = computed(() =>
    this.isStagingCert() && this.endpoint()?.certificateStatus === 'valid'
  );

  protected fqdnPlaceholder = computed(() => {
    const zone = this.effectiveAssignment();
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    if (slug && zone) return `${slug}.${this.zoneSuffix()}`;
    if (slug) return `${slug}.example.com`;
    return 'app.example.com';
  });

  protected subdomainPlaceholder = computed(() => {
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    return slug || 'api';
  });

  protected selectedAppName = computed(() => {
    const id = this.form.applicationId;
    return this.applications().find(a => a.id === id)?.name ?? id;
  });

  private slugFromSelect(): string {
    return this.applications().find(a => a.id === this.form.applicationId)?.slug ?? '';
  }

  protected currentSlug = computed(() => {
    const slug = this.fixedAppSlug() || this.slugFromSelect();
    return slug.replaceAll('_',  '-').toLowerCase();
  });

  protected toggleByodOverride(): void {
    const next = !this.byodOverride();
    this.byodOverride.set(next);
    this.form.fqdn = '';
    this.form.subdomainPrefix = '';
    this.fqdnError.set(null);
    this.subdomainError.set(null);
    this.dnsResult.set(null);
    this.dnsChecking.set(false);
    // BYOD can't use DNS-01 wildcard — fall back to HTTP-01.
    if (next && this.form.certChallenge === 'dns-01') {
      this.form.certChallenge = 'http-01';
    }
    if (!next) this.prefillZoneFromExistingFqdn();
  }

  // Entering zone mode: when the current FQDN already sits under an assigned
  // zone, preselect that zone (longest suffix) and keep the prefix.
  private prefillZoneFromExistingFqdn(): void {
    const fqdn = (this.endpoint()?.fqdn ?? '').toLowerCase();
    const match = this.assignments()
      .filter(a => fqdn === a.dnsZone.zoneName || fqdn.endsWith('.' + a.dnsZone.zoneName))
      .sort((x, y) => y.dnsZone.zoneName.length - x.dnsZone.zoneName.length)[0];
    if (!match) return;
    this.selectedZoneId.set(match.id);
    const zn = match.dnsZone.zoneName;
    this.form.subdomainPrefix = fqdn === zn ? '' : fqdn.slice(0, fqdn.length - zn.length - 1);
  }

  protected onZoneSelect(zoneId: string): void {
    this.selectedZoneId.set(zoneId);
    if (this.form.certChallenge === 'dns-01' && !this.canUseDns01()) {
      this.form.certChallenge = 'http-01';
    }
  }

  protected autoGenerate(): void {
    const slug = this.currentSlug();
    if (!slug) return;
    if (this.effectiveAssignment()) {
      this.form.subdomainPrefix = slug;
      this.onSubdomainChange();
    } else {
      this.form.fqdn = `${slug}.example.com`;
      this.onFqdnChange();
    }
  }

  ngOnChanges(): void {
    const ep = this.endpoint();
    if (ep) {
      this.selectedAppId.set(ep.applicationId ?? this.fixedApplicationId());
      // Endpoint type is immutable on edit — read it from the persisted row.
      this.endpointType.set((ep.endpointType as EndpointType) ?? 'public');
      // If the cluster has zones but the existing endpoint isn't tied to one,
      // it was created in BYOD mode — preserve that on edit.
      this.byodOverride.set(this.assignments().length > 0 && !ep.clusterDnsZoneId);
      this.selectedZoneId.set(ep.clusterDnsZoneId ?? '');
      const zone = this.effectiveAssignment();
      let prefix = '';
      let fqdn = ep.fqdn;
      if (zone) {
        const suffix = '.' + this.zoneSuffix();
        prefix = ep.fqdn.endsWith(suffix)
          ? ep.fqdn.slice(0, ep.fqdn.length - suffix.length)
          : ep.fqdn;
        fqdn = '';
      }
      let ipSlugOverride = '';
      if ((ep.hostnameMode as 'ip' | 'domain') === 'ip' && ep.fqdn) {
        const ipDashed = this.masterIp().replaceAll('.',  '-');
        const suffix = `.${ipDashed}.nip.io`;
        if (ipDashed && ep.fqdn.endsWith(suffix)) {
          ipSlugOverride = ep.fqdn.slice(0, ep.fqdn.length - suffix.length);
        }
      }
      this.form = {
        applicationId: ep.applicationId ?? this.fixedApplicationId(),
        fqdn,
        subdomainPrefix: prefix,
        ipSlugOverride,
        certificateRequired: ep.certificateRequired,
        certificateProvider: ep.certificateProvider ?? 'lets_encrypt',
        hostnameMode: (ep.hostnameMode as 'ip' | 'domain') ?? (zone ? 'domain' : 'ip'),
        certChallenge: (ep.certChallenge as 'http-01' | 'dns-01') ?? 'http-01',
      };
    } else {
      this.selectedAppId.set(this.fixedApplicationId());
      // New endpoints default to zone mode when a zone is assigned — the user
      // can opt into BYOD via the toggle. Reset here so reusing the modal
      // doesn't carry a previous selection.
      this.byodOverride.set(false);
      this.selectedZoneId.set('');
      // For new endpoints, honor parent's defaultEndpointType — but downgrade
      // to "public" if the cluster cannot host internal endpoints, so the user
      // never starts on a disabled option.
      const wanted = this.defaultEndpointType();
      this.endpointType.set(
        wanted === 'internal' && this.internalAvailable() ? 'internal' : 'public',
      );
      this.form = this.emptyForm();
      if (this.endpointType() === 'internal') {
        this.form.hostnameMode = 'domain';
        this.form.certificateRequired = true;
      }
    }
    this.promoteToProd.set(false);
    this.fqdnError.set(null);
    this.subdomainError.set(null);
    this.ipSlugError.set(null);
    this.ipSlugEditing.set(false);
    this.dnsResult.set(null);
    this.dnsChecking.set(false);
    if (this.dnsDebounceTimer) clearTimeout(this.dnsDebounceTimer);
  }

  protected copyIp(): void {
    const ip = this.masterIp();
    if (!ip) return;
    navigator.clipboard.writeText(ip).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  protected onFqdnChange(): void {
    const v = this.form.fqdn.trim();
    if (!v) {
      this.fqdnError.set(null);
      this.dnsResult.set(null);
      this.dnsChecking.set(false);
      return;
    }
    this.fqdnError.set(this.validateFqdn(v));
    // DNS verification — only in BYOD mode (no zone assigned) and if format is valid
    if (this.dnsDebounceTimer) clearTimeout(this.dnsDebounceTimer);
    const ip = this.masterIp();
    if (!this.effectiveAssignment() && ip && !this.fqdnError()) {
      this.dnsResult.set(null);
      this.dnsChecking.set(true);
      this.dnsDebounceTimer = setTimeout(() => this.runDnsCheck(v, ip), 600);
    } else {
      this.dnsResult.set(null);
      this.dnsChecking.set(false);
    }
  }

  private async runDnsCheck(hostname: string, expectedIp: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.dnsZonesApi.dnsZoneControllerVerifyDns(hostname, expectedIp)
      );
      this.dnsResult.set({ ok: res.matches, resolvedAddresses: res.resolvedAddresses });
    } catch {
      this.dnsResult.set({ ok: false, resolvedAddresses: [] });
    } finally {
      this.dnsChecking.set(false);
    }
  }

  private validateSubdomain(value: string): string | null {
    if (value.length > 63) return 'Subdomain prefix must be 63 characters or fewer';
    const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!labelRe.test(value)) {
      return 'Use lowercase letters, numbers and hyphens only; cannot start or end with a hyphen';
    }
    return null;
  }

  private validateFqdn(value: string): string | null {
    // Each label: 1-63 chars, lowercase alphanumeric or hyphens, no leading/trailing hyphen
    const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    const labels = value.split('.');
    if (labels.length < 2) return 'Must contain at least one dot (e.g. app.example.com)';
    for (const label of labels) {
      if (!label) return 'Labels cannot be empty (no consecutive dots)';
      if (!labelRe.test(label)) {
        return `"${label}" is invalid — use lowercase letters, numbers and hyphens only, not starting or ending with a hyphen`;
      }
    }
    return null;
  }

  protected onAppChange(appId: string): void {
    this.selectedAppId.set(appId);
    const zone = this.effectiveAssignment();
    const slug = this.applications().find(a => a.id === appId)?.slug ?? '';
    if (zone) {
      if (!this.form.subdomainPrefix && slug) this.form.subdomainPrefix = slug;
    } else {
      if (!this.form.fqdn && slug) this.form.fqdn = `${slug}.example.com`;
    }
  }

  protected onSubdomainChange(): void {
    const v = this.form.subdomainPrefix.trim();
    this.subdomainError.set(v ? this.validateSubdomain(v) : null);
  }

  protected onIpSlugChange(): void {
    const v = this.form.ipSlugOverride.trim();
    this.ipSlugError.set(v ? this.validateSubdomain(v) : null);
  }

  protected isValid(): boolean {
    const hasApp = !!this.fixedApplicationId() || !!this.form.applicationId;
    if (!hasApp) return false;

    // Internal endpoints: needs a zone + subdomain + cluster capabilities + Auth Proxy.
    // (Internal always uses the cluster zone — byodOverride is ignored here.)
    if (this.endpointType() === 'internal') {
      const zone = this.assignment();
      const subdomainOk =
        !!zone &&
        !!this.form.subdomainPrefix.trim() &&
        !this.subdomainError();
      // In edit mode the capability/authz gates were enforced at create time.
      const gatesOk = this.isEditMode() || this.internalAvailable();
      return subdomainOk && gatesOk;
    }

    const zone = this.effectiveAssignment();
    let fqdnOk = true;
    let fqdnFormatOk = true;
    if (this.form.hostnameMode === 'ip') {
      fqdnOk = !!this.masterIp();
      fqdnFormatOk = !this.ipSlugError();
    } else {
      fqdnOk = zone ? !!this.form.subdomainPrefix.trim() : !!this.form.fqdn.trim();
      fqdnFormatOk = zone ? !this.subdomainError() : !this.fqdnError();
    }
    // dns-01 requires an assigned zone with wildcard
    const challengeOk = this.form.certChallenge !== 'dns-01' || this.canUseDns01();
    const certOk = !this.form.certificateRequired || !!this.form.certificateProvider;
    const issuersOk = !this.form.certificateRequired || this.issuersReady();
    return fqdnOk && fqdnFormatOk && challengeOk && certOk && issuersOk;
  }

  protected submit(): void {
    if (!this.isValid()) return;
    const ep = this.endpoint();

    if (ep) {
      this.save.emit({ id: ep.id, dto: this.buildUpdateDto(ep) });
    } else if (this.endpointType() === 'internal') {
      // The backend derives fqdn (`<slug>.internal.<zone>`), provisions the
      // cert via the cluster wildcard issuer, and ignores per-endpoint
      // domain / cert fields. Just send the type + applicationId.
      const dto: CreateAppEndpointDto = {
        applicationId: this.fixedApplicationId() || this.form.applicationId,
        endpointType: 'internal' as CreateAppEndpointDto.EndpointTypeEnum,
      };
      this.save.emit({ clusterId: this.clusterId(), dto });
    } else {
      this.save.emit({ clusterId: this.clusterId(), dto: this.buildCreateDto() });
    }
  }

  private resolveFqdn(): string | undefined {
    if (this.form.hostnameMode === 'ip') {
      const slugOverride = this.form.ipSlugOverride.trim();
      const ip = this.masterIp();
      return (slugOverride && ip)
        ? `${slugOverride}.${ip.replaceAll('.',  '-')}.nip.io`
        : undefined;
    }
    if (this.effectiveAssignment()) {
      const prefix = this.form.subdomainPrefix.trim();
      return prefix ? `${prefix}.${this.zoneSuffix()}` : undefined;
    }
    return this.form.fqdn.trim() || undefined;
  }

  // In BYOD-override or ip mode no zone is linked, so the backend treats
  // this endpoint as fully external (no DNS/cert auto-management).
  private zoneForSubmit(): ClusterDnsZoneResponseDto | null {
    return this.form.hostnameMode === 'domain' ? this.effectiveAssignment() : null;
  }

  private buildUpdateDto(ep: AppEndpointResponseDto): UpdateAppEndpointDto {
    const resolvedFqdn = this.resolveFqdn();
    const zone = this.zoneForSubmit();
    const providerForSubmit = (this.form.certificateRequired && this.promoteToProd())
      ? 'lets_encrypt'
      : this.form.certificateProvider;
    // Explicit null detaches a previously linked zone (generated client
    // still types the field as string — backend accepts null for BYOD).
    let zoneIdUpdate: Partial<UpdateAppEndpointDto> = {};
    if (zone) {
      zoneIdUpdate = { clusterDnsZoneId: zone.id };
    } else if (ep.clusterDnsZoneId) {
      zoneIdUpdate = { clusterDnsZoneId: null as unknown as string };
    }
    return {
      ...(resolvedFqdn ? { fqdn: resolvedFqdn } : {}),
      ...zoneIdUpdate,
      certificateRequired: this.form.certificateRequired,
      ...(this.form.certificateRequired
        ? { certificateProvider: providerForSubmit as UpdateAppEndpointDto.CertificateProviderEnum }
        : {}),
      hostnameMode: this.form.hostnameMode as UpdateAppEndpointDto.HostnameModeEnum,
      certChallenge: this.form.certChallenge as UpdateAppEndpointDto.CertChallengeEnum,
    };
  }

  private buildCreateDto(): CreateAppEndpointDto {
    const resolvedFqdn = this.resolveFqdn();
    const zone = this.zoneForSubmit();
    return {
      applicationId: this.fixedApplicationId() || this.form.applicationId,
      endpointType: 'public' as CreateAppEndpointDto.EndpointTypeEnum,
      ...(resolvedFqdn ? { fqdn: resolvedFqdn } : {}),
      ...(zone ? { clusterDnsZoneId: zone.id } : {}),
      certificateRequired: this.form.certificateRequired,
      ...(this.form.certificateRequired
        ? { certificateProvider: this.form.certificateProvider as CreateAppEndpointDto.CertificateProviderEnum }
        : {}),
      hostnameMode: this.form.hostnameMode as CreateAppEndpointDto.HostnameModeEnum,
      certChallenge: this.form.certChallenge as CreateAppEndpointDto.CertChallengeEnum,
    };
  }

  private emptyForm() {
    const zone = this.effectiveAssignment();
    const defaultHostname: 'ip' | 'domain' = zone ? 'domain' : 'ip';
    const defaultChallenge: 'http-01' | 'dns-01' = zone?.wildcardCertificate ? 'dns-01' : 'http-01';
    return {
      applicationId: '',
      fqdn: '',
      subdomainPrefix: '',
      ipSlugOverride: '',
      certificateRequired: false,
      certificateProvider: (this.startsInStaging ? 'lets_encrypt_staging' : 'lets_encrypt') as string,
      hostnameMode: defaultHostname,
      certChallenge: defaultChallenge,
    };
  }
}
