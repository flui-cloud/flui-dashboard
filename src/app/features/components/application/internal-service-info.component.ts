import { Component, computed, input } from '@angular/core';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';

export type InternalServiceMode = 'building-block' | 'internal-app';

@Component({
  selector: 'app-internal-service-info',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlCopyId],
  template: `
    <fl-panel title="Internal access">
      <div class="flex flex-col gap-4">
        <p class="text-fl-body-sm text-fl-ink-muted">{{ description() }}</p>
        <fl-key-value>
          <fl-kv-item key="Host">
            <fl-copy-id [value]="host()" label="host" />
          </fl-kv-item>
          @if (port()) {
            <fl-kv-item key="Port" [mono]="true">{{ port() }}</fl-kv-item>
          }
          <fl-kv-item key="Namespace" [mono]="true">{{ namespace() }}</fl-kv-item>
          <fl-kv-item key="Protocol" [mono]="true">TCP</fl-kv-item>
          <fl-kv-item key="Access">{{ access() }}</fl-kv-item>
        </fl-key-value>
      </div>
    </fl-panel>
  `,
})
export class InternalServiceInfoComponent {
  readonly applicationSlug = input.required<string>();
  readonly namespace = input.required<string>();
  readonly port = input<number | undefined>(undefined);
  readonly mode = input<InternalServiceMode>('building-block');

  readonly host = computed(
    () => `${this.applicationSlug()}-svc.${this.namespace()}.svc.cluster.local`,
  );

  protected readonly access = computed(() =>
    this.mode() === 'internal-app' ? 'Flui login required' : 'Same cluster only',
  );

  protected readonly description = computed(() =>
    this.mode() === 'internal-app'
      ? "Gets a private URL on your cluster's internal domain. It is reachable from the internet, and opening it requires a Flui login."
      : 'Reachable only from other apps on the same cluster. Credentials stay inside the cluster; Flui never exposes them through the API.',
  );
}
