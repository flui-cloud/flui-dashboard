import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideSettings2, lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideChevronDown, lucideChevronUp
} from '@ng-icons/lucide';
import { ClusterDnsZoneService } from '../../service/cluster-dns-zone.service';
import { ConfigureSystemIngressDto } from '../../../core/api/model/configureSystemIngressDto';

@Component({
  selector: 'app-cluster-system-ingress-form',
  standalone: true,
  imports: [FormsModule, NgIconComponent],
  providers: [
    provideIcons({ lucideSettings2, lucideLoader, lucideCheckCircle, lucideAlertCircle, lucideChevronDown, lucideChevronUp }),
  ],
  template: `
    <div class="space-y-3">
      <!-- Header toggle -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-foreground">System Ingress</h3>
          <p class="text-xs text-sub mt-0.5">
            Configure ingress routes for the Flui API and web app domains.
          </p>
        </div>
        <button
          (click)="toggleForm()"
          class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ng-icon name="lucideSettings2" class="h-3.5 w-3.5" />
          {{ showForm() ? 'Hide' : 'Configure' }}
          <ng-icon [name]="showForm() ? 'lucideChevronUp' : 'lucideChevronDown'" class="h-3 w-3" />
        </button>
      </div>

      @if (showForm()) {
        <div class="border border-border rounded-lg p-4 space-y-4 card-inner">

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-medium text-foreground">
                API Domain <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="form.apiDomain"
                [placeholder]="'api.' + (zoneName() || 'example.com')"
                class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-foreground">
                App Domain <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="form.appDomain"
                [placeholder]="'app.' + (zoneName() || 'example.com')"
                class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-foreground">Certificate Issuer</label>
            <select
              [(ngModel)]="form.issuer"
              class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lets_encrypt_staging">Let's Encrypt Staging</option>
              <option value="lets_encrypt">Let's Encrypt Production</option>
            </select>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
              <ng-icon name="lucideAlertCircle" class="h-3.5 w-3.5 flex-shrink-0" />
              {{ error() }}
            </div>
          }

          @if (success()) {
            <div class="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400">
              <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5 flex-shrink-0" />
              System ingress configured successfully.
            </div>
          }

          <div class="flex items-center gap-2">
            <button
              (click)="submit()"
              [disabled]="saving() || !form.apiDomain.trim() || !form.appDomain.trim()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (saving()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                Applying…
              } @else {
                <ng-icon name="lucideCheckCircle" class="h-3.5 w-3.5" />
                Apply
              }
            </button>
            <button
              (click)="showForm.set(false)"
              [disabled]="saving()"
              class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClusterSystemIngressFormComponent {
  private readonly dnsZoneService = inject(ClusterDnsZoneService);

  clusterId = input.required<string>();
  zoneName = input<string>('');

  protected showForm = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);

  protected form: { apiDomain: string; appDomain: string; issuer: ConfigureSystemIngressDto.IssuerEnum } = {
    apiDomain: '',
    appDomain: '',
    issuer: ConfigureSystemIngressDto.IssuerEnum.LetsEncryptStaging,
  };

  protected toggleForm(): void {
    this.showForm.update(v => !v);
  }

  protected async submit(): Promise<void> {
    const apiDomain = this.form.apiDomain.trim();
    const appDomain = this.form.appDomain.trim();
    if (!apiDomain || !appDomain) return;

    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    const ok = await this.dnsZoneService.configureSystemIngress(this.clusterId(), {
      apiDomain,
      appDomain,
      issuer: this.form.issuer,
    });

    this.saving.set(false);
    if (ok) {
      this.success.set(true);
      setTimeout(() => {
        this.success.set(false);
        this.showForm.set(false);
      }, 2000);
    } else {
      this.error.set(this.dnsZoneService.error() ?? 'Failed to configure system ingress');
    }
  }
}
