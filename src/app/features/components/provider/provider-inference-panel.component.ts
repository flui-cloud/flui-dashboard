import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCpu, lucideCheck, lucideCircleX, lucideLoader } from '@ng-icons/lucide';
import { InferenceSettingsService } from '../../service/inference-settings.service';

@Component({
  selector: 'provider-inference-panel',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideCpu, lucideCheck, lucideCircleX, lucideLoader })],
  template: `
    @if (info(); as p) {
      <section class="bg-card border border-border rounded-xl overflow-hidden">
        <header class="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
          <ng-icon name="lucideCpu" class="h-4 w-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inference</h2>
          @if (p.euDataResidency) {
            <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">EU</span>
          }
          <button
            type="button"
            (click)="test()"
            [disabled]="testing()"
            class="ml-auto inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ng-icon
              name="lucideLoader"
              [class]="'h-3.5 w-3.5 mr-1 ' + (testing() ? 'animate-spin' : 'hidden')"
            />
            Test inference
          </button>
        </header>
        <div class="p-6 space-y-3">
          <p class="text-sm text-muted-foreground">Uses this provider's credentials — no separate key.</p>
          <p class="font-mono text-xs break-all text-muted-foreground">{{ p.baseUrl }}</p>
          @if (p.models.length) {
            <div class="flex flex-wrap gap-1">
              @for (m of p.models; track m) {
                <code class="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{{ m }}</code>
              }
            </div>
          } @else {
            <p class="text-sm text-muted-foreground">No models reachable yet.</p>
          }
          @if (result(); as r) {
            <div
              class="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
              [class]="r.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'"
            >
              <ng-icon [name]="r.ok ? 'lucideCheck' : 'lucideCircleX'" class="h-4 w-4 shrink-0" />
              {{ r.message }}
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class ProviderInferencePanelComponent implements OnInit {
  @Input({ required: true }) providerId!: string;

  private readonly service = inject(InferenceSettingsService);

  protected readonly testing = signal(false);
  protected readonly result = signal<{ ok: boolean; message: string } | null>(null);

  protected readonly info = computed(() =>
    this.service.providers().find((p) => p.provider === this.providerId) ?? null,
  );

  ngOnInit(): void {
    this.service.loadProviders();
  }

  test(): void {
    this.testing.set(true);
    this.result.set(null);
    this.service.validateProvider(this.providerId as any).subscribe({
      next: (r) => {
        const models = (r.details as any)?.models;
        const msg = Array.isArray(models)
          ? `${models.length} model${models.length === 1 ? '' : 's'} reachable`
          : r.message ?? (r.success ? 'OK' : 'Failed');
        this.testing.set(false);
        this.result.set({ ok: r.success, message: msg });
      },
      error: (e) => {
        this.testing.set(false);
        this.result.set({ ok: false, message: e?.error?.message ?? 'Validation failed' });
      },
    });
  }
}
