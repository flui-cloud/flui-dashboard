import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideCopy,
  lucideDownload,
  lucideFileCode,
} from '@ng-icons/lucide';
import { CatalogService } from '../../service/catalog.service';

@Component({
  selector: 'app-catalog-manifest-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({ lucideCheck, lucideCircleAlert, lucideCopy, lucideDownload, lucideFileCode }),
  ],
  template: `
    <div class="space-y-5">
      <!-- Explainer -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <ng-icon name="lucideFileCode" class="h-5 w-5" />
          </div>
          <div class="space-y-2 text-sm text-muted-foreground">
            <p class="font-medium text-foreground">What is a flui manifest?</p>
            <p>
              Every catalog app is described by a single
              <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">flui.yaml</code>
              manifest — a declarative blueprint that lists the components to deploy, the
              configuration the user can edit, the secrets to generate and the endpoints to
              expose. The dashboard reads it to render the install wizard; the cluster reads
              it to provision the resources.
            </p>
            <p>
              The manifest below is the exact file shipped with this catalog entry, byte for
              byte. It's read-only here — useful to inspect what will be deployed, copy it
              into a custom workflow, or fork it into your own version.
            </p>
          </div>
        </div>
      </div>

      @if (catalog.yamlLoading()) {
        <div class="h-72 animate-pulse rounded-xl border border-border bg-muted/30"></div>
      } @else if (catalog.yamlError()) {
        <div
          class="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4" />
          {{ catalog.yamlError() }}
        </div>
      } @else if (yaml()) {
        <!-- Header: version + checksum + actions -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-b-0 border-border bg-muted/30 px-4 py-2.5"
        >
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-mono text-foreground">{{ filename() }}</span>
            <span class="text-muted-foreground">·</span>
            <span class="text-muted-foreground">v{{ yaml()!.version }}</span>
            <span class="text-muted-foreground">·</span>
            <span
              class="font-mono text-muted-foreground"
              [title]="'SHA-256: ' + yaml()!.checksum"
            >
              {{ shortChecksum() }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              (click)="copy()"
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <ng-icon
                [name]="copied() ? 'lucideCheck' : 'lucideCopy'"
                class="h-3.5 w-3.5"
                [class.text-emerald-600]="copied()"
              />
              {{ copied() ? 'Copied' : 'Copy' }}
            </button>
            <button
              type="button"
              (click)="download()"
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <ng-icon name="lucideDownload" class="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>

        <pre
          class="-mt-5 max-h-[600px] overflow-auto rounded-b-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground"
        ><code>{{ yaml()!.rawYaml }}</code></pre>
      }
    </div>
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
      // clipboard API unavailable — silently ignore
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
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
