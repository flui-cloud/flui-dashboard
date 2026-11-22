import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideBox, lucideRefreshCw } from '@ng-icons/lucide';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { PodDebugService } from '../../../service/pod-debug.service';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';
import { PodCardComponent } from './pod-card.component';
import { PodDetailComponent } from './pod-detail.component';
import { DiagnosisDetailDialogComponent } from '../crash-diagnoses/diagnosis-detail-dialog.component';
import { CrashDiagnosis } from '../../../model/crash-diagnosis.models';

@Component({
  selector: 'app-pod-debug-tab',
  imports: [
    FlPanel,
    FlTable,
    FlAlert,
    FlButton,
    FlIcon,
    FlEmptyState,
    FlLoadingState,
    PodCardComponent,
    PodDetailComponent,
    DiagnosisDetailDialogComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw, lucideBox })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'fl-stack' },
  template: `
    @if (service.error()) {
      <fl-alert tone="error" [title]="service.error()!" />
    }

    <fl-panel
      title="Pods"
      [count]="service.pods().length > 0 ? service.pods().length : null"
      [flush]="true"
    >
      <ng-container panelActions>
        @if (service.lastFetchedAt()) {
          <span class="text-fl-caption text-fl-ink-muted">
            {{ formatFetched(service.lastFetchedAt()!) }}
          </span>
        }
        <button
          flButton
          size="sm"
          type="button"
          [disabled]="service.loading() || service.isRateLimited()"
          (click)="refresh()"
        >
          <fl-icon name="lucideRefreshCw" [class.animate-spin]="service.loading()" />
          @if (service.isRateLimited()) {
            Retry in {{ service.rateLimitedSecondsLeft() }}s
          } @else {
            Refresh
          }
        </button>
      </ng-container>

      <div panelToolbar class="fl-toolbar">
        <span class="fl-toolbar__info">
          On-demand snapshot of the application pods. No automatic refresh, up to 10 per minute.
        </span>
      </div>

      @if (service.loading() && service.pods().length === 0) {
        <fl-loading-state [rows]="3" />
      } @else if (service.pods().length === 0) {
        <fl-empty-state
          [compact]="true"
          icon="lucideBox"
          title="No pods"
          body="Refresh to load the pod state."
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Pod</th>
                <th scope="col" class="is-fit">Phase</th>
                <th scope="col" class="is-num is-fit">Ready</th>
                <th scope="col" class="is-num is-fit">Restarts</th>
                <th scope="col" class="is-fit">Node</th>
                <th scope="col">Issues</th>
              </tr>
            </thead>
            <tbody>
              @for (pod of service.pods(); track pod.uid) {
                <tr
                  app-pod-card
                  [pod]="pod"
                  [expanded]="expandedPod() === pod.name"
                  (toggled)="togglePod($event)"
                ></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    <app-diagnosis-detail-dialog
      [diagnosis]="diagnosesService.selected()"
      [applicationId]="appId()"
      (closed)="diagnosesService.select(null)"
      (dismiss)="onDismissDiagnosis($event)"
      (apply)="onApplyDiagnosis($event)"
      [applying]="diagnosesService.applyingId() === diagnosesService.selected()?.id"
      [applyError]="diagnosesService.applyError()"
    />

    @if (expanded(); as pod) {
      <app-pod-detail [pod]="pod" (openDiagnosis)="openDiagnosis($event)" />
    }
  `,
})
export class AppPodDebugTabComponent implements OnInit {
  service = inject(PodDebugService);
  diagnosesService = inject(CrashDiagnosesService);
  private readonly route = inject(ActivatedRoute);

  readonly appId = signal<string | null>(null);
  expandedPod = signal<string | null>(null);

  protected readonly expanded = computed(() => {
    const name = this.expandedPod();
    return name ? (this.service.pods().find((p) => p.name === name) ?? null) : null;
  });

  ngOnInit(): void {
    void (async () => {
      this.appId.set(this.route.parent?.snapshot.paramMap.get('id') ?? null);
      const appId = this.appId();
      if (appId) {
        await this.service.loadAll(appId);
      }
    })();
  }

  async refresh() {
    const appId = this.appId();
    if (!appId) return;
    await this.service.loadAll(appId);
  }

  togglePod(name: string) {
    this.expandedPod.update((cur) => (cur === name ? null : name));
  }

  async openDiagnosis(diagnosisId: string) {
    const appId = this.appId();
    if (!appId) return;
    await this.diagnosesService.loadOne(appId, diagnosisId);
  }

  async onDismissDiagnosis(d: CrashDiagnosis) {
    const appId = this.appId();
    if (!appId) return;
    await this.diagnosesService.dismiss(appId, d.id);
  }

  async onApplyDiagnosis(d: CrashDiagnosis) {
    const appId = this.appId();
    if (!appId) return;
    if (await this.diagnosesService.apply(appId, d.id)) {
      await this.service.loadAll(appId);
    }
  }

  formatFetched(ms: number): string {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 5) return 'Updated just now';
    if (diff < 60) return `Updated ${diff}s ago`;
    const m = Math.floor(diff / 60);
    return `Updated ${m}m ago`;
  }
}
