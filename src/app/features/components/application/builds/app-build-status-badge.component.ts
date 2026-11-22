import { Component, computed, input } from '@angular/core';
import { AppBuildResponseDto } from '../../../../core/api/model/appBuildResponseDto';
import { FlStatus, StatusTone } from '../../../../ui/primitives/status';

interface BuildStatusView {
  tone: StatusTone;
  label: string;
  step: string | null;
}

const STEPS: Partial<Record<AppBuildResponseDto['status'], string>> = {
  CLONING: 'Cloning',
  ANALYZING: 'Analyzing',
  BUILDING: 'Building',
  PUSHING: 'Pushing',
};

function viewOf(status: AppBuildResponseDto['status']): BuildStatusView {
  switch (status) {
    case 'COMPLETED':
      return { tone: 'success', label: 'Succeeded', step: null };
    case 'FAILED':
      return { tone: 'error', label: 'Failed', step: null };
    case 'CANCELLED':
      return { tone: 'neutral', label: 'Cancelled', step: null };
    case 'PENDING':
      return { tone: 'neutral', label: 'Pending', step: null };
    default:
      return { tone: 'progress', label: 'Running', step: STEPS[status] ?? null };
  }
}

@Component({
  selector: 'app-build-status-badge',
  standalone: true,
  imports: [FlStatus],
  template: `
    @let v = view();
    <fl-status [tone]="v.tone" [label]="v.label" [attr.title]="v.step" />
  `,
})
export class AppBuildStatusBadgeComponent {
  status = input.required<AppBuildResponseDto['status']>();
  protected readonly view = computed(() => viewOf(this.status()));
}
