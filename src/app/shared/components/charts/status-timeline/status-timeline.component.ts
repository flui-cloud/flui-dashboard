import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StatusTimelineConfig,
  StatusTimelineData,
  DEFAULT_TIMELINE_CONFIG,
  TimelineStatus,
  TimelineEvent
} from '../chart.models';

/**
 * Status Timeline Component
 * Displays uptime/downtime history in a visual timeline (GitHub-style)
 *
 * @example
 * ```html
 * <app-status-timeline
 *   [data]="{
 *     title: 'Uptime History',
 *     uptimePercentage: 99.95,
 *     events: [
 *       { timestamp: new Date('2024-01-01'), status: 'up' },
 *       { timestamp: new Date('2024-01-02'), status: 'down', duration: 3600000, message: 'Server crash' }
 *     ]
 *   }"
 *   [config]="{daysToShow: 90}"
 * />
 * ```
 */
@Component({
  selector: 'app-status-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-timeline-card bg-card border border-border rounded-lg p-6">
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-foreground">{{ data().title }}</h3>
          @if (data().subtitle) {
            <p class="text-sm text-muted-foreground mt-1">{{ data().subtitle }}</p>
          }
        </div>

        @if (config().showUptimePercentage && data().uptimePercentage !== undefined) {
          <div class="text-right">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">
              {{ data().uptimePercentage }}%
            </div>
            <div class="text-xs text-muted-foreground">Uptime</div>
          </div>
        }
      </div>

      <!-- Timeline Grid -->
      <div class="timeline-grid" [class.compact]="config().compact">
        @for (day of timelineDays(); track day.date) {
          <div
            class="timeline-block"
            [class]="getBlockClass(day.status)"
            [title]="getBlockTooltip(day)"
            (click)="onBlockClick(day)"
          >
          </div>
        }
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded-sm bg-green-500"></div>
          <span>Up</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded-sm bg-red-500"></div>
          <span>Down</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded-sm bg-yellow-500"></div>
          <span>Degraded</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 rounded-sm bg-blue-500"></div>
          <span>Maintenance</span>
        </div>
        <div class="ml-auto text-xs">
          Last {{ config().daysToShow }} days
        </div>
      </div>

      <!-- Selected Incident Details -->
      @if (selectedIncident()) {
        <div class="mt-4 p-4 bg-muted rounded-lg">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-sm font-semibold text-foreground">
                {{ formatDate(selectedIncident()!.timestamp) }}
              </div>
              @if (selectedIncident()!.message) {
                <p class="text-sm text-muted-foreground mt-1">
                  {{ selectedIncident()!.message }}
                </p>
              }
              @if (selectedIncident()!.duration) {
                <p class="text-xs text-muted-foreground mt-1">
                  Duration: {{ formatDuration(selectedIncident()!.duration!) }}
                </p>
              }
            </div>
            <button
              (click)="clearSelection()"
              class="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12px, 1fr));
      gap: 3px;
      max-width: 100%;
    }

    .timeline-grid.compact {
      grid-template-columns: repeat(auto-fill, minmax(8px, 1fr));
      gap: 2px;
    }

    .timeline-block {
      aspect-ratio: 1;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    .timeline-block:hover {
      transform: scale(1.2);
      border-color: currentColor;
      z-index: 10;
    }

    .status-up {
      background-color: #10b981;
    }

    .status-down {
      background-color: #ef4444;
    }

    .status-degraded {
      background-color: #f59e0b;
    }

    .status-maintenance {
      background-color: #3b82f6;
    }

    .status-unknown {
      background-color: #e5e7eb;
    }

    :host-context(.dark) .status-unknown {
      background-color: #374151;
    }
  `]
})
export class StatusTimelineComponent {
  // Inputs
  data = input.required<StatusTimelineData>();
  config = input<StatusTimelineConfig>({});

  // Selected incident for details
  selectedIncident = computed(() => this._selectedIncident());
  private readonly _selectedIncident = computed<TimelineEvent | null>(() => null);

  // Computed configurations
  private readonly mergedConfig = computed(() => ({
    ...DEFAULT_TIMELINE_CONFIG,
    ...this.config()
  }));

  // Generate timeline days
  timelineDays = computed(() => {
    const daysToShow = this.mergedConfig().daysToShow;
    const events = this.data().events;
    const days: Array<{ date: Date; status: TimelineStatus; event?: TimelineEvent }> = [];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);

    // Create array of days
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      // Find event for this day
      const dayEvent = events.find(e => {
        const eventDate = typeof e.timestamp === 'number' ? new Date(e.timestamp) : e.timestamp;
        return eventDate >= dayStart && eventDate <= dayEnd;
      });

      days.push({
        date: new Date(d),
        status: dayEvent?.status || 'up',  // Default to 'up' if no event
        event: dayEvent
      });
    }

    return days;
  });

  // Get block CSS class
  getBlockClass(status: TimelineStatus): string {
    return `status-${status}`;
  }

  // Get block tooltip
  getBlockTooltip(day: { date: Date; status: TimelineStatus; event?: TimelineEvent }): string {
    const dateStr = this.formatDate(day.date);
    const statusStr = day.status.charAt(0).toUpperCase() + day.status.slice(1);

    if (day.event?.message) {
      return `${dateStr}\nStatus: ${statusStr}\n${day.event.message}`;
    }

    return `${dateStr}\nStatus: ${statusStr}`;
  }

  // Handle block click
  onBlockClick(day: { date: Date; status: TimelineStatus; event?: TimelineEvent }): void {
    if (day.event && day.status !== 'up') {
      // Cast to writable signal for update (workaround for readonly computed)
      (this._selectedIncident as any).set(day.event);
    }
  }

  // Clear selection
  clearSelection(): void {
    (this._selectedIncident as any).set(null);
  }

  // Format date
  formatDate(timestamp: Date | number): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Format duration
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }
}
