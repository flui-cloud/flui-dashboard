import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideShieldAlert,
  lucideRefreshCw,
  lucideFilter,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';
import { ApplicationService } from '../../../service/application.service';
import {
  CrashCategory,
  CrashDiagnosis,
  CrashSeverity,
  categoryLabel,
  isAutoRemediated,
} from '../../../model/crash-diagnosis.models';
import { DiagnosisRowComponent } from './diagnosis-row.component';
import { DiagnosisDetailDialogComponent } from './diagnosis-detail-dialog.component';

const ALL_CATEGORIES: CrashCategory[] = [
  'oom_killed',
  'crash_loop',
  'config_error',
  'image_pull_error',
  'probe_failure',
  'unschedulable',
  'unknown',
];

const ALL_SEVERITIES: CrashSeverity[] = ['critical', 'warning', 'info'];

@Component({
  selector: 'app-diagnoses-tab',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    HlmButtonDirective,
    DiagnosisRowComponent,
    DiagnosisDetailDialogComponent,
  ],
  providers: [
    provideIcons({ lucideCircleAlert, lucideShieldAlert, lucideRefreshCw, lucideFilter }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Filters -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
            <ng-icon name="lucideFilter" class="h-3.5 w-3.5 inline mr-1" />
            Severity:
          </span>
          <button
            type="button"
            class="text-xs px-2 py-0.5 rounded border"
            [ngClass]="severityFilter() === null
              ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
              : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'"
            (click)="severityFilter.set(null)"
          >
            All
          </button>
          @for (s of severities; track s) {
            <button
              type="button"
              class="text-xs px-2 py-0.5 rounded border capitalize"
              [ngClass]="severityFilter() === s
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
                : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'"
              (click)="severityFilter.set(s)"
            >
              {{ s }}
            </button>
          }
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Category:</span>
          <select
            class="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            [value]="categoryFilter() ?? ''"
            (change)="onCategoryChange($event)"
          >
            <option value="">All</option>
            @for (c of categories; track c) {
              <option [value]="c">{{ categoryLabel(c) }}</option>
            }
          </select>
          <button
            hlmBtn
            size="sm"
            variant="outline"
            (click)="refresh()"
            [disabled]="service.loading()"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5 mr-2"
              [class.animate-spin]="service.loading()"
            />
            Refresh
          </button>
        </div>
      </div>

      <!-- Error -->
      @if (service.error()) {
        <div class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <ng-icon name="lucideCircleAlert" class="h-4 w-4 shrink-0" />
          {{ service.error() }}
        </div>
      }

      <!-- List -->
      @if (service.loading() && filtered().length === 0) {
        <div class="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
          Loading diagnoses…
        </div>
      } @else if (filtered().length === 0) {
        <div class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <ng-icon name="lucideShieldAlert" class="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No diagnoses</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            All clear — no crashes detected for the current filters.
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (d of filtered(); track d.id) {
            <app-diagnosis-row [diagnosis]="d" (clicked)="openDetail($event)" />
          }
        </div>
        @if (canLoadMore()) {
          <div class="flex justify-center pt-2">
            <button hlmBtn variant="outline" size="sm" (click)="loadMore()" [disabled]="service.loading()">
              Load more
            </button>
          </div>
        }
      }
    </div>

    <app-diagnosis-detail-dialog
      [diagnosis]="selected()"
      [applicationId]="appId"
      [redeployInProgress]="redeployInProgress()"
      (closed)="closeDetail()"
      (dismiss)="onDismiss($event)"
    />
  `,
})
export class AppDiagnosesTabComponent implements OnInit {
  service = inject(CrashDiagnosesService);
  private readonly route = inject(ActivatedRoute);
  private readonly appService = inject(ApplicationService);

  readonly categories = ALL_CATEGORIES;
  readonly severities = ALL_SEVERITIES;

  appId: string | null = null;
  private readonly offset = signal(0);
  private readonly PAGE_SIZE = 50;
  private readonly lastPageSize = signal(0);

  severityFilter = signal<CrashSeverity | null>(null);
  categoryFilter = signal<CrashCategory | null>(null);

  readonly selected = this.service.selected;

  readonly redeployInProgress = computed(() => {
    const sel = this.selected();
    if (!sel || !isAutoRemediated(sel)) return false;
    const status = this.appService.selectedApplication()?.status;
    return status === 'updating' || status === 'provisioning';
  });

  readonly filtered = computed(() => {
    const sev = this.severityFilter();
    const cat = this.categoryFilter();
    return this.service.diagnoses().filter(d => {
      if (sev && d.severity !== sev) return false;
      if (cat && d.category !== cat) return false;
      return true;
    });
  });

  readonly canLoadMore = computed(() => this.lastPageSize() === this.PAGE_SIZE);

  ngOnInit(): void {
    void (async () => {
      this.appId = this.route.parent?.snapshot.paramMap.get('id') ?? null;
      if (this.appId) {
        await this.refresh();
      }
    })();
  }

  categoryLabel = categoryLabel;

  async refresh() {
    if (!this.appId) return;
    this.offset.set(0);
    const before = this.service.diagnoses().length;
    await this.service.loadList(this.appId, { limit: this.PAGE_SIZE, offset: 0 });
    this.lastPageSize.set(this.service.diagnoses().length);
    // guard: se prima avevo già caricato più pagine, il reset azzera
    if (before > this.service.diagnoses().length) {
      this.offset.set(0);
    }
  }

  async loadMore() {
    if (!this.appId) return;
    const nextOffset = this.service.diagnoses().length;
    this.offset.set(nextOffset);
    const before = this.service.diagnoses().length;
    await this.service.loadList(this.appId, { limit: this.PAGE_SIZE, offset: nextOffset });
    this.lastPageSize.set(this.service.diagnoses().length - before);
  }

  openDetail(d: CrashDiagnosis) {
    this.service.select(d);
  }

  closeDetail() {
    this.service.select(null);
  }

  async onDismiss(d: CrashDiagnosis) {
    if (!this.appId) return;
    await this.service.dismiss(this.appId, d.id);
  }

  onCategoryChange(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value;
    this.categoryFilter.set(value ? (value as CrashCategory) : null);
  }
}
