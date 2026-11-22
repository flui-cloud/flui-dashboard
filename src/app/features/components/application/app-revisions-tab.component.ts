import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { AppRevisionsService, AuditEventType } from '../../service/app-revisions.service';
import { AppAuditEventSummaryDto } from '../../../core/api/model/appAuditEventSummaryDto';
import { AppActivityFeedComponent } from './app-activity-feed.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { ConfirmService } from '../../../ui/overlays/confirm';

@Component({
  selector: 'app-revisions-tab',
  standalone: true,
  imports: [AppActivityFeedComponent, FlAlert],
  host: { class: 'fl-stack' },
  template: `
    @if (service.rollbackError()) {
      <fl-alert tone="error" title="Rollback failed">{{ service.rollbackError() }}</fl-alert>
    }
    <app-activity-feed
      [activeFilter]="activeEventFilter()"
      (filterChange)="onFilterChange($event)"
      (loadMore)="loadMoreEvents()"
      (rollback)="doRollback($event)"
    />
  `,
})
export class AppRevisionsTabComponent implements OnInit, OnDestroy {
  service = inject(AppRevisionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmService = inject(ConfirmService);

  activeEventFilter = signal<AuditEventType | undefined>(undefined);

  private appId: string | null = null;
  private eventsOffset = 0;
  private readonly PAGE_SIZE = 50;

  ngOnInit(): void {
    void (async () => {
      this.appId = this.route.parent?.snapshot.paramMap.get('id') ?? null;
      if (this.appId) {
        await this.service.loadEvents(this.appId, undefined, this.PAGE_SIZE, 0);
      }
    })();
  }

  ngOnDestroy() {
    this.service.clearAll();
  }

  async onFilterChange(type: AuditEventType | undefined) {
    this.activeEventFilter.set(type);
    this.eventsOffset = 0;
    if (this.appId) {
      await this.service.loadEvents(this.appId, type, this.PAGE_SIZE, 0);
    }
  }

  async loadMoreEvents() {
    if (!this.appId) return;
    this.eventsOffset += this.PAGE_SIZE;
    await this.service.loadEvents(
      this.appId,
      this.activeEventFilter(),
      this.PAGE_SIZE,
      this.eventsOffset,
    );
  }

  async doRollback(event: AppAuditEventSummaryDto) {
    if (!this.appId || event.revisionNumber == null) return;
    const confirmed = await this.confirmService.confirm({
      title: `Roll back to revision #${event.revisionNumber}`,
      body: 'The application is redeployed with what ran at this revision.',
      confirmLabel: 'Roll back',
      destructive: true,
    });
    if (!confirmed) return;
    await this.service.rollback(this.appId, event.revisionNumber);
    if (!this.service.rollbackError()) {
      this.eventsOffset = 0;
      await this.service.loadEvents(this.appId, this.activeEventFilter(), this.PAGE_SIZE, 0);
    }
  }
}
