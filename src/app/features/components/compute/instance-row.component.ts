import { Component, Input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstanceWithLabels, getOwnership } from '../../model/instance.models';
import { InstanceManagedBadgeComponent } from './instance-managed-badge.component';
import { InstanceActionsComponent } from './instance-actions.component';
import { InstanceStatusBadgeComponent } from './instance-status-badge.component';
import { architectureLabel } from '../../../shared/components/architecture-badge.component';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlTag } from '../../../ui/primitives/tag';
import { formatDisk, formatMemory } from './instance-status';

@Component({
  selector: 'tr[app-instance-row]',
  imports: [
    RouterLink,
    FlCopyId,
    FlTag,
    InstanceManagedBadgeComponent,
    InstanceActionsComponent,
    InstanceStatusBadgeComponent,
  ],
  template: `
    @let name = instance.displayName || instance.name;
    <td>
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5">
          @if (isSelf()) {
            <a
              class="fl-link"
              [routerLink]="['/infrastructure/compute', instance.provider, instance.providerId]"
              >{{ name }}</a
            >
          } @else {
            <span class="font-medium">{{ name }}</span>
          }
          @if (architecture(); as arch) {
            <fl-tag [attr.title]="'CPU architecture: ' + arch" data-testid="architecture-badge">{{
              arch
            }}</fl-tag>
          }
        </div>
        @if (subtitle()) {
          <span class="text-fl-caption text-fl-ink-muted">{{ subtitle() }}</span>
        }
      </div>
    </td>
    <td><app-instance-status-badge [status]="instance.status" /></td>
    <td>{{ instance.provider }}</td>
    <td>{{ instance.regionName || instance.region || '—' }}</td>
    <td class="is-num">{{ instance.cpuCores }}</td>
    <td class="is-num">{{ memory(instance.ramMb) }}</td>
    <td class="is-num">{{ disk(instance.diskMb) }}</td>
    <td>
      @if (instance.ipConfig?.v4?.ip; as ip) {
        <fl-copy-id [value]="ip" label="IP address" />
      } @else {
        <span class="text-fl-ink-muted">—</span>
      }
    </td>
    <td><app-instance-managed-badge [ownership]="ownership()" /></td>
    <td class="is-fit">
      <app-instance-actions [instance]="instance" [isManaged]="isSelf()" />
    </td>
  `,
})
export class InstanceRowComponent {
  @Input({ required: true }) instance!: InstanceWithLabels;

  ownership = computed(() => getOwnership(this.instance));
  isSelf = computed(() => this.ownership() === 'self');
  architecture = computed(() => architectureLabel(this.instance.architecture));
  subtitle = computed(() => {
    const parts: string[] = [];
    const inst = this.instance;
    if (inst.displayName && inst.displayName !== inst.name) parts.push(inst.name);
    if (inst.osType) parts.push(inst.osType);
    return parts.join(' · ');
  });

  protected readonly memory = formatMemory;
  protected readonly disk = formatDisk;
}
