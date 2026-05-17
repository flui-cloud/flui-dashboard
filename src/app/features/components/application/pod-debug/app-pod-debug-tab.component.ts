import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideCircleAlert,
  lucideBug,
  lucideClock,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { PodDebugService } from '../../../service/pod-debug.service';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';
import { PodCardComponent } from './pod-card.component';
import { PodDetailComponent } from './pod-detail.component';
import { DiagnosisDetailDialogComponent } from '../crash-diagnoses/diagnosis-detail-dialog.component';
import { CrashDiagnosis } from '../../../model/crash-diagnosis.models';

@Component({
  selector: 'app-pod-debug-tab',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    HlmButtonDirective,
    PodCardComponent,
    PodDetailComponent,
    DiagnosisDetailDialogComponent,
  ],
  providers: [
    provideIcons({ lucideRefreshCw, lucideCircleAlert, lucideBug, lucideClock }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="space-y-1">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ng-icon name="lucideBug" class="h-4 w-4" />
            Debug pods
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
            On-demand snapshot of the application pods.
            Rate limit: 10 req/min. No automatic polling.
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (service.lastFetchedAt()) {
            <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <ng-icon name="lucideClock" class="h-3.5 w-3.5" />
              {{ formatFetched(service.lastFetchedAt()!) }}
            </span>
          }
          <button
            hlmBtn
            size="sm"
            variant="outline"
            (click)="refresh()"
            [disabled]="service.loading() || service.isRateLimited()"
          >
            <ng-icon
              name="lucideRefreshCw"
              class="h-3.5 w-3.5 mr-2"
              [class.animate-spin]="service.loading()"
            />
            @if (service.isRateLimited()) {
              Retry in {{ service.rateLimitedSecondsLeft() }}s
            } @else {
              Refresh
            }
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

      <!-- Pods -->
      @if (service.loading() && service.pods().length === 0) {
        <div class="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
          Loading pods…
        </div>
      } @else if (service.pods().length === 0) {
        <div class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <ng-icon name="lucideBug" class="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No pod debug info</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Press refresh to load the pod state.
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (pod of service.pods(); track pod.uid) {
            <div>
              <app-pod-card
                [pod]="pod"
                [expanded]="expandedPod() === pod.name"
                (toggled)="togglePod($event)"
              />
              @if (expandedPod() === pod.name) {
                <app-pod-detail [pod]="pod" (openDiagnosis)="openDiagnosis($event)" />
              }
            </div>
          }
        </div>
      }
    </div>

    <app-diagnosis-detail-dialog
      [diagnosis]="diagnosesService.selected()"
      [applicationId]="appId"
      (closed)="diagnosesService.select(null)"
      (dismiss)="onDismissDiagnosis($event)"
    />
  `,
})
export class AppPodDebugTabComponent implements OnInit {
  service = inject(PodDebugService);
  diagnosesService = inject(CrashDiagnosesService);
  private readonly route = inject(ActivatedRoute);

  appId: string | null = null;
  expandedPod = signal<string | null>(null);

  ngOnInit(): void {
    void (async () => {
      this.appId = this.route.parent?.snapshot.paramMap.get('id') ?? null;
      if (this.appId) {
        await this.service.loadAll(this.appId);
      }
    })();
  }

  async refresh() {
    if (!this.appId) return;
    await this.service.loadAll(this.appId);
  }

  togglePod(name: string) {
    this.expandedPod.update(cur => (cur === name ? null : name));
  }

  async openDiagnosis(diagnosisId: string) {
    if (!this.appId) return;
    await this.diagnosesService.loadOne(this.appId, diagnosisId);
  }

  async onDismissDiagnosis(d: CrashDiagnosis) {
    if (!this.appId) return;
    await this.diagnosesService.dismiss(this.appId, d.id);
  }

  formatFetched(ms: number): string {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 5) return 'updated just now';
    if (diff < 60) return `updated ${diff}s ago`;
    const m = Math.floor(diff / 60);
    return `updated ${m}m ago`;
  }
}
