import { Component, input, output } from '@angular/core';
import {
  REGISTRY_TRAFFIC_WINDOWS,
  RegistryTraffic,
  RegistryTrafficWindow,
  formatMbitPerSecond,
  formatRegistrySize,
} from '../../model/registry-storage.models';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';

const REFUSED_TITLE = 'over an application quota, an upload too large, or over the rate limit';

@Component({
  selector: 'app-registry-traffic-panel',
  imports: [FlKeyValue, FlKvItem, FlPanel, FlLoadingState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Traffic" data-testid="registry-traffic">
      <div panelActions class="fl-segmented" role="group" aria-label="Traffic window">
        @for (w of windows; track w) {
          <button
            type="button"
            [attr.data-testid]="'registry-traffic-' + w"
            [attr.aria-pressed]="window() === w"
            (click)="windowChange.emit(w)"
          >
            {{ w }}
          </button>
        }
      </div>

      @if (traffic(); as t) {
        <div class="flex flex-col gap-3" [attr.aria-busy]="loading()">
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Pulls" data-testid="registry-traffic-pulls">{{
              t.requests.pulls
            }}</fl-kv-item>
            <fl-kv-item key="Pushes" data-testid="registry-traffic-pushes">{{
              t.requests.pushes
            }}</fl-kv-item>
            <fl-kv-item key="Pulled out" data-testid="registry-traffic-out">{{
              size(t.bytesOut)
            }}</fl-kv-item>
            <fl-kv-item key="Pushed in" data-testid="registry-traffic-in">{{
              size(t.bytesIn)
            }}</fl-kv-item>
          </fl-key-value>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="registry-traffic-peak">
            Busiest 5 minutes: {{ mbit(t.peakBytesPerSecondOut) }} out ·
            {{ mbit(t.peakBytesPerSecondIn) }} in
          </p>
          <p
            class="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-fl-body-sm text-fl-ink-muted"
            data-testid="registry-traffic-outcomes"
          >
            @if (t.outcomes.refused > 0) {
              <fl-status
                tone="warning"
                data-testid="registry-traffic-refused"
                [title]="refusedTitle"
                [label]="t.outcomes.refused + ' refused'"
              />
            } @else {
              <span data-testid="registry-traffic-refused" [title]="refusedTitle"
                >{{ t.outcomes.refused }} refused</span
              >
            }
            @if (t.outcomes.failed > 0) {
              <fl-status
                tone="error"
                data-testid="registry-traffic-failed"
                [label]="t.outcomes.failed + ' failed'"
              />
            } @else {
              <span data-testid="registry-traffic-failed">{{ t.outcomes.failed }} failed</span>
            }
          </p>
          @if (t.readFromBucketBytes !== null) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="registry-traffic-bucket">
              {{ size(t.readFromBucketBytes) }} read from the bucket to serve pulls; the provider
              may bill it as outgoing traffic.
            </p>
          }
        </div>
      } @else if (failed()) {
        <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="registry-traffic-failed-load">
          Traffic could not be read right now.
        </p>
      } @else {
        <fl-loading-state [rows]="2" />
      }
    </fl-panel>
  `,
})
export class RegistryTrafficPanel {
  readonly traffic = input.required<RegistryTraffic | null>();
  readonly window = input.required<RegistryTrafficWindow>();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly windowChange = output<RegistryTrafficWindow>();

  protected readonly windows = REGISTRY_TRAFFIC_WINDOWS;
  protected readonly refusedTitle = REFUSED_TITLE;

  protected size(bytes: number | null | undefined): string {
    return formatRegistrySize(bytes);
  }

  protected mbit(bytesPerSecond: number): string {
    return formatMbitPerSecond(bytesPerSecond);
  }
}
