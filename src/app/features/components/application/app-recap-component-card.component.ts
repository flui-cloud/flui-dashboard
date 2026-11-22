import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { accessOf } from '../../model/app-access';
import { AppAvailability } from '../../service/fleet.service';
import { Tone, statusToneOf } from '../dashboard/home-state';
import { ComponentCard, ComponentTrend } from './app-recap-bundle';
import {
  RunState,
  availabilityFact,
  componentBackupDetail,
  routeOf,
  runBusy,
  runLabel,
} from './app-recap-view';

@Component({
  selector: 'tr[app-recap-component-card]',
  imports: [RouterLink, FlUsageBar, FlButton, FlStatus],
  host: { '[attr.data-testid]': '"recap-component-" + card().app.id' },
  template: `
    @let c = card();
    <td>
      <a
        class="fl-link fl-mono"
        [routerLink]="['/apps/applications', c.app.id]"
        [queryParams]="recapPath() ? { returnTo: recapPath() } : {}"
        [title]="'Manage ' + c.role"
        >{{ c.role }}</a
      >
    </td>
    <td class="text-fl-ink-secondary">{{ c.badge }}</td>
    <td><fl-status [tone]="tone(c.status.tone)" [label]="c.status.label" /></td>
    <td>
      @if (address()) {
        <span class="fl-mono fl-cell-clip" [title]="address()">{{ address() }}</span>
      } @else {
        <span class="text-fl-ink-muted">—</span>
      }
    </td>
    <td class="text-fl-ink-secondary">{{ c.meta }}</td>
    @for (b of bars(); track b.key) {
      <td>
        @if (b.percent === null) {
          <span class="text-fl-ink-muted">—</span>
        } @else {
          <fl-usage-bar [percent]="b.percent" [label]="c.role + ' ' + b.label" />
        }
      </td>
    }
    <td>
      @if (availability(); as a) {
        @let f = availabilityFact(a);
        <fl-status
          [tone]="tone(f.tone)"
          [label]="f.value"
          [title]="f.sub"
          data-testid="recap-component-availability"
        />
      } @else {
        <span class="text-fl-ink-muted">—</span>
      }
    </td>
    <td>
      @if (readOnly()) {
        <span class="text-fl-ink-muted">—</span>
      } @else if (c.backup; as band) {
        <div class="flex min-w-0 flex-col gap-1">
          <fl-status [tone]="tone(band.tone)" [label]="band.label" />
          @if (backupDetail(band); as detail) {
            <span class="fl-cell-clip text-fl-caption text-fl-ink-muted" [title]="detail">{{
              detail
            }}</span>
          }
        </div>
      } @else {
        <span class="text-fl-body-sm text-fl-ink-muted">{{
          protectionLoaded() ? 'Backup state unavailable' : 'Reading the backup state…'
        }}</span>
      }
    </td>
    <td class="is-fit">
      @if (!readOnly() && c.backup; as band) {
        @if (band.protectPath) {
          <a
            flButton
            size="sm"
            [routerLink]="route(band.protectPath).path"
            [queryParams]="route(band.protectPath).query"
            >Protect</a
          >
        } @else if (band.runPolicyId && band.holdsData) {
          <button
            flButton
            size="sm"
            type="button"
            [disabled]="busy(runState()[band.runPolicyId])"
            (click)="backUp.emit(band.runPolicyId)"
          >
            {{ label(runState()[band.runPolicyId]) }}
          </button>
        }
      }
    </td>
  `,
})
export class AppRecapComponentCardComponent {
  readonly card = input.required<ComponentCard>();
  readonly recapPath = input('');
  readonly protectionLoaded = input.required<boolean>();
  readonly availability = input<AppAvailability | null>(null);
  readonly runState = input.required<Record<string, RunState>>();
  readonly trend = input<ComponentTrend | null>(null);
  /** The public address, on the component that answers at it. */
  readonly address = input('');
  readonly backUp = output<string>();

  /** A reader is shown no backup posture: it is not theirs to act on. */
  protected readonly readOnly = computed(() => !!accessOf(this.card().app)?.readOnly);
  protected readonly bars = computed(() => {
    const [cpu, memory, disk] = this.card().bars;
    return [
      { key: 'CPU', label: 'CPU', percent: cpu?.percent ?? null },
      { key: 'MEM', label: 'memory', percent: memory?.percent ?? null },
      { key: 'DISK', label: 'disk', percent: disk?.percent ?? null },
    ];
  });
  protected readonly route = routeOf;
  protected readonly busy = runBusy;
  protected readonly label = runLabel;
  protected readonly backupDetail = componentBackupDetail;
  protected readonly availabilityFact = availabilityFact;

  protected tone(tone: Tone): StatusTone {
    return statusToneOf(tone);
  }
}
