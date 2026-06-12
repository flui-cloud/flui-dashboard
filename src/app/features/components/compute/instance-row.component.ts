import { CommonModule } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { AppConfigService } from '../../../core/services/app-config.service';
import {
  lucideCopy,
  lucideCpu,
  lucideCheck,
  lucideGlobe,
  lucideHardDrive,
  lucideLoader,
  lucideMapPin,
  lucideMemoryStick,
  lucidePlay,
  lucideServer,
  lucideSquare,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { InstanceWithLabels, getOwnership } from '../../model/instance.models';
import { InstanceManagedBadgeComponent } from './instance-managed-badge.component';
import { InstanceActionsComponent } from './instance-actions.component';
import { InstanceStatusBadgeComponent } from './instance-status-badge.component';

@Component({
  selector: 'app-instance-row',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    InstanceManagedBadgeComponent,
    InstanceActionsComponent,
    InstanceStatusBadgeComponent,
  ],
  providers: [
    provideIcons({
      lucideServer,
      lucidePlay,
      lucideSquare,
      lucideTriangleAlert,
      lucideLoader,
      lucideHardDrive,
      lucideCpu,
      lucideMemoryStick,
      lucideGlobe,
      lucideMapPin,
      lucideCopy,
      lucideCheck,
    }),
  ],
  template: `
    <div class="border border-border rounded-lg hover:bg-muted/30 transition-colors">
      <!-- Header: instance name + actions -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-semibold text-foreground text-sm truncate">
            {{ instance.displayName || instance.name }}
          </span>
          @if (instance.displayName && instance.displayName !== instance.name) {
            <span class="text-xs text-muted-foreground font-mono truncate hidden sm:inline">{{ instance.name }}</span>
          }
          @if (instance.osType) {
            <span class="text-xs text-muted-foreground hidden lg:inline">· {{ instance.osType }}</span>
          }
        </div>
        <app-instance-actions [instance]="instance" [isManaged]="isSelf()" />
      </div>

      <!-- Details row -->
      <div class="grid items-center gap-x-4 px-4 py-2 text-sm" style="grid-template-columns: 1fr auto 2fr 1fr 1.5fr auto">
        <!-- Provider -->
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center w-5 h-5 bg-white rounded border border-border shadow-sm flex-shrink-0">
            <img
              [src]="providerLogoUrl()"
              [alt]="instance.provider"
              class="w-3.5 h-3.5 object-contain"
              (error)="onLogoError($event)"
            />
          </div>
          <span class="text-xs text-muted-foreground">{{ instance.provider }}</span>
        </div>

        <!-- Status -->
        <div>
          <app-instance-status-badge [status]="instance.status" />
        </div>

        <!-- Resources -->
        <div class="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <ng-icon name="lucideCpu" class="h-3 w-3 text-blue-600" />
            {{ instance.cpuCores }}C
          </span>
          <span class="flex items-center gap-1">
            <ng-icon name="lucideMemoryStick" class="h-3 w-3 text-purple-600" />
            {{ formatMemory(instance.ramMb) }}
          </span>
          <span class="flex items-center gap-1">
            <ng-icon name="lucideHardDrive" class="h-3 w-3 text-green-600" />
            {{ formatDisk(instance.diskMb) }}
          </span>
        </div>

        <!-- Location -->
        <div class="flex items-center gap-1">
          <ng-icon name="lucideMapPin" class="h-3 w-3 text-orange-600 flex-shrink-0" />
          <span class="text-xs text-muted-foreground">{{ instance.regionName || instance.region }}</span>
        </div>

        <!-- IP with copy -->
        <div>
          @if (instance.ipConfig?.v4?.ip) {
            <div class="flex items-center gap-1">
              <ng-icon name="lucideGlobe" class="h-3 w-3 text-blue-600 flex-shrink-0" />
              <span class="font-mono text-xs">{{ instance.ipConfig?.v4?.ip }}</span>
              <button
                (click)="copyIp(instance.ipConfig?.v4?.ip); $event.stopPropagation()"
                class="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                [title]="copiedIp() ? 'Copied!' : 'Copy IP'"
              >
                <ng-icon [name]="copiedIp() ? 'lucideCheck' : 'lucideCopy'" class="h-3 w-3" />
              </button>
            </div>
          } @else {
            <span class="text-xs text-muted-foreground italic">No IP</span>
          }
        </div>

        <!-- Managed -->
        <div class="flex justify-end">
          <app-instance-managed-badge [ownership]="ownership()" />
        </div>
      </div>
    </div>
  `,
})
export class InstanceRowComponent {
  private readonly appConfigService = inject(AppConfigService);

  @Input({ required: true }) instance!: InstanceWithLabels;

  ownership = computed(() => getOwnership(this.instance));
  isSelf = computed(() => this.ownership() === 'self');
  copiedIp = signal(false);

  providerLogoUrl = computed(
    () => `${this.appConfigService.apiBaseUrl}/api/v1/management/providers/${this.instance.provider}/logo`
  );

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  async copyIp(ip?: string) {
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
      this.copiedIp.set(true);
      setTimeout(() => this.copiedIp.set(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = ip;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copiedIp.set(true);
      setTimeout(() => this.copiedIp.set(false), 2000);
    }
  }

  formatMemory(mb: number): string {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }

  formatDisk(mb: number): string {
    if (mb >= 1024 * 1024) {
      return `${(mb / (1024 * 1024)).toFixed(0)} TB`;
    } else if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`;
    }
    return `${mb} MB`;
  }
}
