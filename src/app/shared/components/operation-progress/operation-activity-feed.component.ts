/**
 * Operation Activity Feed Component
 *
 * Displays live activity feed of recent operation events.
 * Shows completed and running steps with timestamps.
 */

import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideActivity } from '@ng-icons/lucide';
import { ClusterCreationStep } from '../../../features/model/cluster.models';

export interface ActivityItem {
  time: string;
  message: string;
}

@Component({
  selector: 'app-operation-activity-feed',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [
    provideIcons({
      lucideActivity,
    }),
  ],
  template: `
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold mb-4 flex items-center">
        <ng-icon name="lucideActivity" class="h-5 w-5 mr-2" />
        {{ title() }}
      </h3>
      <div class="space-y-2 max-h-32 overflow-y-auto">
        @for (activity of activities(); track $index) {
          <div class="flex items-center space-x-2 text-sm">
            <div class="h-1.5 w-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
            <span class="text-muted-foreground">{{ activity.time }}</span>
            <span>{{ activity.message }}</span>
          </div>
        }
        @if (activities().length === 0) {
          <div class="text-sm text-muted-foreground text-center py-4">
            No activity yet
          </div>
        }
      </div>
    </div>
  `,
})
export class OperationActivityFeedComponent {
  // Inputs
  title = input<string>('Live Activity');
  steps = input.required<ClusterCreationStep[]>();

  // Computed activities from steps
  activities = computed<ActivityItem[]>(() => {
    const stepsData = this.steps();
    const activities: ActivityItem[] = [];

    stepsData.forEach(step => {
      if (step.status === 'completed' && step.completedAt) {
        activities.push({
          time: this.formatTime(step.completedAt),
          message: `✅ ${step.title} completed successfully`
        });
      } else if (step.status === 'running' && step.startedAt) {
        activities.push({
          time: this.formatTime(step.startedAt),
          message: `🔄 Started ${step.title.toLowerCase()}`
        });
      }
    });

    // Sort by most recent first and take last 5
    return activities.reverse().slice(0, 5);
  });

  // Helper methods
  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
