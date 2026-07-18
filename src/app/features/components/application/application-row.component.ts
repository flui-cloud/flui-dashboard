import { Component, computed, inject, input, output } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideCircle,
  lucideLoader,
  lucideActivity,
  lucideTrash2,
  lucideShield,
} from '@ng-icons/lucide';

import {
  Application,
  ApplicationStatus,
  ApplicationStatusEnum,
  getStatusLabel,
} from '../../model/application.models';
import { ProjectsService } from '../../service/projects.service';
import { ProjectBadgeComponent } from '../projects/project-badge.component';

@Component({
  selector: 'app-application-row',
  standalone: true,
  imports: [NgIconComponent, ProjectBadgeComponent],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideCircle,
      lucideLoader,
      lucideActivity,
      lucideTrash2,
      lucideShield,
    }),
  ],
  template: `
    <div
      class="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group"
      [class.animate-pulse]="refreshing()"
      (click)="view.emit(app().id)"
    >
      <!-- Status dot -->
      <span [class]="getStatusDotClass(app().status)" class="flex-shrink-0"></span>

      <!-- Name + slug -->
      <div class="min-w-0 flex-1">
        <span class="text-sm font-medium text-gray-900 dark:text-white truncate block">{{ app().name }}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate block">{{ app().slug }}</span>
      </div>

      @if (showProject() && project()) {
        <app-project-badge [project]="project()" class="flex-shrink-0 hidden md:inline-flex" />
      }

      <!-- Category badge -->
      <span [class]="getCategoryBadgeClass(app().category)" class="flex-shrink-0">
        {{ app().category === 'system' ? 'SYS' : 'USR' }}
      </span>

      <!-- Build path badge -->
      @if (getBuildPath()) {
        <span [class]="getBuildPathBadgeClass()" class="flex-shrink-0 text-xs font-mono font-medium px-1.5 py-0.5 rounded hidden sm:inline-flex">
          {{ getBuildPathLabel() }}
        </span>
      }

      <!-- Status label -->
      <span [class]="getStatusBadgeClass(app().status)" class="flex-shrink-0 hidden sm:inline-flex items-center gap-1">
        <ng-icon [name]="getStatusIcon(app().status)" class="h-3 w-3" />
        {{ getStatusDisplayLabel(app().status) }}
      </span>

      <!-- Replicas -->
      <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 hidden lg:flex items-center gap-1 w-16">
        <span class="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
        {{ app().replicas }}x
      </span>

      <!-- Namespace -->
      <span class="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 hidden lg:block w-32 truncate">
        {{ app().k8sNamespace }}
      </span>

      <!-- Created at -->
      <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden md:block w-20 text-right">
        {{ formatDate(app().createdAt) }}
      </span>

      <!-- Delete action -->
      @if (!app().systemProtected) {
        @if (app().status === 'deleting') {
          <span class="w-7 flex-shrink-0 flex items-center justify-center" title="Deleting...">
            <ng-icon name="lucideLoader" class="h-4 w-4 text-gray-400 animate-spin" />
          </span>
        } @else {
          <button
            (click)="onDelete($event)"
            class="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title="Delete"
          >
            <ng-icon name="lucideTrash2" class="h-4 w-4" />
          </button>
        }
      } @else {
        <span class="w-7 flex-shrink-0"></span>
      }
    </div>
  `,
})
export class ApplicationRowComponent {
  app = input.required<Application>();
  refreshing = input<boolean>(false);
  showProject = input<boolean>(true);

  view = output<string>();
  delete = output<Application>();

  private readonly projectsService = inject(ProjectsService);

  readonly project = computed(() => {
    const projectId = this.app().projectId;
    if (!projectId) return null;
    return this.projectsService.projects().find((p) => p.id === projectId) ?? null;
  });

  onDelete(event: Event) {
    event.stopPropagation();
    this.delete.emit(this.app());
  }

  getStatusDotClass(status: ApplicationStatus): string {
    const base = 'w-2.5 h-2.5 rounded-full';
    switch (status) {
      case ApplicationStatusEnum.Running:
        return `${base} bg-green-500`;
      case ApplicationStatusEnum.AwaitingBuild:
      case ApplicationStatusEnum.Provisioning:
      case ApplicationStatusEnum.Updating:
        return `${base} bg-blue-500 animate-pulse`;
      case ApplicationStatusEnum.Failed:
        return `${base} bg-red-500`;
      case ApplicationStatusEnum.Degraded:
        return `${base} bg-orange-500`;
      case ApplicationStatusEnum.Deleting:
        return `${base} bg-gray-400 animate-pulse`;
      case ApplicationStatusEnum.Stopped:
      case ApplicationStatusEnum.Deleted:
        return `${base} bg-gray-400`;
      default:
        return `${base} bg-yellow-500`;
    }
  }

  getStatusBadgeClass(status: ApplicationStatus): string {
    const base = 'text-xs px-2 py-0.5 rounded font-medium';
    switch (status) {
      case ApplicationStatusEnum.Running:
        return `${base} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case ApplicationStatusEnum.AwaitingBuild:
      case ApplicationStatusEnum.Provisioning:
      case ApplicationStatusEnum.Updating:
        return `${base} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
      case ApplicationStatusEnum.Failed:
        return `${base} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case ApplicationStatusEnum.Degraded:
      case ApplicationStatusEnum.RollingBack:
        return `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      case ApplicationStatusEnum.Stopped:
      case ApplicationStatusEnum.Deleting:
      case ApplicationStatusEnum.Deleted:
        return `${base} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      default:
        return `${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
    }
  }

  getCategoryBadgeClass(category: string): string {
    const base = 'text-xs px-1.5 py-0.5 rounded font-medium';
    if (category === 'system') {
      return `${base} bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400`;
    }
    return `${base} bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400`;
  }

  getStatusIcon(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatusEnum.Running:
        return 'lucideCircleCheck';
      case ApplicationStatusEnum.AwaitingBuild:
      case ApplicationStatusEnum.Provisioning:
      case ApplicationStatusEnum.Updating:
        return 'lucideLoader';
      case ApplicationStatusEnum.Failed:
        return 'lucideCircleX';
      case ApplicationStatusEnum.Degraded:
        return 'lucideActivity';
      default:
        return 'lucideCircle';
    }
  }

  getStatusDisplayLabel(status: ApplicationStatus): string {
    return getStatusLabel(status);
  }

  getBuildPath(): string | null {
    return (this.app() as any).buildPath ?? null;
  }

  getBuildPathLabel(): string {
    const bp = this.getBuildPath();
    if (bp === 'github-actions') return 'GHA';
    if (bp === 'railpack') return 'RP';
    if (bp === 'dockerfile') return '🐳';
    return '';
  }

  getBuildPathBadgeClass(): string {
    const bp = this.getBuildPath();
    if (bp === 'github-actions') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (bp === 'railpack') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    return 'bg-muted text-muted-foreground';
  }

  formatDate(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  }
}
