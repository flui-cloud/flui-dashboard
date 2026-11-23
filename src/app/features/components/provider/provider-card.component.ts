import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PricingService } from '../../../shared/services/pricing.service';
import { ProviderMarkComponent } from '../../../shared/components/provider-mark.component';
import { MaskIdPipe } from '../../../shared/pipes/mask-id.pipe';
import { ProviderConfigurationDto, ProviderDefinitionDto } from '../../../core/api';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlStatus } from '../../../ui/primitives/status';
import {
  PROVIDER_STATUS,
  credentialKind,
  credentialKindLabel,
  providerState,
  sinceText,
} from './provider-presentation';

@Component({
  selector: 'tr[provider-card]',
  imports: [CurrencyPipe, RouterLink, MaskIdPipe, ProviderMarkComponent, FlActionsMenu, FlStatus],
  host: { '[attr.data-testid]': "'provider-card-' + definition().id" },
  template: `
    @let d = definition();
    <td class="fl-cell-name">
      <span class="flex items-center gap-2" [attr.title]="d.description">
        <app-provider-mark [name]="d.displayName" [size]="20" />
        @if (isConfigured()) {
          <a class="fl-link" [routerLink]="['/management/providers', d.id]">{{ d.displayName }}</a>
        } @else {
          <span class="font-medium">{{ d.displayName }}</span>
        }
      </span>
    </td>
    <td>
      @if (configuration(); as c) {
        <span class="fl-mono fl-cell-clip" [attr.title]="c.id | maskId">{{ c.id | maskId }}</span>
      } @else {
        <span class="text-fl-ink-muted">—</span>
      }
    </td>
    <td>
      <fl-status [tone]="statusTone()" [label]="state().label" data-testid="provider-state" />
    </td>
    <td [attr.title]="credentialLabel()">{{ credentialLabel() || '—' }}</td>
    <td class="is-num" [attr.title]="regionNames()">
      @if (isConfigured()) {
        {{ enabledRegions().length }}
        @if (regionCount() > enabledRegions().length) {
          <span class="text-fl-ink-muted">of {{ regionCount() }}</span>
        }
      } @else {
        {{ regionCount() || '—' }}
      }
    </td>
    <td class="is-num">{{ isConfigured() ? (clusters() ?? '—') : '—' }}</td>
    <td
      class="is-num"
      [attr.title]="
        price()?.estimated ? 'Smallest machine, estimated from its hourly price.' : null
      "
    >
      @if (price(); as p) {
        {{ p.amount | currency: p.currency : 'symbol' : '1.2-2' }}/mo
      } @else {
        —
      }
    </td>
    <td class="is-num">{{ lastCheckText() || '—' }}</td>
    <td class="is-fit">
      <fl-actions-menu
        [label]="d.displayName + ' actions'"
        [compact]="true"
        [items]="actions()"
        [attr.data-testid]="isConfigured() ? 'provider-manage' : 'provider-connect'"
        (action)="onAction($event)"
      />
    </td>
  `,
})
export class ProviderCardComponent {
  private readonly pricingService = inject(PricingService);
  private readonly router = inject(Router);

  configuration = input<ProviderConfigurationDto>();
  provider = input<ProviderDefinitionDto>();
  clusters = input<number | null>(null);

  configure = output<string>();

  readonly definition = computed(() => this.provider()!);
  readonly isConfigured = computed(() => !!this.configuration());

  readonly state = computed(() => providerState(this.configuration()?.status));
  readonly statusTone = computed(() => PROVIDER_STATUS[this.state().tone]);

  readonly enabledRegions = computed(() => this.configuration()?.enabledRegions ?? []);

  private readonly regions = computed(() => {
    const fromConfig =
      (this.configuration()?.availableRegions as
        Array<{ id: string; displayName?: string; name?: string }> | undefined) ?? [];
    return fromConfig.length
      ? fromConfig
      : (this.definition().capabilities?.supportedRegions ?? []);
  });

  readonly regionCount = computed(() => this.regions().length);

  readonly regionNames = computed(() =>
    this.regions()
      .map((r) => r.displayName || r.name || r.id)
      .join(', '),
  );

  readonly credentialLabel = computed(() => credentialKindLabel(credentialKind(this.definition())));

  readonly price = computed(() => {
    const pricing = this.definition().capabilities?.pricing;
    if (!pricing?.minimumCost) return null;
    const hourly = pricing.billingCycle === 'hourly';
    return {
      currency: pricing.currency || 'EUR',
      amount: hourly
        ? this.pricingService.calculateMonthlyPrice(pricing.minimumCost)
        : pricing.minimumCost,
      estimated: hourly,
    };
  });

  readonly lastCheckText = computed(() => sinceText(this.configuration()?.lastHealthCheck));

  protected readonly actions = computed<MenuAction[]>(() => {
    const items: MenuAction[] = this.isConfigured()
      ? [{ id: 'manage', label: 'Manage' }]
      : [{ id: 'connect', label: 'Connect' }];
    if (this.definition().documentationUrl) {
      items.push({ id: 'docs', label: 'Open documentation' });
    }
    return items;
  });

  protected onAction(id: string): void {
    const d = this.definition();
    if (id === 'connect') this.configure.emit(d.id);
    if (id === 'manage') void this.router.navigate(['/management/providers', d.id]);
    if (id === 'docs' && d.documentationUrl) {
      window.open(d.documentationUrl, '_blank', 'noopener');
    }
  }
}
