import { Component, computed, input } from '@angular/core';
import { HealthStatus } from '../../model/provider.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { formatDateTime } from './provider-presentation';

const HEALTH: Record<HealthStatus['status'], { tone: StatusTone; label: string }> = {
  healthy: { tone: 'success', label: 'Healthy' },
  degraded: { tone: 'warning', label: 'Degraded' },
  unhealthy: { tone: 'error', label: 'Unhealthy' },
};

@Component({
  selector: 'app-provider-health-panel',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlAlert, FlEmptyState, FlLoadingState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Health">
      @if (health(); as h) {
        <div class="fl-stack">
          <fl-key-value>
            <fl-kv-item key="Status">
              <fl-status
                [tone]="state().tone"
                [label]="state().label"
                data-testid="provider-health-status"
              />
            </fl-kv-item>
            <fl-kv-item key="Checked">{{ checkedAt() }}</fl-kv-item>
            <fl-kv-item key="Response time">
              {{ h.responseTime !== undefined ? h.responseTime + ' ms' : '—' }}
            </fl-kv-item>
          </fl-key-value>
          @if (h.errors?.length) {
            <fl-alert tone="error" title="The last check reported a problem">{{
              h.errors![0]
            }}</fl-alert>
          }
        </div>
      } @else if (checking()) {
        <fl-loading-state [rows]="2" />
      } @else {
        <fl-empty-state
          [compact]="true"
          title="No health data yet"
          body="Run a health check to test the connection."
        />
      }
    </fl-panel>
  `,
})
export class ProviderHealthPanel {
  readonly health = input<HealthStatus | null>(null);
  readonly checking = input(false);

  protected readonly state = computed(() => {
    const status = this.health()?.status;
    return (status && HEALTH[status]) || { tone: 'neutral' as StatusTone, label: 'Unknown' };
  });

  protected readonly checkedAt = computed(() => {
    const at = this.health()?.lastCheck;
    if (!at) return '—';
    const date = at instanceof Date ? at : new Date(at);
    return Number.isNaN(date.getTime()) ? '—' : formatDateTime(date.toISOString());
  });
}
