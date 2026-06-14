import { Component, input, output } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCircleX,
  lucideCircle,
  lucideLoader,
  lucideActivity,
  lucidePackage,
  lucideExternalLink,
} from '@ng-icons/lucide';

import {
  Application,
  AppGroupView,
  ApplicationStatus,
  ApplicationStatusEnum,
  getStatusLabel,
} from '../../model/application.models';
import { ApplicationRowComponent } from './application-row.component';

@Component({
  selector: 'app-application-group-row',
  standalone: true,
  imports: [NgIconComponent, ApplicationRowComponent],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideCircleX,
      lucideCircle,
      lucideLoader,
      lucideActivity,
      lucidePackage,
      lucideExternalLink,
    }),
  ],
  template: `
    @if (isComposed()) {
      <div
        class="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer group"
        [class.animate-pulse]="refreshing()"
        (click)="open.emit(group().id)"
      >
        <span [class]="dotClass(group().status, '2.5')" class="flex-shrink-0"></span>

        <div class="min-w-0 flex-1">
          <span class="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
            {{ group().name }}
            <span class="text-[10px] font-normal uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">bundle</span>
            @if (version()) {
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">v{{ version() }}</span>
            }
          </span>
          @if (host()) {
            <span class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate block">{{ host() }}</span>
          } @else {
            <span class="text-xs text-gray-400 dark:text-gray-500 truncate block">{{ group().catalogSlug }}</span>
          }
        </div>

        <span [class]="getCategoryBadgeClass(group().category)" class="flex-shrink-0">
          {{ group().category === 'system' ? 'SYS' : 'USR' }}
        </span>

        <span [class]="getStatusBadgeClass(group().status)" class="flex-shrink-0 hidden sm:inline-flex items-center gap-1">
          <ng-icon [name]="getStatusIcon(group().status)" [class]="getStatusIconClass(group().status)" />
          {{ statusLabel(group().status) }}
        </span>

        <span class="flex-shrink-0 hidden lg:flex items-center gap-1 w-24" [title]="componentsTitle()">
          <ng-icon name="lucidePackage" class="h-3 w-3 text-gray-400" />
          @for (component of group().components; track component.id) {
            <span [class]="dotClass(component.status, '2')"></span>
          }
        </span>

        <span class="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 hidden lg:block w-32 truncate">
          {{ namespace() }}
        </span>

        <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 hidden md:block w-20 text-right">
          {{ formatDate(group().createdAt) }}
        </span>

        @if (group().url) {
          <button
            (click)="openUrl($event)"
            class="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title="Open"
          >
            <ng-icon name="lucideExternalLink" class="h-4 w-4" />
          </button>
        } @else {
          <span class="w-7 flex-shrink-0"></span>
        }
      </div>
    } @else {
      <app-application-row
        [app]="group().components[0]"
        [refreshing]="refreshing()"
        (view)="open.emit($event)"
        (delete)="delete.emit($event)"
      />
    }
  `,
})
export class ApplicationGroupRowComponent {
  group = input.required<AppGroupView>();
  refreshing = input<boolean>(false);

  open = output<string>();
  delete = output<Application>();

  isComposed(): boolean {
    return this.group().type === 'composed';
  }

  private primaryComponent(): Application | undefined {
    const g = this.group();
    return g.components.find((c) => c.id === g.primaryComponentId) ?? g.components[0];
  }

  host(): string {
    const url = this.group().url;
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  version(): string | undefined {
    return this.primaryComponent()?.catalogVersion;
  }

  namespace(): string {
    return this.primaryComponent()?.k8sNamespace ?? '';
  }

  componentsTitle(): string {
    return this.group()
      .components.map((c) => `${this.shortName(c)}: ${c.status}`)
      .join(' · ');
  }

  private shortName(c: Application): string {
    const labels = c.labels as Record<string, string> | undefined;
    return labels?.['flui.cloud/composed-component'] ?? c.slug;
  }

  openUrl(event: Event): void {
    event.stopPropagation();
    const url = this.group().url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  formatDate(date: string): string {
    const diffMs = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }

  statusLabel(status: ApplicationStatus): string {
    return getStatusLabel(status);
  }

  dotClass(status: ApplicationStatus, size: '2' | '2.5'): string {
    const dim = size === '2.5' ? 'w-2.5 h-2.5' : 'w-2 h-2';
    return `${dim} rounded-full ${this.statusColor(status)}`;
  }

  private statusColor(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatusEnum.Running:
        return 'bg-green-500';
      case ApplicationStatusEnum.AwaitingBuild:
      case ApplicationStatusEnum.Provisioning:
      case ApplicationStatusEnum.Updating:
        return 'bg-blue-500 animate-pulse';
      case ApplicationStatusEnum.Failed:
        return 'bg-red-500';
      case ApplicationStatusEnum.Degraded:
        return 'bg-orange-500';
      case ApplicationStatusEnum.Deleting:
        return 'bg-gray-400 animate-pulse';
      case ApplicationStatusEnum.Stopped:
      case ApplicationStatusEnum.Deleted:
        return 'bg-gray-400';
      default:
        return 'bg-yellow-500';
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
      case ApplicationStatusEnum.Deleting:
        return 'lucideLoader';
      case ApplicationStatusEnum.Failed:
        return 'lucideCircleX';
      case ApplicationStatusEnum.Degraded:
        return 'lucideActivity';
      default:
        return 'lucideCircle';
    }
  }

  getStatusIconClass(status: ApplicationStatus): string {
    const spin =
      status === ApplicationStatusEnum.AwaitingBuild ||
      status === ApplicationStatusEnum.Provisioning ||
      status === ApplicationStatusEnum.Updating ||
      status === ApplicationStatusEnum.Deleting;
    return spin ? 'h-3 w-3 animate-spin' : 'h-3 w-3';
  }
}
