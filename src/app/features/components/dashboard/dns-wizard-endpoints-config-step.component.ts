import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DnsSetupWizardService, DirectEndpointRow } from './dns-setup-wizard.service';
import { DNSZonesService } from '../../../core/api/api/dNSZones.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';
import {
  HostnameMode,
  RowForm,
  canSaveRowForm,
  emptyRowForm,
  initialRowForm,
  validateDomain,
  validatePrefix,
} from './dns-wizard-endpoints-config-form';

export { validatePrefix } from './dns-wizard-endpoints-config-form';

@Component({
  selector: 'app-dns-wizard-endpoints-config-step',
  imports: [FormsModule, FlAlert, FlCopyId, FlTable, FlButton, FlSpinner, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Pick a public address for each app. A test address works right away without DNS setup; use
      your domain if you have one. One certificate covers them all.
    </p>

    @if (wiz.loadingDirectConfig()) {
      <div class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted">
        <fl-spinner label="Loading addresses" />
        Loading the current addresses…
      </div>
    }

    <div class="fl-table-wrap">
      <table flTable density="dense">
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col">Address</th>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of wiz.directEndpoints(); track row.key) {
            @let displayFqdn = rowDisplayFqdn(row);
            <tr>
              <td>{{ row.label }}</td>
              <td class="whitespace-normal">
                @if (displayFqdn) {
                  <fl-copy-id [value]="displayFqdn" label="address" />
                } @else {
                  <span class="text-fl-ink-muted">Not configured</span>
                }
                @if (row.error && activeFormKey() !== row.key) {
                  <span
                    class="block text-fl-caption text-fl-danger"
                    [attr.data-testid]="'direct-row-error-' + row.key"
                  >
                    {{ row.error }}
                  </span>
                }
              </td>
              <td>
                @if (displayFqdn) {
                  {{ row.draftHostnameMode === 'ip' ? 'Test address' : 'Your domain' }}
                } @else {
                  <span class="text-fl-ink-muted">—</span>
                }
              </td>
              <td>
                @if (row.configured || row.endpoint?.id) {
                  <fl-status tone="success" label="Ready" />
                } @else {
                  <fl-status tone="neutral" label="To set" />
                }
              </td>
              <td class="is-fit">
                @if (activeFormKey() !== row.key) {
                  <button flButton size="sm" type="button" (click)="openForm(row)">
                    {{ row.configured || row.endpoint?.id ? 'Edit' : 'Add' }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (activeRow(); as row) {
      @let f = getForm(row.key);
      <section
        class="flex flex-col gap-3 rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
        [attr.aria-label]="'Address of ' + row.label"
      >
        <span class="text-fl-body-sm font-semibold">Address of {{ row.label }}</span>

        <div class="fl-segmented self-start" role="group" aria-label="Hostname source">
          <button
            type="button"
            [attr.aria-pressed]="f.hostnameMode === 'ip'"
            [disabled]="!wiz.masterIp()"
            [title]="
              !wiz.masterIp() ? 'Cluster IP not available yet' : 'Auto-generated test address'
            "
            (click)="setMode(row.key, 'ip')"
          >
            Test address
          </button>
          <button
            type="button"
            [attr.aria-pressed]="f.hostnameMode === 'domain'"
            (click)="setMode(row.key, 'domain')"
          >
            Your domain
          </button>
        </div>

        <div class="fl-field" [class.is-invalid]="!!f.prefixError || !!f.domainError">
          <label class="fl-field__label" [attr.for]="'direct-prefix-' + row.key">Address</label>
          <div class="fl-input fl-input--lg fl-mono">
            <input
              type="text"
              [id]="'direct-prefix-' + row.key"
              [ngModel]="f.prefix"
              (ngModelChange)="onPrefixChange(row.key, $event)"
              [placeholder]="row.slug || 'api'"
              autocomplete="off"
              spellcheck="false"
            />
            @if (f.hostnameMode === 'ip') {
              <span class="whitespace-nowrap">.{{ ipDashed() }}.nip.io</span>
            } @else {
              <span>.</span>
              <input
                type="text"
                [ngModel]="f.domain"
                (ngModelChange)="onDomainChange(row.key, $event)"
                placeholder="example.com"
                aria-label="Domain"
                autocomplete="off"
                spellcheck="false"
              />
            }
          </div>
          @if (f.prefixError) {
            <span class="fl-field__error">{{ f.prefixError }}</span>
          }
          @if (f.hostnameMode === 'domain' && f.domainError) {
            <span class="fl-field__error">{{ f.domainError }}</span>
          }
          @if (f.hostnameMode === 'ip' && !f.prefixError && f.prefix.trim()) {
            <span class="fl-field__hint">Works right away, no DNS setup needed.</span>
          }
        </div>

        @if (
          f.hostnameMode === 'domain' &&
          !f.prefixError &&
          !f.domainError &&
          f.prefix.trim() &&
          f.domain.trim()
        ) {
          <div class="flex flex-col gap-2">
            <span class="text-fl-body-sm">Create this record at your DNS provider:</span>
            <div class="fl-table-wrap">
              <table flTable density="dense">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <fl-copy-id [value]="f.prefix.trim() + '.' + f.domain.trim()" label="name" />
                    </td>
                    <td class="fl-mono">A</td>
                    <td>
                      @if (wiz.masterIp()) {
                        <fl-copy-id [value]="wiz.masterIp()" label="value" />
                      } @else {
                        <span class="text-fl-ink-muted">Your cluster IP</span>
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            @if (wiz.masterIp()) {
              @if (f.dnsChecking) {
                <fl-status tone="progress" label="Checking DNS…" />
              } @else if (f.dnsOk === true) {
                <fl-status tone="success" label="Points to your cluster" />
              } @else if (f.dnsOk === false) {
                <fl-status tone="warning" [label]="mismatchLabel(f)" />
              }
            }
          </div>
        }

        <span class="text-fl-caption text-fl-ink-muted">
          One certificate is shared across all the apps you set up here.
        </span>

        @if (row.error) {
          <fl-alert tone="error" title="Address not saved">{{ row.error }}</fl-alert>
        }

        <div class="flex items-center justify-end gap-2">
          <button flButton="ghost" size="sm" type="button" (click)="closeForm()">Cancel</button>
          <button
            flButton
            size="sm"
            type="button"
            (click)="save(row)"
            [disabled]="!canSaveRow(row.key)"
          >
            Save
          </button>
        </div>
      </section>
    }

    @if (wiz.endpointsConfigError()) {
      <fl-alert tone="error" title="Addresses not valid">{{ wiz.endpointsConfigError() }}</fl-alert>
    }

    @if (allConfigured()) {
      <fl-status
        tone="success"
        label="All set. Next publishes the addresses and issues the certificate."
      />
    }
  `,
})
export class DnsWizardEndpointsConfigStepComponent {
  protected wiz = inject(DnsSetupWizardService);
  private readonly dnsZonesApi = inject(DNSZonesService);

  protected activeFormKey = signal<string | null>(null);
  private readonly forms = signal<Record<string, RowForm>>({});
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly activeRow = computed(() => {
    const key = this.activeFormKey();
    return key ? (this.wiz.directEndpoints().find((r) => r.key === key) ?? null) : null;
  });

  protected allConfigured = computed(() => {
    const rows = this.wiz.directEndpoints();
    if (rows.length === 0) return false;
    return rows.every((r) => {
      if (!r.configured) return false;
      if (r.draftHostnameMode === 'ip') return !!r.draftPrefix.trim() && !!this.wiz.masterIp();
      return !!r.draftFqdn.trim();
    });
  });

  protected ipDashed = computed(() => this.wiz.masterIp().replaceAll('.', '-') || '<cluster-ip>');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((t) => clearTimeout(t)));
  }

  protected getForm(key: string): RowForm {
    return this.forms()[key] ?? emptyRowForm();
  }

  private patch(key: string, change: Partial<RowForm>): void {
    this.forms.update((all) => ({ ...all, [key]: { ...(all[key] ?? emptyRowForm()), ...change } }));
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  protected openForm(row: DirectEndpointRow): void {
    this.forms.update((all) => ({ ...all, [row.key]: initialRowForm(row, this.wiz.masterIp()) }));
    this.activeFormKey.set(row.key);
  }

  protected closeForm(): void {
    const key = this.activeFormKey();
    if (key) this.clearTimer(key);
    this.activeFormKey.set(null);
  }

  protected setMode(key: string, mode: HostnameMode): void {
    if (mode === 'ip' && !this.wiz.masterIp()) return;
    this.clearTimer(key);
    this.patch(key, {
      hostnameMode: mode,
      prefixError: null,
      domainError: null,
      dnsOk: null,
      dnsResolved: [],
    });
  }

  protected onPrefixChange(key: string, value: string): void {
    const v = value.trim();
    this.patch(key, { prefix: value, prefixError: v ? validatePrefix(v) : null });
    if (this.getForm(key).hostnameMode === 'domain') this.scheduleDnsCheck(key);
  }

  protected onDomainChange(key: string, value: string): void {
    const v = value.trim();
    this.patch(key, { domain: value, domainError: v ? validateDomain(v) : null });
    this.scheduleDnsCheck(key);
  }

  private scheduleDnsCheck(key: string): void {
    this.clearTimer(key);
    this.patch(key, { dnsOk: null, dnsResolved: [] });
    const f = this.getForm(key);
    const ip = this.wiz.masterIp();
    const prefix = f.prefix.trim();
    const domain = f.domain.trim();
    if (!ip || !prefix || !domain || f.prefixError || f.domainError) {
      this.patch(key, { dnsChecking: false });
      return;
    }
    const fqdn = `${prefix}.${domain}`;
    this.patch(key, { dnsChecking: true });
    this.timers.set(
      key,
      setTimeout(() => this.runDnsCheck(key, fqdn, ip), 600),
    );
  }

  private async runDnsCheck(key: string, hostname: string, expectedIp: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.dnsZonesApi.dnsZoneControllerVerifyDns(hostname, expectedIp),
      );
      this.patch(key, { dnsOk: res.matches, dnsResolved: res.resolvedAddresses });
    } catch {
      this.patch(key, { dnsOk: false, dnsResolved: [] });
    } finally {
      this.patch(key, { dnsChecking: false });
    }
  }

  protected canSaveRow(key: string): boolean {
    return canSaveRowForm(this.getForm(key), this.wiz.masterIp());
  }

  protected save(row: DirectEndpointRow): void {
    const f = this.getForm(row.key);
    if (!this.canSaveRow(row.key)) return;
    const fqdn = f.hostnameMode === 'domain' ? `${f.prefix.trim()}.${f.domain.trim()}` : '';
    this.wiz.commitDirectRow(row.key, {
      hostnameMode: f.hostnameMode,
      fqdn,
      prefix: f.hostnameMode === 'ip' ? f.prefix.trim() : '',
    });
    this.closeForm();
  }

  protected mismatchLabel(f: RowForm): string {
    const base = `Does not point to ${this.wiz.masterIp()} yet`;
    return f.dnsResolved.length ? `${base}, currently ${f.dnsResolved.join(', ')}` : base;
  }

  protected rowDisplayFqdn(row: DirectEndpointRow): string {
    if (row.endpoint?.fqdn) return row.endpoint.fqdn;
    if (!row.configured) return '';
    return this.wiz.resolveDraftFqdn(row);
  }
}
