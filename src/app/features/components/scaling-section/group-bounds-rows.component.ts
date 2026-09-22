import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
            <tr [class]="t.row" data-testid="row-provision">
              <th scope="row" [class]="t.td + ' font-normal'">Provisioning</th>
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
                  <span class="text-foreground" data-testid="provision-fixed">Manual</span>
                }
              </td>
              <td [class]="t.tdMuted">
                @if (d().canProvision()) {
                  Automatic buys through {{ provider() }}'s own API without
                  asking again, up to the ceilings below. Manual means the group
                  names the shape it would have bought and raises an alarm for a
                  person to act on.
                } @else if (d().hasCatalogue()) {
                  Not a choice: {{ provider() }} publishes prices but no API to
                  create a server. Every purchase this group would make is a
                  sentence addressed to a person, who buys it in the
                  {{ provider() }} panel and attaches the machine.
                } @else {
                  Not a choice: these are your own machines, and there is nothing
                  to call. A purchase here is a request to attach hardware.
                }
              </td>
            </tr>

            <tr [class]="t.row" data-testid="row-min">
              <th scope="row" [class]="t.td + ' font-normal'">
                Floor <span class="font-mono text-[11px] text-muted-foreground">min</span>
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
              <td [class]="t.tdMuted">
                Held now, always. Below it the installation is broken.
                @if (!d().canProvision()) {
                  Nothing here can restore it by itself, so falling below the
                  floor is what raises the loudest alarm this group has.
                } @else {
                  It is the one bound that buys without being asked twice.
                }
              </td>
            </tr>

            <tr [class]="t.row" data-testid="row-desired">
              <th scope="row" [class]="t.td + ' font-normal'">
                Target <span class="font-mono text-[11px] text-muted-foreground">desired</span>
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
              <td [class]="t.tdMuted">
                Not the desired capacity of AWS: nothing is bought to reach it.
                It is where the fleet would like to sit, approached
                @if (d().canProvision()) {
                  when the market allows
                } @else {
                  as somebody attaches machines
                }
                and returned to when load subsides.
              </td>
            </tr>

            <tr [class]="t.row" data-testid="row-max">
              <th scope="row" [class]="t.td + ' font-normal'">
                Ceiling <span class="font-mono text-[11px] text-muted-foreground">max</span>
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
                  As far as urgency may go right now, with whatever is available —
                  not a shape it prefers, only one that fits.
                } @else {
                  <span data-testid="max-meaning-manual">
                    Nobody here buys, so this gates no purchase. It is a check on
                    reality instead: machines arrive by hand and can go past it,
                    and a fleet larger than {{ g().bounds.max }} is reported rather
                    than prevented.
                  </span>
                }
              </td>
            </tr>

            <tr [class]="t.row" data-testid="row-settle">
              <th scope="row" [class]="t.td + ' font-normal'">Settle window</th>
              <td [class]="t.td">
                <span class="inline-flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                max="20"
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
                How long a pod must stay stuck before this
                @if (d().canProvision()) {
                  buys.
                } @else {
                  raises an alarm.
                }
                It waits only to be sure the pod is genuinely stuck rather than
                caught mid-schedule — a pod terminating, a drain finishing. It is
                not patience: it never waits for a cheaper shape.
              </td>
            </tr>
  `,
})
export class GroupBoundsRowsComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly t = TABLE;
  protected readonly provisionModes: readonly ProvisionMode[] = ['automatic', 'manual'];

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());
}
