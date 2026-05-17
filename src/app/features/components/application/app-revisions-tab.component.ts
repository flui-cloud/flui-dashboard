import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideAlertCircle } from '@ng-icons/lucide';
import { AppRevisionsService, AuditEventType } from '../../service/app-revisions.service';
import { AppAuditEventSummaryDto } from '../../../core/api/model/appAuditEventSummaryDto';
import { AppActivityFeedComponent } from './app-activity-feed.component';

@Component({
  selector: 'app-revisions-tab',
  standalone: true,
  imports: [CommonModule, NgIconComponent, AppActivityFeedComponent],
  providers: [provideIcons({ lucideAlertCircle })],
  template: `
    <div class="space-y-3">
      @if (service.rollbackError()) {
        <div class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
          {{ service.rollbackError() }}
        </div>
      }
      <app-activity-feed
        [activeFilter]="activeEventFilter()"
        (filterChange)="onFilterChange($event)"
        (loadMore)="loadMoreEvents()"
        (rollback)="doRollback($event)"
      />
    </div>
  `,
})
export class AppRevisionsTabComponent implements OnInit, OnDestroy {
  service = inject(AppRevisionsService);
  private readonly route = inject(ActivatedRoute);

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
    await this.service.loadEvents(this.appId, this.activeEventFilter(), this.PAGE_SIZE, this.eventsOffset);
  }

  async doRollback(event: AppAuditEventSummaryDto) {
    if (!this.appId || event.revisionNumber == null) return;
    await this.service.rollback(this.appId, event.revisionNumber);
    if (!this.service.rollbackError()) {
      this.eventsOffset = 0;
      await this.service.loadEvents(this.appId, this.activeEventFilter(), this.PAGE_SIZE, 0);
    }
  }
}
