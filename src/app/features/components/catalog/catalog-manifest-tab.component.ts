import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideDownload } from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

@Component({
  selector: 'app-catalog-manifest-tab',
  imports: [FlAlert, FlKeyValue, FlKvItem, FlPanel, FlLoadingState, FlButton, FlIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy, lucideDownload })],
  host: { class: 'fl-stack' },
  template: `
    @if (catalog.yamlError()) {
      <fl-alert tone="error" title="Could not load the manifest">{{
        catalog.yamlError()
      }}</fl-alert>
    } @else {
      <fl-panel title="Manifest">
        @if (yaml() && !catalog.yamlLoading()) {
          <ng-container panelActions>
            <button flButton size="sm" type="button" (click)="copy()">
              <fl-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" />
              {{ copied() ? 'Copied' : 'Copy' }}
            </button>
            <button flButton size="sm" type="button" (click)="download()">
              <fl-icon name="lucideDownload" />
              Download
            </button>
          </ng-container>
        }
        <div class="flex flex-col gap-4">
          <p class="m-0 max-w-3xl text-fl-body-sm text-fl-ink-secondary">
            The <span class="fl-mono">flui.yaml</span> shipped with this catalog entry, read-only.
            It lists the components to deploy, the settings you can edit, the secrets to generate
            and the endpoints to expose.
          </p>
          @if (catalog.yamlLoading()) {
            <fl-loading-state [rows]="8" />
          } @else if (yaml(); as y) {
            <fl-key-value class="fl-kv--compact">
              <fl-kv-item key="File" [mono]="true">{{ filename() }}</fl-kv-item>
              <fl-kv-item key="Version" [mono]="true">{{ y.version }}</fl-kv-item>
              <fl-kv-item key="Checksum" [mono]="true"
                ><span [title]="'SHA-256: ' + y.checksum">{{ shortChecksum() }}</span></fl-kv-item
              >
            </fl-key-value>
            <pre
              class="fl-mono m-0 max-h-screen overflow-auto rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
            ><code>{{ y.rawYaml }}</code></pre>
          }
        </div>
      </fl-panel>
    }
  `,
})
export class CatalogManifestTabComponent implements OnDestroy {
  protected readonly catalog = inject(CatalogService);

  readonly slug = input.required<string>();

  protected readonly yaml = this.catalog.yaml;
  protected readonly copied = signal(false);

  protected readonly filename = computed(() => {
    const s = this.yaml()?.slug ?? this.slug();
    return `${s}.flui.yaml`;
  });

  protected readonly shortChecksum = computed(() => {
    const c = this.yaml()?.checksum ?? '';
    return c ? c.slice(0, 12) : '';
  });

  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) this.catalog.loadYaml(slug);
    });
  }

  ngOnDestroy(): void {
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.catalog.resetYaml();
  }

  async copy(): Promise<void> {
    const raw = this.yaml()?.rawYaml;
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      this.copied.set(true);
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => this.copied.set(false), 1500);
    } catch {
      return;
    }
  }

  download(): void {
    const data = this.yaml();
    if (!data) return;
    const blob = new Blob([data.rawYaml], { type: 'application/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
