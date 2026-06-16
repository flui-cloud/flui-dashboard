import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCircleAlert,
  lucideGlobe,
  lucideLoader,
  lucideShieldCheck,
  lucideTriangleAlert,
  lucideZap,
  lucideLock,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogService } from '../../../service/catalog.service';

@Component({
  selector: 'app-catalog-domain-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideCircleAlert,
      lucideGlobe,
      lucideLoader,
      lucideShieldCheck,
      lucideTriangleAlert,
      lucideZap,
      lucideLock,
    }),
  ],
  template: `
    <div class="space-y-5">
      <div>
        <h3 class="text-base font-semibold">Domain & endpoint</h3>
        <p class="text-sm text-muted-foreground">
          Pick how this app will be reached. Flui provisions DNS and TLS automatically
          when your cluster is ready.
        </p>
      </div>

      @if (catalog.capabilitiesLoading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Checking cluster capabilities…
        </div>
      } @else if (catalog.capabilitiesError()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <div class="flex-1">
            {{ catalog.capabilitiesError() }}
          </div>
        </div>
      } @else {
        @let caps = catalog.capabilities();

        <!-- Manifest-locked: app declares the endpoint config and the user can't override it. -->
        @if (domainLocked()) {
          <div class="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div class="flex items-center gap-2">
              <ng-icon name="lucideLock" class="h-4 w-4 text-muted-foreground" />
              <p class="text-sm font-medium">Endpoint configured by the app</p>
            </div>
            <p class="text-xs text-muted-foreground">
              This app's manifest pins the hostname source — you can't override it from the wizard.
              Flui will create the endpoint automatically.
            </p>
            @if (autoFqdnPreview()) {
              <div class="mt-2 flex items-baseline gap-2 font-mono text-xs">
                <span class="text-muted-foreground">https://</span>
                <span class="text-foreground">{{ autoFqdnPreview() }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              (click)="setMode('auto')"
              [class]="modeCardClass(state.domainMode() === 'auto')"
            >
              <ng-icon [name]="autoModeIcon()" class="h-5 w-5 text-primary" />
              <div class="mt-2 text-sm font-medium">{{ autoModeLabel() }}</div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ autoModeDescription() }}
              </p>
            </button>

            <button
              type="button"
              (click)="setMode('custom')"
              [class]="modeCardClass(state.domainMode() === 'custom')"
            >
              <ng-icon name="lucideGlobe" class="h-5 w-5 text-primary" />
              <div class="mt-2 text-sm font-medium">Custom FQDN</div>
              <p class="mt-1 text-xs text-muted-foreground">
                Bring your own hostname. Make sure DNS points to the cluster.
              </p>
            </button>

            <button
              type="button"
              (click)="setMode('skip')"
              [class]="modeCardClass(state.domainMode() === 'skip')"
            >
              <ng-icon name="lucideArrowRight" class="h-5 w-5 text-primary" />
              <div class="mt-2 text-sm font-medium">Configure later</div>
              <p class="mt-1 text-xs text-muted-foreground">
                Install without an endpoint — add DNS/TLS from the app page afterwards.
              </p>
            </button>
          </div>

          @if (state.domainMode() === 'auto') {
            <div class="rounded-lg border border-border bg-muted/30 p-4">
              <div class="text-xs uppercase tracking-wide text-muted-foreground">
                Preview
              </div>
              <div class="mt-1 flex items-baseline gap-2 font-mono text-sm">
                <span class="text-muted-foreground">https://</span>
                <span class="text-foreground">{{ autoFqdnPreview() }}</span>
              </div>
              <p class="mt-2 text-[11px] text-muted-foreground">
                @if (caps?.canAutoAssignDomain) {
                  The final slug may include a short random suffix to avoid collisions.
                } @else {
                  No domain connected — Flui will create a test address pointing to your cluster.
                }
                @if (caps?.certificateProvider === 'lets_encrypt_staging') {
                  Certificate is in test mode (browser will show a warning).
                }
              </p>
            </div>
          }

          @if (state.domainMode() === 'custom') {
            <div>
              <label class="mb-1.5 block text-sm font-medium">
                Domain <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputmode="url"
                [ngModel]="state.requestedDomain()"
                (ngModelChange)="state.requestedDomain.set($event)"
                placeholder="app.example.com"
                class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm
                       focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              @if (!state.catalogDomainValid() && state.requestedDomain().length > 0) {
                <p class="mt-1 text-xs text-destructive">
                  Enter a valid fully-qualified domain name.
                </p>
              }
              <p class="mt-1 text-xs text-muted-foreground">
                Make sure a DNS record for this hostname points to your cluster before the
                install finishes, or the endpoint will fail certificate provisioning.
              </p>
            </div>
          }

          @if (state.domainMode() === 'skip') {
            <div
              class="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground"
            >
              No endpoint will be provisioned. Once the app is running, open its page and
              add a domain from the DNS tab.
            </div>
          }

          @if (state.domainMode() !== 'skip') {
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-accent/40"
            >
              <input
                type="checkbox"
                [ngModel]="state.enableTls()"
                (ngModelChange)="state.enableTls.set($event)"
                name="enable-tls"
                class="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span class="block">
                <span class="flex items-center gap-1.5 text-sm font-medium">
                  <ng-icon name="lucideShieldCheck" class="h-4 w-4 text-primary" />
                  Provision an HTTPS certificate
                </span>
                <span class="mt-0.5 block text-xs text-muted-foreground">
                  On by default. Turn off to serve the endpoint over plain HTTP — DNS only,
                  no per-app certificate. Useful to avoid certificate rate limits or when
                  TLS is terminated upstream.
                </span>
              </span>
            </label>
          }
        }
      }
    </div>
  `,
})
export class CatalogDomainStepComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly catalog = inject(CatalogService);

  protected readonly clusterId = computed(() => this.state.clusterId() || null);

  protected readonly autoFqdnPreview = computed(() => {
    const caps = this.catalog.capabilities();
    const slug = this.state.catalogDetail()?.slug ?? 'your-app';
    const template = caps?.autoFqdnTemplate;
    if (template?.includes('{install-slug}')) {
      return template.replace('{install-slug}', `${slug}-xxxx`);
    }
    const zone = caps?.zoneName;
    if (zone) return `${slug}-xxxx.${zone}`;
    // No DNS zone → backend will fall back to nip.io against the master IP.
    return `${slug}-xxxx.<cluster-ip>.nip.io`;
  });

  /** Manifest declares `userCustomizable=false` — the user can't override the FQDN.  */
  protected readonly domainLocked = computed(
    () => this.state.catalogDetail()?.domain?.userCustomizable === false,
  );

  /** Cluster has a managed DNS zone & wildcard issuer → "auto" means subdomain on the cluster zone.
   *  Otherwise "auto" means a nip.io fallback off the master IP. */
  protected readonly autoModeLabel = computed(() =>
    this.catalog.capabilities()?.canAutoAssignDomain ? 'Auto-assigned' : 'Test address',
  );

  protected readonly autoModeIcon = computed(() =>
    this.catalog.capabilities()?.canAutoAssignDomain ? 'lucideShieldCheck' : 'lucideZap',
  );

  protected readonly autoModeDescription = computed(() =>
    this.catalog.capabilities()?.canAutoAssignDomain
      ? "Flui picks a subdomain under your cluster's domain, with a free certificate."
      : 'Instant address derived from your cluster IP — no DNS setup needed.',
  );

  setMode(mode: 'auto' | 'custom' | 'skip'): void {
    this.state.domainMode.set(mode);
    if (mode !== 'custom') this.state.requestedDomain.set('');
  }

  modeCardClass(active: boolean): string {
    const base =
      'flex flex-col items-start rounded-lg border p-4 text-left transition w-full';
    return active
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }
}
