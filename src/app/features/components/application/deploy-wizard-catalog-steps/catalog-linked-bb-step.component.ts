import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideDatabase,
  lucideLoader,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogReusableInstanceDto } from '../../../../core/api/model/catalogReusableInstanceDto';

@Component({
  selector: 'app-catalog-linked-bb-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCircleAlert,
      lucideCircleCheck,
      lucideDatabase,
      lucideLoader,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="space-y-5">
      <div>
        <h3 class="text-base font-semibold">
          Pick target {{ bbLabel() }}
          <span class="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        </h3>
        <p class="text-sm text-muted-foreground">
          @if (bbRefs().length > 1) {
            This client supports multiple building blocks
            (<span class="font-mono">{{ slugList() }}</span>). Pick a running instance of any of
            them to auto-connect after install. Credentials are wired automatically.
          } @else {
            Pick a running <span class="font-mono">{{ bbLabel() }}</span> to auto-connect this
            client after install. Credentials are wired automatically — you won't be asked for a
            password. You can also skip this and Connect later from the app page.
          }
        </p>
      </div>

      @if (bbRefs().length > 1 && !state.reusableInstancesLoading() && allInstances().length > 0) {
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" (click)="setSlugFilter(null)" [class]="slugChipClass(slugFilter() === null)">
            All
          </button>
          @for (s of bbRefs(); track s) {
            <button type="button" (click)="setSlugFilter(s)" [class]="slugChipClass(slugFilter() === s)">
              {{ s }}
            </button>
          }
        </div>
      }

      @if (state.reusableInstancesLoading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Looking for running {{ bbLabel() }} instances…
        </div>
      } @else if (state.reusableInstancesError()) {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 mt-0.5" />
          <div>{{ state.reusableInstancesError() }}</div>
        </div>
      } @else if (instances().length === 0) {
        <div
          class="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4"
        >
          <ng-icon
            name="lucideTriangleAlert"
            class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div class="flex-1 text-sm">
            <p class="font-medium text-amber-800 dark:text-amber-200">
              No running {{ bbLabel() }} found on this cluster
            </p>
            <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
              @if (bbRefs().length > 1) {
                Install one of {{ slugList() }} first, then come back to this wizard to link it.
              } @else {
                Install a {{ bbLabel() }} building block first, then come back to this
                wizard to link it.
              }
            </p>
          </div>
        </div>
      } @else {
        <ul class="space-y-2">
          @for (instance of instances(); track instance.catalogInstallId || instance.applicationId) {
            <li>
              <button
                type="button"
                (click)="select(instance)"
                [disabled]="!instance.catalogInstallId"
                [class]="cardClass(isSelected(instance), !instance.catalogInstallId)"
              >
                <div class="flex items-start gap-3">
                  <ng-icon name="lucideDatabase" class="h-5 w-5 text-primary mt-0.5" />
                  <div class="min-w-0 flex-1 text-left">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-semibold text-foreground">
                        {{ instance.displayName }}
                      </span>
                      <span [class]="statusBadgeClass(instance.status)">
                        {{ instance.status }}
                      </span>
                      @if (bbRefs().length > 1 && instance.catalogSlug) {
                        <span class="rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                          {{ instance.catalogSlug }}
                        </span>
                      }
                    </div>
                    <div class="mt-0.5 text-xs text-muted-foreground">
                      {{ instance.applicationName }}
                    </div>
                    @if (!instance.catalogInstallId) {
                      <div class="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        This instance was not created via catalog install — it can't
                        be linked.
                      </div>
                    }
                  </div>
                  @if (isSelected(instance)) {
                    <ng-icon name="lucideCircleCheck" class="h-5 w-5 text-primary" />
                  }
                </div>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class CatalogLinkedBbStepComponent {
  protected readonly state = inject(DeployWizardStateService);

  protected readonly bbRefs = computed(() => this.state.linkedBbRefs());
  protected readonly bbLabel = computed(() =>
    this.bbRefs().length === 1 ? this.bbRefs()[0] : 'building block',
  );
  protected readonly slugList = computed(() => this.bbRefs().join(' · '));
  protected readonly slugFilter = signal<string | null>(null);

  protected readonly allInstances = computed(() => this.state.reusableInstances());
  protected readonly instances = computed(() => {
    const filter = this.slugFilter();
    const all = this.allInstances();
    return filter ? all.filter((i) => i.catalogSlug === filter) : all;
  });

  protected isSelected(instance: CatalogReusableInstanceDto): boolean {
    return !!instance.catalogInstallId && this.state.pendingLinkedInstallId() === instance.catalogInstallId;
  }

  protected select(instance: CatalogReusableInstanceDto): void {
    if (!instance.catalogInstallId) return;
    this.state.pendingLinkedInstallId.set(instance.catalogInstallId);
  }

  protected setSlugFilter(slug: string | null): void {
    this.slugFilter.set(slug);
  }

  protected slugChipClass(active: boolean): string {
    const base = 'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition';
    return active
      ? `${base} border-primary bg-primary text-primary-foreground`
      : `${base} border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground`;
  }

  protected cardClass(selected: boolean, disabled: boolean): string {
    const base =
      'flex w-full items-start rounded-lg border p-4 text-left transition';
    if (disabled) return `${base} border-border bg-muted/20 opacity-60 cursor-not-allowed`;
    return selected
      ? `${base} border-primary bg-primary/5`
      : `${base} border-border hover:bg-accent/40`;
  }

  protected statusBadgeClass(status: CatalogReusableInstanceDto.StatusEnum): string {
    const base =
      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize';
    switch (status) {
      case CatalogReusableInstanceDto.StatusEnum.Running:
        return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
      case CatalogReusableInstanceDto.StatusEnum.Degraded:
        return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`;
      case CatalogReusableInstanceDto.StatusEnum.Failed:
        return `${base} bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400`;
      default:
        return `${base} bg-muted text-muted-foreground`;
    }
  }
}
