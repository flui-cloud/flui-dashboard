import { Component, computed, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideExternalLink, lucideInfo, lucideMinus } from '@ng-icons/lucide';
import { PricingService } from '../../../shared/services/pricing.service';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import {
  PROVIDER_DOT,
  PROVIDER_TEXT,
  credentialKind,
  credentialKindLabel,
  providerCapabilities,
  providerState,
} from './provider-presentation';

@Component({
  selector: 'provider-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, NgIcon, ProviderMarkComponent],
  providers: [provideIcons({ lucideCheck, lucideExternalLink, lucideInfo, lucideMinus })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <article class="card-surface h-full flex flex-col p-5 gap-4" [attr.data-testid]="'provider-card-' + definition().id">
      <header class="flex items-start gap-3">
        <app-provider-mark [name]="definition().displayName" [size]="36" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-foreground truncate">{{ definition().displayName }}</h3>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium shrink-0" [class]="stateText()" data-testid="provider-state">
              <span class="h-1.5 w-1.5 rounded-full" [class]="stateDot()"></span>
              {{ state().label }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground truncate" [attr.title]="definition().description">{{ definition().description }}</p>
        </div>
      </header>

      <dl class="grid grid-cols-3 gap-3">
        <div class="min-w-0">
          <dt class="text-label">Regions</dt>
          <dd class="text-sm font-medium text-foreground mt-1" [attr.title]="regionNames()">
            @if (isConfigured()) {
              {{ enabledRegions().length }} <span class="text-muted-foreground font-normal">of {{ regionCount() }}</span>
            } @else {
              {{ regionCount() || '—' }}
            }
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="text-label">Sign-in</dt>
          <dd class="text-sm font-medium text-foreground mt-1 truncate" [attr.title]="credentialLabel()">{{ credentialLabel() || '—' }}</dd>
        </div>
        <div class="min-w-0">
          <dt class="text-label flex items-center gap-1">
            From
            @if (price(); as p) {
              @if (p.estimated) {
                <ng-icon
                  name="lucideInfo"
                  class="h-3 w-3 shrink-0 normal-case"
                  tabindex="0"
                  role="img"
                  title="Smallest machine, estimated from its hourly price."
                  aria-label="Smallest machine, estimated from its hourly price."
                />
              }
            }
          </dt>
          <dd class="text-sm font-medium text-foreground mt-1">
            @if (price(); as p) {
              {{ p.amount | currency: p.currency : 'symbol' : '1.2-2' }}<span class="text-xs text-muted-foreground font-normal">/mo</span>
            } @else {
              —
            }
          </dd>
        </div>
      </dl>

      @if (capabilities().length > 0) {
        <div>
          <p class="text-label mb-2">Capabilities</p>
          <ul class="grid grid-cols-2 gap-x-3 gap-y-1.5">
            @for (item of capabilities(); track item.key) {
              <li
                class="flex items-center gap-1.5 text-xs"
                [class]="item.on ? 'text-foreground' : 'text-muted-foreground/70'"
                [attr.title]="item.hint"
                [attr.data-testid]="'capability-' + item.key"
              >
                <ng-icon [name]="item.on ? 'lucideCheck' : 'lucideMinus'" class="h-3 w-3 shrink-0 text-muted-foreground" />
                {{ item.label }}
              </li>
            }
          </ul>
        </div>
      }

      @if (isConfigured() && lastCheckText()) {
        <p class="text-sub">Checked {{ lastCheckText() }}</p>
      }

      <footer class="mt-auto flex items-center gap-3 pt-1">
        @if (isConfigured()) {
          <a
            [routerLink]="['/management/providers', definition().id]"
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Manage
          </a>
        } @else {
          <button
            type="button"
            (click)="configure.emit(definition().id)"
            class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            data-testid="provider-connect"
          >
            Connect
          </button>
        }
        @if (definition().documentationUrl) {
          <a
            [href]="definition().documentationUrl"
            target="_blank"
            rel="noopener"
            class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Docs
            <ng-icon name="lucideExternalLink" class="h-3 w-3" />
          </a>
        }
      </footer>
    </article>
  `,
})
export class ProviderCardComponent {
  private readonly pricingService = inject(PricingService);

  configuration = input<ProviderConfigurationDto>();
  provider = input<ProviderDefinitionDto>();

  configure = output<string>();

  readonly definition = computed(() => this.provider()!);
  readonly isConfigured = computed(() => !!this.configuration());

  readonly state = computed(() => providerState(this.configuration()?.status));
  readonly stateDot = computed(() => PROVIDER_DOT[this.state().tone]);
  readonly stateText = computed(() => PROVIDER_TEXT[this.state().tone]);

  readonly enabledRegions = computed(() => this.configuration()?.enabledRegions ?? []);

  private readonly regions = computed(() => {
    const fromConfig = (this.configuration()?.availableRegions as Array<{ id: string; displayName?: string; name?: string }> | undefined) ?? [];
    return fromConfig.length ? fromConfig : this.definition().capabilities?.supportedRegions ?? [];
  });

  readonly regionCount = computed(() => this.regions().length);

  readonly regionNames = computed(() =>
    this.regions()
      .map((r) => r.displayName || r.name || r.id)
      .join(', '),
  );

  readonly credentialLabel = computed(() => credentialKindLabel(credentialKind(this.definition())));

  readonly capabilities = computed(() => providerCapabilities(this.definition()));

  readonly price = computed(() => {
    const pricing = this.definition().capabilities?.pricing;
    if (!pricing?.minimumCost) return null;
    const hourly = pricing.billingCycle === 'hourly';
    return {
      currency: pricing.currency || 'EUR',
      amount: hourly ? this.pricingService.calculateMonthlyPrice(pricing.minimumCost) : pricing.minimumCost,
      estimated: hourly,
    };
  });

  readonly lastCheckText = computed(() => {
    const lastCheck = this.configuration()?.lastHealthCheck;
    if (!lastCheck) return '';
    const minutes = Math.floor((Date.now() - new Date(lastCheck).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  });
}
