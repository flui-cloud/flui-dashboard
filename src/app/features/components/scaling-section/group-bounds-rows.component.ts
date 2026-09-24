import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ProvisionMode } from '../../model/scaling-group.models';
import { GroupDraft } from './group-draft';
import { TABLE } from './scaling-tabs-format';

/**
 * The rows a person reads to know how large this cluster may become and when
 * it may act: provisioning, the three bounds, and the settle window.
 *
 * A `tbody` rather than a card of its own, so the settings stay one table and
 * every row keeps the test id it had. It is split from the catalogue rows
 * because the two halves turn on different facts — these on whether the
 * provider can be bought from, those on whether it publishes a catalogue.
 */
@Component({
  selector: 'tbody[app-group-bounds-rows]',
  standalone: true,
  imports: [ExplainComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tr [class]="t.row" data-testid="row-provision">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Provisioning"
          labelClass="text-[13px] text-foreground"
          testid="provision-why"
        >
          @if (d().canProvision()) {
            Automatic stays inside the ceilings below and never asks again.
          } @else {
            Not a choice here: Flui cannot create a machine on
            {{ provider() }}.
          }
        </app-explain>
      </th>
      <td [class]="t.td">
        @if (d().canProvision()) {
          <span
            class="inline-flex rounded-md border border-border p-0.5"
            role="radiogroup"
            aria-label="Provisioning"
          >
            @for (mode of provisionModes; track mode) {
              <button
                type="button"
                role="radio"
                (click)="d().setProvision(mode)"
                class="rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [class]="
                  g().provision === mode
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                "
                [attr.aria-checked]="g().provision === mode"
                [attr.data-testid]="'provision-' + mode"
              >
                {{ mode }}
              </button>
            }
          </span>
        } @else {
          <span class="text-foreground" data-testid="provision-fixed"
            >Manual</span
          >
        }
      </td>
      <td [class]="t.tdMuted">
        @if (d().canProvision()) {
          Buys on its own, or names a machine and alerts you.
        } @else {
          Fixed: nothing here can buy a machine.
        }
      </td>
    </tr>

    <tr [class]="t.row" data-testid="row-min">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Floor"
          labelClass="text-[13px] text-foreground"
          testid="floor-why"
        >
          Below it the installation is broken, so this is the one bound that
          acts without waiting.
        </app-explain>
        <span class="font-mono text-[11px] text-muted-foreground">min</span>
      </th>
      <td [class]="t.td">
        <input
          type="number"
          min="1"
          max="20"
          [class]="t.field + ' w-24 tabular-nums'"
          [ngModel]="g().bounds.min"
          (ngModelChange)="d().setBound('min', $event)"
          aria-label="Floor"
          data-testid="bound-min-input"
        />
      </td>
      <td [class]="t.tdMuted">Never fewer than this. Held now, always.</td>
    </tr>

    <tr [class]="t.row" data-testid="row-desired">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Target"
          labelClass="text-[13px] text-foreground"
          testid="target-why"
        >
          Nothing is bought to reach it — the fleet only drifts back to it when
          load subsides.
        </app-explain>
        <span class="font-mono text-[11px] text-muted-foreground">desired</span>
      </th>
      <td [class]="t.td">
        <input
          type="number"
          min="1"
          max="20"
          [class]="t.field + ' w-24 tabular-nums'"
          [ngModel]="g().bounds.desired"
          (ngModelChange)="d().setBound('desired', $event)"
          aria-label="Target"
          data-testid="bound-desired-input"
        />
      </td>
      <td [class]="t.tdMuted">Where the fleet would like to sit.</td>
    </tr>

    <tr [class]="t.row" data-testid="row-max">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Ceiling"
          labelClass="text-[13px] text-foreground"
          testid="ceiling-why"
        >
          @if (d().canProvision()) {
            Reached with whatever fits, not with a preferred machine.
          } @else {
            <span data-testid="max-meaning-manual">
              Machines arrive by hand here, so going past it is reported rather
              than prevented.
            </span>
          }
        </app-explain>
        <span class="font-mono text-[11px] text-muted-foreground">max</span>
      </th>
      <td [class]="t.td">
        <input
          type="number"
          min="1"
          max="20"
          [class]="t.field + ' w-24 tabular-nums'"
          [ngModel]="g().bounds.max"
          (ngModelChange)="d().setBound('max', $event)"
          aria-label="Ceiling"
          data-testid="bound-max-input"
        />
      </td>
      <td [class]="t.tdMuted">
        @if (d().canProvision()) {
          Never more than this.
        } @else {
          Reported, not prevented.
        }
      </td>
    </tr>

    <tr [class]="t.row" data-testid="row-settle">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Settle window"
          labelClass="text-[13px] text-foreground"
          testid="settle-why"
        >
          Long enough to be sure the app is really stuck and not just starting.
          It never waits for a cheaper machine.
        </app-explain>
      </th>
      <td [class]="t.td">
        <span class="inline-flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="3600"
            [class]="t.field + ' w-24 tabular-nums'"
            [ngModel]="g().settleSeconds"
            (ngModelChange)="d().setSettle($event)"
            aria-label="Settle window in seconds"
            data-testid="settle-input"
          />
          <span class="text-[12px] text-muted-foreground">seconds</span>
        </span>
      </td>
      <td [class]="t.tdMuted">
        How long an app must be stuck before this
        @if (d().canProvision()) {
          buys.
        } @else {
          alerts.
        }
      </td>
    </tr>
  `,
})
export class GroupBoundsRowsComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly t = TABLE;
  protected readonly provisionModes: readonly ProvisionMode[] = [
    'automatic',
    'manual',
  ];

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());
}
