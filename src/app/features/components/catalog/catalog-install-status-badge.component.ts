import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CatalogInstallResponseDto } from '../../../core/api/model/models';

type InstallStatus = CatalogInstallResponseDto.StatusEnum;

interface StatusMeta {
  label: string;
  classes: string;
}

const META: Record<InstallStatus, StatusMeta> = {
  PENDING: {
    label: 'Pending',
    classes: 'bg-amber-100 text-amber-800',
  },
  INSTALLING: {
    label: 'Installing',
    classes: 'bg-amber-100 text-amber-800',
  },
  RUNNING: {
    label: 'Running',
    classes: 'bg-green-100 text-green-800',
  },
  FAILED: {
    label: 'Failed',
    classes: 'bg-red-100 text-red-800',
  },
  UNINSTALLING: {
    label: 'Uninstalling',
    classes: 'bg-slate-200 text-slate-700',
  },
  UNINSTALLED: {
    label: 'Uninstalled',
    classes: 'bg-slate-200 text-slate-700',
  },
};

@Component({
  selector: 'app-catalog-install-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + meta().classes
      "
    >
      {{ meta().label }}
    </span>
  `,
})
export class CatalogInstallStatusBadgeComponent {
  readonly status = input.required<InstallStatus>();

  readonly meta = computed<StatusMeta>(() => META[this.status()]);
}
