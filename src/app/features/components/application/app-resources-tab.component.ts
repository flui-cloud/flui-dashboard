import { Component, OnInit, OnDestroy, computed, inject } from '@angular/core';

import { ApplicationService } from '../../service/application.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppResourcesEditorComponent } from './app-resources-editor.component';
import { AppResourceProposalComponent } from './app-resource-proposal.component';
import { AppMaintenanceCardComponent } from '../maintenance/app-maintenance-card.component';
import { AppAutoscalingCardComponent } from './app-autoscaling-card.component';
import { AppEgressNoteComponent } from '../egress/app-egress-note.component';
import { UpdateResourcesDto } from '../../../core/api/model/updateResourcesDto';
import { UpdateReplicasDto } from '../../../core/api/model/updateReplicasDto';
import { accessOf } from '../../model/app-access';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlSpinner } from '../../../ui/primitives/spinner';

@Component({
  selector: 'app-resources-tab',
  standalone: true,
  imports: [
    AppResourcesEditorComponent,
    AppResourceProposalComponent,
    AppMaintenanceCardComponent,
    AppAutoscalingCardComponent,
    AppEgressNoteComponent,
    FlAlert,
    FlSpinner,
  ],
  host: { class: 'fl-stack', '[class.look-only]': 'readOnly()' },
  template: `
    @if (app(); as app) {
      @if (runtimeService.loading()) {
        <div class="flex items-center gap-2 text-fl-body-sm text-fl-ink-muted">
          <fl-spinner label="Loading runtime status" />
          Loading runtime status
        </div>
      }

      @if (runtimeService.error(); as error) {
        <fl-alert tone="error" title="Runtime status request failed">{{ error }}</fl-alert>
      }

      @if (!readOnly()) {
        <app-resource-proposal [appId]="app.id ?? null" (deferred)="maintenanceCard.reload()" />
        <app-app-maintenance-card #maintenanceCard [appId]="app.id ?? null" />
      }

      <app-resources-editor
        [runtime]="runtimeService.runtime()"
        [savingReplicas]="runtimeService.savingReplicas()"
        [savingResources]="runtimeService.savingResources()"
        [savingRestart]="runtimeService.savingRestart()"
        [appId]="app.id ?? null"
        [clusterId]="app.clusterId ?? null"
        [advice]="!readOnly()"
        [rollout]="runtimeService.rollout()"
        (saveResourcesEvent)="onSaveResources($event)"
        (saveReplicasEvent)="onSaveReplicas($event)"
        (restartEvent)="onRestart()"
        (refreshEvent)="onRefresh()"
      />

      @if (!readOnly()) {
        <app-autoscaling-card [appId]="app.id ?? null" />
        <app-egress-note [appId]="app.id ?? null" />
      }
    }
  `,
})
export class AppResourcesTabComponent implements OnInit, OnDestroy {
  private readonly appService = inject(ApplicationService);
  protected runtimeService = inject(AppRuntimeService);

  readonly app = this.appService.selectedApplication;
  protected readonly readOnly = computed(() => accessOf(this.app())?.readOnly === true);

  ngOnInit(): void {
    void (async () => {
      const app = this.app();
      if (app?.id) {
        await this.runtimeService.loadRuntime(app.id);
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
