import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { ProvisionMode, STRATEGIES } from '../../model/scaling-group.models';
import { GroupDraft } from './group-draft';
import { TABLE } from './scaling-tabs-format';
import { SettingsListEditorComponent } from './settings-list-editor.component';

@Component({
  selector: 'app-group-settings-table',
  standalone: true,
  imports: [FormsModule, NgIcon, HlmButtonDirective, SettingsListEditorComponent],
  providers: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="t.card">
      <div [class]="t.scroll">
        <table [class]="t.table">
          <thead>
            <tr [class]="t.headRow">
              <th scope="col" [class]="t.th">Setting</th>
              <th scope="col" [class]="t.th">Value</th>
              <th scope="col" [class]="t.th">What it means on {{ provider() }}</th>
            </tr>
          </thead>
          <tbody>
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
                  min="0"
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
                  min="0"
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
                  min="0"
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
                    min="0"
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

            @if (d().hasCatalogue()) {
              <tr [class]="t.row" data-testid="row-regions">
                <th scope="row" [class]="t.td + ' font-normal'">Where it may buy</th>
                <td [class]="t.td">
                  <app-settings-list-editor
                    kind="region"
                    emptyNote="nowhere to buy"
                    [items]="g().regions"
                    (add)="d().addRegion($event)"
                    (remove)="d().removeRegion($event)"
                  />
                </td>
                <td [class]="t.tdMuted">
                  More than one region is what opens "cheapest, anywhere" — and
                  what lets the ladder find a shape when the cluster's own region
                  is out.
                </td>
              </tr>

              <tr [class]="t.row" data-testid="row-shapes">
                <th scope="row" [class]="t.td + ' font-normal'">What it may buy</th>
                <td [class]="t.td">
                  <app-settings-list-editor
                    kind="shape"
                    emptyNote="nothing to buy"
                    [ordered]="true"
                    [items]="g().shapes"
                    (add)="d().addShape($event)"
                    (remove)="d().removeShape($event)"
                    (move)="d().moveShape($event)"
                  />
                </td>
                <td [class]="t.tdMuted">
                  In order of preference: the ladder tries the first shape first
                  and drops down only when the one above is unavailable or cannot
                  hold the pending pod.
                </td>
              </tr>
            } @else {
              <tr [class]="t.row" data-testid="row-requirement">
                <th scope="row" [class]="t.td + ' font-normal'">
                  What a machine has to hold
                </th>
                <td [class]="t.td">
                  <span class="flex flex-col gap-2">
                    <label class="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span class="w-14">vCPU</span>
                      <input
                        [class]="t.field + ' w-24 tabular-nums'"
                        [ngModel]="g().requirement?.cpu ?? ''"
                        (ngModelChange)="d().setRequirement('cpu', $event)"
                        data-testid="requirement-cpu"
                      />
                    </label>
                    <label class="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span class="w-14">Memory</span>
                      <input
                        [class]="t.field + ' w-24 tabular-nums'"
                        [ngModel]="g().requirement?.memory ?? ''"
                        (ngModelChange)="d().setRequirement('memory', $event)"
                        data-testid="requirement-memory"
                      />
                    </label>
                  </span>
                </td>
                <td [class]="t.tdMuted">
                  {{ provider() }} publishes no catalogue, so there is no shape to
                  name and no region to buy in — and there never will be. This is
                  what stands in for both: the alarm asks for a machine with at
                  least this much free, and a person decides what that machine is.
                </td>
              </tr>
            }

            <tr [class]="t.row" data-testid="row-strategy">
              <th scope="row" [class]="t.td + ' font-normal'">How it chooses</th>
              <td [class]="t.td">
                @if (d().hasCatalogue()) {
                  <span class="flex flex-col gap-1" role="radiogroup" aria-label="How it chooses">
                    @for (option of strategies; track option.id) {
                      <button
                        type="button"
                        role="radio"
                        (click)="d().setStrategy(option.id)"
                        class="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        [class]="
                          g().strategy === option.id
                            ? 'border-primary bg-primary/[0.06] text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        "
                        [attr.aria-checked]="g().strategy === option.id"
                        [attr.data-testid]="'strategy-' + option.id"
                      >
                        <span>{{ option.label }}</span>
                        <span class="text-[11px] text-muted-foreground">{{ option.optimises }}</span>
                      </button>
                    }
                  </span>
                } @else {
                  <span class="text-foreground" data-testid="strategy-inert">
                    {{ d().chosenStrategy()?.label ?? g().strategy }}
                  </span>
                }
              </td>
              <td [class]="t.tdMuted">
                @if (d().hasCatalogue()) {
                  Among the shapes that <em>already fit</em>. Fitting is a
                  precondition, never a preference — a shape that cannot hold the
                  pending pod is not a candidate at all, and if it were, cheapest
                  would always pick the shape that helps nobody.
                  @if (d().chosenStrategy(); as picked) {
                    <span class="mt-1 block text-foreground" data-testid="strategy-when">
                      {{ picked.when }}
                    </span>
                  }
                } @else {
                  With no catalogue there is nothing to choose between: every node
                  here is whatever was attached.
                  @if (d().chosenStrategy(); as picked) {
                    <span class="mt-1 block text-foreground" data-testid="strategy-when">
                      {{ picked.when }}
                    </span>
                  }
                }
              </td>
            </tr>

            <tr
              [class]="d().refusesEverything() ? t.rowWarn : t.row"
              data-testid="row-hourly"
            >
              <th scope="row" [class]="t.td + ' font-normal'">Hourly billing only</th>
              <td [class]="t.td">
                @if (d().hasCatalogue()) {
                  <button
                    type="button"
                    role="switch"
                    (click)="d().setHourlyOnly(!g().limits.hourlyBillingOnly)"
                    class="inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    [class]="g().limits.hourlyBillingOnly ? 'bg-primary' : 'bg-muted'"
                    [attr.aria-checked]="g().limits.hourlyBillingOnly"
                    aria-label="Hourly billing only"
                    data-testid="hourly-only"
                  >
                    <span
                      class="h-4 w-4 rounded-full bg-background transition-transform"
                      [class]="
                        g().limits.hourlyBillingOnly ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      "
                    ></span>
                  </button>
                } @else {
                  <span class="text-muted-foreground" data-testid="hourly-not-applicable">—</span>
                }
              </td>
              <td [class]="t.tdMuted">
                @if (!d().hasCatalogue()) {
                  There is no catalogue to refuse and no price to read.
                } @else if (d().refusesEverything()) {
                  <span class="flex flex-col gap-2" data-testid="hourly-trap">
                    <span class="flex items-start gap-2 text-destructive">
                      <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <strong>This group buys nothing, and will not, ever.</strong>
                        {{ provider() }} bills by the month, so a limit that accepts
                        only hourly shapes refuses the entire {{ provider() }}
                        catalogue. Every rung of the ladder ends in
                        <em>refused by limit</em>, the group looks configured, and
                        from the outside it is indistinguishable from an outage.
                      </span>
                    </span>
                    <button
                      hlmBtn
                      size="sm"
                      variant="outline"
                      type="button"
                      class="w-fit"
                      (click)="d().setHourlyOnly(false)"
                      data-testid="hourly-repair"
                    >
                      Turn it off
                    </button>
                  </span>
                } @else {
                  A shape billed by the month is paid for the month whether the
                  node lives an hour or thirty days, which makes scaling down
                  worth nothing. Leave it on only where the provider bills by the
                  hour, as {{ provider() }} does.
                }
              </td>
            </tr>

            <tr [class]="t.row" data-testid="row-cost">
              <th scope="row" [class]="t.td + ' font-normal'">Spend ceiling</th>
              <td [class]="t.td">
                @if (d().hasCatalogue()) {
                  <span class="inline-flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">€</span>
                    <input
                      type="number"
                      min="0"
                      [class]="t.field + ' w-28 tabular-nums'"
                      placeholder="no ceiling"
                      [ngModel]="g().limits.maxMonthlyCost"
                      (ngModelChange)="d().setCost($event)"
                      aria-label="Spend ceiling per month"
                      data-testid="max-monthly"
                    />
                    <span class="text-[12px] text-muted-foreground">per month</span>
                  </span>
                } @else {
                  <span class="text-muted-foreground" data-testid="cost-not-applicable">—</span>
                }
              </td>
              <td [class]="t.tdMuted">
                @if (d().hasCatalogue()) {
                  In currency, not in node count. A fleet of mixed shapes costs
                  what it costs — the number of nodes is not the bill.
                } @else {
                  Flui never sees a bill for your own machines, so there is no
                  spend to cap. A €0 here would be a different kind of lie.
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class GroupSettingsTableComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly t = TABLE;
  protected readonly strategies = STRATEGIES;
  protected readonly provisionModes: readonly ProvisionMode[] = ['automatic', 'manual'];

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());

}
