import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideEdit2,
  lucidePlus,
  lucideX,
  lucideLoader,
  lucideCheckCircle,
  lucideAlertCircle,
  lucideRefreshCw,
  lucideZap,
  lucideGlobe,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { DnsSetupWizardService, DirectEndpointRow } from './dns-setup-wizard.service';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';

type HostnameMode = 'ip' | 'domain';

interface RowForm {
  hostnameMode: HostnameMode;
  /** Subdomain prefix — used by both nip.io mode (prepended to the IP) and custom-domain mode
   *  (prepended to the user's domain). Defaults to the app slug. */
  prefix: string;
  prefixError: string | null;
  /** User's domain (e.g. `example.com`). Only used when hostnameMode === 'domain'. */
  domain: string;
  domainError: string | null;
  dnsChecking: boolean;
  dnsOk: boolean | null;
  dnsResolved: string[];
  timer: ReturnType<typeof setTimeout> | null;
}

function validateDomain(value: string): string | null {
  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  const labels = value.split('.');
  if (labels.length < 2) return 'Must contain at least one dot (e.g. example.com)';
  for (const label of labels) {
    if (!label) return 'Cannot have empty parts';
    if (!labelRe.test(label)) {
      return `"${label}" is invalid — letters, numbers and hyphens only`;
    }
  }
  return null;
}

function validatePrefix(value: string): string | null {
  if (value.length > 63) return 'Must be 63 characters or fewer';
  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!labelRe.test(value)) return 'Letters, numbers and hyphens only';
  return null;
}

@Component({
  selector: 'app-dns-wizard-endpoints-config-step',
  standalone: true,
  imports: [FormsModule, NgIconComponent],
  providers: [
    provideIcons({ lucideEdit2, lucidePlus, lucideX, lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideRefreshCw, lucideZap, lucideGlobe }),
  ],
  template: `
    <div class="flex items-start justify-between mb-1">
      <h3 class="text-sm font-semibold text-foreground">Configure app endpoints</h3>
      @if (wiz.loadingDirectConfig()) {
        <ng-icon name="lucideLoader" class="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
      }
    </div>
    <p class="text-xs text-muted-foreground mb-4">
      Pick a public address for each app. Use <strong>Test address</strong> for instant access without DNS setup,
      or <strong>Your domain</strong> if you have one. One certificate covers them all.
    </p>

    <div class="flex flex-col gap-2">
      @for (row of wiz.directEndpoints(); track row.key) {
        <div class="rounded-lg border border-border overflow-hidden">
          <!-- Row header -->
          <div class="flex items-center gap-3 px-4 py-3">
            <!-- Status dot -->
            @if (row.configured || row.endpoint?.id) {
              <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
            } @else {
              <div class="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0"></div>
            }

            <!-- Label + fqdn -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-foreground">{{ row.label }}</p>
              @if (rowDisplayFqdn(row); as displayFqdn) {
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    [class]="row.draftHostnameMode === 'ip'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'"
                  >
                    {{ row.draftHostnameMode === 'ip' ? 'Test' : 'Domain' }}
                  </span>
                  <p class="text-xs font-mono text-muted-foreground truncate">{{ displayFqdn }}</p>
                </div>
              } @else {
                <p class="text-xs text-muted-foreground italic">No endpoint configured</p>
              }
            </div>

            <!-- Edit / Add button -->
            @if (activeFormKey() !== row.key) {
              @if (row.configured || row.endpoint?.id) {
                <button
                  type="button"
                  (click)="openForm(row)"
                  title="Edit hostname"
                  class="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  <ng-icon name="lucideEdit2" class="h-3.5 w-3.5" />
                </button>
              } @else {
                <button
                  type="button"
                  (click)="openForm(row)"
                  class="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                >
                  <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
                  Add
                </button>
              }
            }
          </div>

          <!-- Inline form -->
          @if (activeFormKey() === row.key) {
            @let f = getForm(row.key);
            <div class="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
              <!-- Hostname mode toggle (compact segmented) -->
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">Hostname source</label>
                <div class="inline-flex rounded-md border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    (click)="setMode(row.key, 'ip')"
                    [disabled]="!wiz.masterIp()"
                    [class]="modeBtnClass(f.hostnameMode === 'ip', !wiz.masterIp())"
                    [title]="!wiz.masterIp() ? 'Cluster IP not available yet' : 'Auto-generated test address'"
                  >
                    <ng-icon name="lucideZap" class="h-3 w-3" />
                    Test address
                  </button>
                  <button
                    type="button"
                    (click)="setMode(row.key, 'domain')"
                    [class]="modeBtnClass(f.hostnameMode === 'domain', false)"
                  >
                    <ng-icon name="lucideGlobe" class="h-3 w-3" />
                    Your domain
                  </button>
                </div>
              </div>

              <!-- Split address: subdomain (always editable, defaulted to app slug) + suffix -->
              <div>
                <label class="block text-xs font-medium text-foreground mb-1">Address</label>
                <div class="flex items-stretch">
                  <input
                    type="text"
                    [(ngModel)]="f.prefix"
                    (ngModelChange)="onPrefixChange(row.key)"
                    [placeholder]="row.slug || 'api'"
                    class="flex-1 min-w-0 px-3 py-1.5 border rounded-l-md bg-background text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    [class.border-destructive]="f.prefixError"
                  />
                  @if (f.hostnameMode === 'ip') {
                    <span class="inline-flex items-center px-2 py-1.5 border border-l-0 rounded-r-md bg-muted text-xs text-muted-foreground font-mono whitespace-nowrap select-none">
                      .{{ ipDashed() }}.nip.io
                    </span>
                  } @else {
                    <span class="inline-flex items-center px-2 py-1.5 border border-l-0 bg-muted text-xs text-muted-foreground font-mono select-none">.</span>
                    <input
                      type="text"
                      [(ngModel)]="f.domain"
                      (ngModelChange)="onDomainChange(row.key)"
                      placeholder="example.com"
                      class="flex-1 min-w-0 px-3 py-1.5 border border-l-0 rounded-r-md bg-background text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      [class.border-destructive]="f.domainError"
                    />
                  }
                </div>
                @if (f.prefixError) {
                  <p class="mt-1 text-xs text-destructive">{{ f.prefixError }}</p>
                }
                @if (f.hostnameMode === 'domain' && f.domainError) {
                  <p class="mt-1 text-xs text-destructive">{{ f.domainError }}</p>
                }
                @if (f.hostnameMode === 'ip' && !f.prefixError && f.prefix.trim()) {
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    Works out of the box — no DNS setup required.
                  </p>
                }
                @if (f.hostnameMode === 'domain' && !f.prefixError && !f.domainError && f.prefix.trim() && f.domain.trim()) {
                  <p class="mt-1 text-[11px] text-muted-foreground">
                    Make sure <span class="font-mono">{{ f.prefix }}.{{ f.domain }}</span> points to <span class="font-mono">{{ wiz.masterIp() || 'your cluster IP' }}</span>.
                  </p>
                }
              </div>

              <!-- DNS resolution check (custom domain only) -->
              @if (f.hostnameMode === 'domain' && wiz.masterIp() && f.prefix.trim() && f.domain.trim() && !f.prefixError && !f.domainError) {
                <div class="flex items-center gap-1.5 text-xs">
                  @if (f.dnsChecking) {
                    <ng-icon name="lucideLoader" class="h-3 w-3 animate-spin text-muted-foreground" />
                    <span class="text-muted-foreground">Checking…</span>
                  } @else if (f.dnsOk === true) {
                    <ng-icon name="lucideCheckCircle" class="h-3 w-3 text-emerald-500" />
                    <span class="text-emerald-600 dark:text-emerald-400">Points to your cluster</span>
                  } @else if (f.dnsOk === false) {
                    <ng-icon name="lucideAlertCircle" class="h-3 w-3 text-amber-500" />
                    <span class="text-amber-600 dark:text-amber-400">
                      Doesn't point to {{ wiz.masterIp() }} yet
                      @if (f.dnsResolved.length) { — currently {{ f.dnsResolved.join(', ') }} }
                    </span>
                  }
                </div>
              }

              <p class="text-[11px] text-muted-foreground">
                One certificate is shared across all the apps you set up here.
              </p>

              <!-- Row error -->
              @if (row.error) {
                <p class="text-xs text-destructive">{{ row.error }}</p>
              }

              <!-- Actions -->
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="closeForm()"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  (click)="save(row)"
                  [disabled]="!canSaveRow(row.key)"
                  class="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (allConfigured()) {
      <div class="mt-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 flex items-center gap-2">
        <ng-icon name="lucideCheckCircle" class="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <p class="text-xs text-emerald-700 dark:text-emerald-300">
          All set. Click Next to publish the addresses and issue the certificate.
        </p>
      </div>
    }
  `,
})
export class DnsWizardEndpointsConfigStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  private readonly dnsZonesApi = inject(DNSZonesService);

  protected activeFormKey = signal<string | null>(null);
  protected allConfigured = computed(() => {
    const rows = this.wiz.directEndpoints();
    if (rows.length === 0) return false;
    return rows.every(r => {
      if (!r.configured) return false;
      if (r.draftHostnameMode === 'ip') return !!r.draftPrefix.trim() && !!this.wiz.masterIp();
      return !!r.draftFqdn.trim();
    });
  });

  protected ipDashed = computed(() => this.wiz.masterIp().replaceAll('.',  '-') || '<cluster-ip>');

  protected rowForms = new Map<string, RowForm>();

  private emptyForm(initial?: Partial<RowForm>): RowForm {
    return {
      hostnameMode: initial?.hostnameMode ?? 'ip',
      prefix: initial?.prefix ?? '',
      prefixError: null,
      domain: initial?.domain ?? '',
      domainError: null,
      dnsChecking: false,
      dnsOk: null,
      dnsResolved: [],
      timer: null,
    };
  }

  protected getForm(key: string): RowForm {
    if (!this.rowForms.has(key)) this.rowForms.set(key, this.emptyForm());
    return this.rowForms.get(key)!;
  }

  protected openForm(row: DirectEndpointRow): void {
    // Default to nip.io when the master IP is available — fastest path. If the
    // user previously committed a domain, restore prefix + domain split.
    const initialMode: HostnameMode = row.draftHostnameMode || (this.wiz.masterIp() ? 'ip' : 'domain');
    let initialPrefix = row.draftPrefix;
    let initialDomain = '';
    if (initialMode === 'domain' && row.draftFqdn) {
      // Split the previously committed FQDN into prefix + domain (first label vs rest).
      const dot = row.draftFqdn.indexOf('.');
      if (dot > 0) {
        initialPrefix = row.draftFqdn.slice(0, dot);
        initialDomain = row.draftFqdn.slice(dot + 1);
      } else {
        initialPrefix = row.draftFqdn;
      }
    }
    if (!initialPrefix) initialPrefix = row.slug;
    const f = this.emptyForm({
      hostnameMode: initialMode,
      prefix: initialPrefix,
      domain: initialDomain,
    });
    this.rowForms.set(row.key, f);
    this.activeFormKey.set(row.key);
  }

  protected closeForm(): void {
    const key = this.activeFormKey();
    if (key) {
      const f = this.rowForms.get(key);
      if (f?.timer) clearTimeout(f.timer);
    }
    this.activeFormKey.set(null);
  }

  protected setMode(key: string, mode: HostnameMode): void {
    if (mode === 'ip' && !this.wiz.masterIp()) return;
    const f = this.getForm(key);
    f.hostnameMode = mode;
    f.prefixError = null;
    f.domainError = null;
    f.dnsOk = null;
    f.dnsResolved = [];
    if (f.timer) clearTimeout(f.timer);
  }

  protected onPrefixChange(key: string): void {
    const f = this.getForm(key);
    const v = f.prefix.trim();
    f.prefixError = v ? validatePrefix(v) : null;
    if (f.hostnameMode === 'domain') this.scheduleDnsCheck(key);
  }

  protected onDomainChange(key: string): void {
    const f = this.getForm(key);
    const v = f.domain.trim();
    f.domainError = v ? validateDomain(v) : null;
    this.scheduleDnsCheck(key);
  }

  private scheduleDnsCheck(key: string): void {
    const f = this.getForm(key);
    f.dnsOk = null;
    f.dnsResolved = [];
    if (f.timer) clearTimeout(f.timer);
    const ip = this.wiz.masterIp();
    const prefix = f.prefix.trim();
    const domain = f.domain.trim();
    if (!ip || !prefix || !domain || f.prefixError || f.domainError) {
      f.dnsChecking = false;
      return;
    }
    const fqdn = `${prefix}.${domain}`;
    f.dnsChecking = true;
    f.timer = setTimeout(() => this.runDnsCheck(key, fqdn, ip), 600);
  }

  private async runDnsCheck(key: string, hostname: string, expectedIp: string): Promise<void> {
    const f = this.getForm(key);
    try {
      const res = await firstValueFrom(this.dnsZonesApi.dnsZoneControllerVerifyDns(hostname, expectedIp));
      f.dnsOk = res.matches;
      f.dnsResolved = res.resolvedAddresses;
    } catch {
      f.dnsOk = false;
      f.dnsResolved = [];
    } finally {
      f.dnsChecking = false;
    }
  }

  protected canSaveRow(key: string): boolean {
    const f = this.getForm(key);
    if (f.hostnameMode === 'ip') return !!f.prefix.trim() && !f.prefixError && !!this.wiz.masterIp();
    return !!f.prefix.trim() && !f.prefixError
      && !!f.domain.trim() && !f.domainError
      && !f.dnsChecking;
  }

  protected save(row: DirectEndpointRow): void {
    const f = this.getForm(row.key);
    if (!this.canSaveRow(row.key)) return;
    const fqdn = f.hostnameMode === 'domain'
      ? `${f.prefix.trim()}.${f.domain.trim()}`
      : '';
    this.wiz.commitDirectRow(row.key, {
      hostnameMode: f.hostnameMode,
      fqdn,
      prefix: f.hostnameMode === 'ip' ? f.prefix.trim() : '',
    });
    this.closeForm();
  }

  protected modeBtnClass(active: boolean, disabled: boolean): string {
    const base = 'flex items-center gap-1 px-2.5 py-1 transition-colors';
    if (disabled) return `${base} bg-muted text-muted-foreground/50 cursor-not-allowed`;
    return active
      ? `${base} bg-primary text-primary-foreground`
      : `${base} bg-background text-foreground hover:bg-muted`;
  }

  protected rowDisplayFqdn(row: DirectEndpointRow): string {
    if (row.endpoint?.fqdn) return row.endpoint.fqdn;
    if (!row.configured) return '';
    return this.wiz.resolveDraftFqdn(row);
  }
}
