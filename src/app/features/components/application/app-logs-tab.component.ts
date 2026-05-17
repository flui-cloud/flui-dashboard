import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ApplicationService } from '../../service/application.service';
import { ApplicationLogsService } from '../../service/application-logs.service';
import { AppLogsViewerComponent } from './app-logs-viewer.component';

/**
 * Shell coordinator for the Logs tab.
 * Owns the lifecycle of ApplicationLogsService query state:
 * - calls init() when the tab mounts (starts the first load)
 * - calls clear() when the tab unmounts (resets state for next visit)
 *
 * All child components (viewer, histogram) inject ApplicationLogsService
 * directly to read data and fire mutations — no @Input/@Output piping needed.
 */
@Component({
  selector: 'app-logs-tab',
  standalone: true,
  imports: [AppLogsViewerComponent],
  template: `<app-logs-viewer />`,
})
export class AppLogsTabComponent implements OnInit, OnDestroy {
  private readonly appService  = inject(ApplicationService);
  private readonly logsService = inject(ApplicationLogsService);

  ngOnInit() {
    const app = this.appService.selectedApplication();
    if (!app) return;
    this.logsService.init({
      clusterId: app.clusterId,
      namespace: app.k8sNamespace,
      app:       app.slug,
    });
  }

  ngOnDestroy() {
    this.logsService.clear();
  }
}
