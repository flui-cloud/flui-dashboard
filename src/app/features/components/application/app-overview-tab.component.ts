import { availabilityOf } from '../../model/application.models';
import {
  Component,
  OnInit,
  inject,
  computed,
  signal,
  effect,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePin, lucideTrash2 } from '@ng-icons/lucide';

import { ApplicationService } from '../../service/application.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRevisionsService } from '../../service/app-revisions.service';
import { DiagnosesBannerComponent } from './crash-diagnoses/diagnoses-banner.component';
import { hasPublicEndpoint, isBuildingBlock } from '../../model/app-exposure';
import { ClientConnectionSectionComponent } from './client-connection-section.component';
import {
  InternalServiceInfoComponent,
  InternalServiceMode,
} from './internal-service-info.component';
import { AppLatestReleaseCardComponent } from './app-latest-release-card.component';
import { AppProjectSectionComponent } from './app-project-section.component';
import { AppDeleteDialogComponent } from './app-delete-dialog.component';
import { AppOverviewStatusStripComponent } from './app-overview-status-strip.component';
import { AppOverviewSummaryComponent } from './app-overview-summary.component';
import { AppRecapActivityComponent } from './app-recap-activity.component';
import { recentEvents } from './app-recap-bundle';

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [
    NgIconComponent,
    ConfirmationDialogComponent,
    DiagnosesBannerComponent,
    ClientConnectionSectionComponent,
    InternalServiceInfoComponent,
    AppLatestReleaseCardComponent,
    AppProjectSectionComponent,
    AppDeleteDialogComponent,
    AppOverviewStatusStripComponent,
    AppOverviewSummaryComponent,
    AppRecapActivityComponent,
  ],
  providers: [provideIcons({ lucidePin, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app-overview-tab.component.html',
})
export class AppOverviewTabComponent implements OnInit {
  private readonly appService = inject(ApplicationService);
  readonly monitoringService = inject(ApplicationMonitoringService);
  readonly variablesService = inject(AppVariablesService);
  readonly endpointsService = inject(AppEndpointsService);
  readonly revisionsService = inject(AppRevisionsService);

  readonly app = this.appService.selectedApplication;
  /**
   * The group this application is removed with. A component of a bundle is
   * never deleted on its own from here: alone, it would leave the rest of
   * the bundle, its database included, running.
   */
  readonly deleteGroup = computed(() => {
    const id = this.app()?.id;
    return id
      ? (this.appService
          .applicationGroups()
          .find((g) => g.components.some((c) => c.id === id)) ?? null)
      : null;
  });

  readonly rollbackAvailable = computed(
    () => availabilityOf(this.app(), 'rollback').state === 'available',
  );

  readonly deleteDialog =
    viewChild.required<ConfirmationDialogComponent>('deleteDialog');

  readonly isDeleting = signal(false);
  readonly deleteStepMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      const progress = this.appService.deleteProgress();
      const appId = this.app()?.id;
      if (progress && progress.appId === appId) {
        this.deleteStepMessage.set(progress.message);
      }
    });
  }

  readonly isPublicApp = computed(() => hasPublicEndpoint(this.app()));

  readonly internalServiceMode = computed<InternalServiceMode>(() =>
    isBuildingBlock(this.app()) ? 'building-block' : 'internal-app',
  );

  readonly recentEvents = computed(() => {
    const app = this.app();
    return app ? recentEvents([app], [this.revisionsService.events()], 3) : [];
  });

  openDeleteDialog(): void {
    this.deleteDialog().open();
  }

  async onDeleteConfirmed(): Promise<void> {
    const id = this.app()?.id;
    if (!id) return;
    this.deleteDialog().setProcessing(true);
    this.isDeleting.set(true);
    try {
      await this.appService.deleteApplication(id);
      this.deleteDialog().close();
    } catch {
      this.deleteDialog().setProcessing(false);
      this.isDeleting.set(false);
    }
  }

  ngOnInit(): void {
    const app = this.app();
    if (!app) return;
    if (!this.appService.applicationGroups().length) {
      void this.appService.loadApplications();
    }
    this.variablesService.loadVariables(app.id);
    if (app.clusterId) {
      this.endpointsService.loadEndpoints(app.clusterId);
    }
    this.revisionsService.loadEvents(app.id, undefined, 3);
  }
}
