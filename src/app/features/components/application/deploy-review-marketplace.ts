import { Component, computed, input, output } from '@angular/core';
import { CatalogDetailResponseDto } from '../../../core/api/model/catalogDetailResponseDto';
import { CatalogReusableInstanceDto } from '../../../core/api/model/catalogReusableInstanceDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { DeployReviewGroup } from './deploy-review-group';

export type ReviewDomainMode = 'auto' | 'custom' | 'skip';

@Component({
  selector: 'app-deploy-review-marketplace',
  imports: [FlAlert, FlKeyValue, FlKvItem, DeployReviewGroup],
  host: { class: 'fl-stack' },
  template: `
    <app-deploy-review-group
      title="Marketplace install"
      step="catalog-overview"
      [editable]="editable()"
      (edit)="edit.emit($event)"
    >
      <fl-key-value class="fl-kv--compact">
        <fl-kv-item key="App">{{ detail()?.name }} v{{ detail()?.version }}</fl-kv-item>
        <fl-kv-item key="Display name">{{ displayName() }}</fl-kv-item>
        <fl-kv-item key="Category">{{ category() }}</fl-kv-item>
        @if (authLabel(); as auth) {
          <fl-kv-item key="Authentication">{{ auth }}</fl-kv-item>
        }
        @if (showFeatures()) {
          <fl-kv-item key="Features">{{
            featureLabels().length > 0 ? featureLabels().join(', ') : 'None'
          }}</fl-kv-item>
        }
        @if (linkedRefs().length > 0) {
          @if (linkedInstance(); as sel) {
            <fl-kv-item key="Linked to"
              ><span class="fl-mono">{{ sel.catalogSlug || sel.displayName }}</span
              >: <span class="fl-mono">{{ sel.displayName }}</span>
              <span class="fl-muted">({{ sel.status }})</span></fl-kv-item
            >
          } @else {
            <fl-kv-item key="Compatible with">{{ linkedRefs().join(', ') }}</fl-kv-item>
          }
        }
      </fl-key-value>
      @if (linkedRefs().length > 0) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Credentials come from the building block's internal secret. No password is needed.
        </p>
      }
    </app-deploy-review-group>

    <app-deploy-review-group
      title="Access"
      step="catalog-domain"
      [editable]="editable()"
      (edit)="edit.emit($event)"
    >
      <fl-key-value class="fl-kv--compact">
        @if (internalDeploy()) {
          <fl-kv-item key="Exposure">Internal, behind Flui sign-in</fl-kv-item>
          @if (internalUrl(); as url) {
            <fl-kv-item key="Internal URL" [mono]="true">{{ url }}</fl-kv-item>
          }
        } @else if (detail()?.exposesPublicEndpoint === false) {
          <fl-kv-item key="Exposure">Cluster internal, no public URL</fl-kv-item>
        } @else {
          <fl-kv-item key="Domain" [mono]="domainMode() !== 'skip'">{{ domain() }}</fl-kv-item>
          @if (domainMode() !== 'skip') {
            <fl-kv-item key="TLS">{{
              tls() ? 'HTTPS certificate' : 'HTTP only, no certificate'
            }}</fl-kv-item>
          }
        }
      </fl-key-value>
      @if (!internalDeploy() && detail()?.exposesPublicEndpoint === false) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Other apps in the same cluster reach it through its internal service DNS.
        </p>
      }
    </app-deploy-review-group>

    @if (masterRelevant()) {
      <fl-alert tone="warning" title="This cluster has no worker node">
        <span class="block">
          {{ detail()?.name }} uses dedicated node-local storage, which normally runs on a worker
          node. Let it run on the control-plane node, or add a worker with
          <span class="fl-mono">flui node add</span> and come back.
        </span>
        @if (!masterAllowed()) {
          <span class="mt-1 block">
            Required to continue: without a worker node the install would fail. Leave it off only if
            you plan to add a worker first.
          </span>
        }
        <label alertActions class="fl-check">
          <input
            type="checkbox"
            [checked]="masterAllowed()"
            (change)="masterAllowedChange.emit($any($event.target).checked)"
          />
          Run on the control-plane node
        </label>
      </fl-alert>
    }
  `,
})
export class DeployReviewMarketplace {
  readonly detail = input<CatalogDetailResponseDto | null>(null);
  readonly displayName = input('');
  readonly authLabel = input<string | null>(null);
  readonly showFeatures = input(false);
  readonly featureLabels = input<readonly string[]>([]);
  readonly linkedRefs = input<readonly string[]>([]);
  readonly linkedInstance = input<CatalogReusableInstanceDto | null>(null);
  readonly internalDeploy = input(false);
  readonly internalUrl = input<string | null>(null);
  readonly domainMode = input<ReviewDomainMode>('auto');
  readonly autoFqdn = input('');
  readonly requestedDomain = input('');
  readonly tls = input(true);
  readonly masterRelevant = input(false);
  readonly masterAllowed = input(false);
  readonly editable = input<readonly string[]>([]);
  readonly edit = output<string>();
  readonly masterAllowedChange = output<boolean>();

  protected readonly category = computed(() => {
    const c = this.detail()?.category ?? '';
    return c.charAt(0).toUpperCase() + c.slice(1);
  });

  protected readonly domain = computed(() => {
    switch (this.domainMode()) {
      case 'auto':
        return `Auto-assigned (${this.autoFqdn()})`;
      case 'custom':
        return this.requestedDomain();
      default:
        return 'Configure after install';
    }
  });
}
