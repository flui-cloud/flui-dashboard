import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideAlertCircle } from '@ng-icons/lucide';
import { ApplicationService } from '../../service/application.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppResourcesEditorComponent } from './app-resources-editor.component';
import { UpdateResourcesDto } from '../../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../../core/api/model/updateReplicasDto';

@Component({
  selector: 'app-resources-tab',
  standalone: true,
  imports: [CommonModule, NgIconComponent, AppResourcesEditorComponent],
  providers: [
    provideIcons({ lucideLoader, lucideAlertCircle }),
  ],
  template: `
    @if (app(); as app) {
      <div class="space-y-4">

        @if (runtimeService.loading()) {
          <div class="flex items-center gap-2 py-4">
            <ng-icon name="lucideLoader" class="h-5 w-5 animate-spin text-blue-600" />
            <span class="text-sm text-gray-600 dark:text-gray-400">Loading runtime status...</span>
          </div>
        }

        @if (runtimeService.error()) {
          <div class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <ng-icon name="lucideAlertCircle" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{{ runtimeService.error() }}</span>
          </div>
        }

        <app-resources-editor
          [runtime]="runtimeService.runtime()"
          [savingReplicas]="runtimeService.savingReplicas()"
          [savingResources]="runtimeService.savingResources()"
          [savingRestart]="runtimeService.savingRestart()"
          [maxCpuMc]="runtimeService.maxCpuMc()"
          [maxMemMib]="runtimeService.maxMemMib()"
          [rollout]="runtimeService.rollout()"
          (saveResourcesEvent)="onSaveResources($event)"
          (saveReplicasEvent)="onSaveReplicas($event)"
          (restartEvent)="onRestart()"
          (refreshEvent)="onRefresh()"
        />

      </div>
    }
  `,
})
export class AppResourcesTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  protected runtimeService = inject(AppRuntimeService);

  readonly app = this.appService.selectedApplication;

  ngOnInit(): void {
    void (async () => {
      const app = this.app();
      if (app?.id) {
        await this.runtimeService.loadRuntime(app.id);
      }
      if (app?.clusterId) {
        void this.runtimeService.loadClusterCapacity(app.clusterId);
      }
    })();
  }

  ngOnDestroy(): void {
    this.runtimeService.clearRuntime();
  }

  protected async onSaveResources(dto: UpdateResourcesDto): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.runtimeService.updateResources(app.id, dto);
    }
  }

  protected async onSaveReplicas(dto: UpdateReplicasDto): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.runtimeService.updateReplicas(app.id, dto);
    }
  }

  protected async onRestart(): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.runtimeService.restart(app.id);
    }
  }

  protected async onRefresh(): Promise<void> {
    const app = this.app();
    if (app?.id) {
      await this.runtimeService.loadRuntime(app.id);
    }
  }
}
