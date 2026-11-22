import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';
import {
  CrashCategory,
  CrashDiagnosis,
  CrashSeverity,
  categoryLabel,
} from '../../../model/crash-diagnosis.models';
import { DiagnosisRowComponent } from './diagnosis-row.component';
import { DiagnosisDetailDialogComponent } from './diagnosis-detail-dialog.component';
import { SEVERITY_STATUS, diagnosisCategoryLabel } from './diagnosis-labels';

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
  imports: [
    FlPanel,
    FlTable,
    FlAlert,
    FlButton,
    FlIcon,
    FlEmptyState,
    FlLoadingState,
    DiagnosisRowComponent,
    DiagnosisDetailDialogComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideCircleCheck })],
  host: { class: 'fl-stack' },
  template: `
    @if (service.error()) {
      <fl-alert tone="error" [title]="service.error()!" />
    }

    <fl-panel
      title="Diagnoses"
      [count]="filtered().length > 0 ? filtered().length : null"
      [flush]="true"
    >
      <button
        panelActions
        flButton
        size="sm"
        type="button"
        [disabled]="service.loading()"
        (click)="refresh()"
      >
        <fl-icon name="lucideRefreshCw" [class.animate-spin]="service.loading()" />
        Refresh
      </button>

      <div panelToolbar class="fl-toolbar" role="toolbar" aria-label="Filters">
        <div class="fl-toolbar__group">
          <div class="fl-segmented" role="group" aria-label="Severity">
            <button
              type="button"
              [attr.aria-pressed]="severityFilter() === null"
              (click)="severityFilter.set(null)"
            >
              All
            </button>
            @for (s of severities; track s) {
              <button
                type="button"
                [attr.aria-pressed]="severityFilter() === s"
                (click)="severityFilter.set(s)"
              >
                {{ severityLabel(s) }}
              </button>
            }
          </div>
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-select--sm"
              aria-label="Category"
              [value]="categoryFilter() ?? ''"
              (change)="onCategoryChange($event)"
            >
              <option value="">Category: All</option>
              @for (c of categories; track c) {
                <option [value]="c">{{ diagnosisCategoryLabel(c) }}</option>
              }
            </select>
          </span>
        </div>
      </div>

      @if (service.loading() && filtered().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (filtered().length === 0) {
        <fl-empty-state
          [compact]="true"
          icon="lucideCircleCheck"
          title="No diagnoses"
          body="No crashes detected for the current filters."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit">Severity</th>
                <th scope="col">Diagnosis</th>
                <th scope="col" class="is-fit">Detected</th>
                <th scope="col" class="is-fit">State</th>
              </tr>
            </thead>
            <tbody>
              @for (d of filtered(); track d.id) {
                <tr
                  app-diagnosis-row
                  [diagnosis]="d"
                  [selected]="selected()?.id === d.id"
                  (clicked)="openDetail($event)"
                ></tr>
              }
            </tbody>
          </table>
        </div>
        @if (canLoadMore()) {
          <div class="flex justify-center border-t border-fl-border-subtle p-3">
            <button
              flButton
              size="sm"
              type="button"
              [disabled]="service.loading()"
              (click)="loadMore()"
            >
              Load more
            </button>
          </div>
        }
      }
    </fl-panel>

    <app-diagnosis-detail-dialog
      [diagnosis]="selected()"
      [applicationId]="appId()"
      (closed)="closeDetail()"
      (dismiss)="onDismiss($event)"
      (apply)="onApply($event)"
      [applying]="service.applyingId() === selected()?.id"
      [applyError]="service.applyError()"
    />
  `,
})
export class AppDiagnosesTabComponent implements OnInit {
  service = inject(CrashDiagnosesService);
  private readonly route = inject(ActivatedRoute);

  readonly categories = ALL_CATEGORIES;
  readonly severities = ALL_SEVERITIES;

  readonly appId = signal<string | null>(null);
  private readonly offset = signal(0);
  private readonly PAGE_SIZE = 50;
  private readonly lastPageSize = signal(0);

  severityFilter = signal<CrashSeverity | null>(null);
  categoryFilter = signal<CrashCategory | null>(null);

  readonly selected = this.service.selected;

  readonly filtered = computed(() => {
    const sev = this.severityFilter();
    const cat = this.categoryFilter();
    return this.service.diagnoses().filter((d) => {
      if (sev && d.severity !== sev) return false;
      if (cat && d.category !== cat) return false;
      return true;
    });
  });

  readonly canLoadMore = computed(() => this.lastPageSize() === this.PAGE_SIZE);

  ngOnInit(): void {
    void (async () => {
      this.appId.set(this.route.parent?.snapshot.paramMap.get('id') ?? null);
      if (this.appId()) {
        await this.refresh();
      }
    })();
  }

  categoryLabel = categoryLabel;
  diagnosisCategoryLabel = diagnosisCategoryLabel;

  severityLabel(s: CrashSeverity): string {
    return SEVERITY_STATUS[s].label;
  }

  async refresh() {
    const appId = this.appId();
    if (!appId) return;
    this.offset.set(0);
    const before = this.service.diagnoses().length;
    await this.service.loadList(appId, { limit: this.PAGE_SIZE, offset: 0 });
    this.lastPageSize.set(this.service.diagnoses().length);
    if (before > this.service.diagnoses().length) {
      this.offset.set(0);
    }
  }

  async loadMore() {
    const appId = this.appId();
    if (!appId) return;
    const nextOffset = this.service.diagnoses().length;
    this.offset.set(nextOffset);
    const before = this.service.diagnoses().length;
    await this.service.loadList(appId, { limit: this.PAGE_SIZE, offset: nextOffset });
    this.lastPageSize.set(this.service.diagnoses().length - before);
  }

  openDetail(d: CrashDiagnosis) {
    this.service.select(d);
  }

  closeDetail() {
    this.service.select(null);
  }

  async onDismiss(d: CrashDiagnosis) {
    const appId = this.appId();
    if (!appId) return;
    await this.service.dismiss(appId, d.id);
  }

  async onApply(d: CrashDiagnosis) {
    const appId = this.appId();
    if (!appId) return;
    await this.service.apply(appId, d.id);
  }

  onCategoryChange(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value;
    this.categoryFilter.set(value ? (value as CrashCategory) : null);
  }
}
