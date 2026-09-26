import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { STRATEGIES } from '../../model/scaling-group.models';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { GroupChoicesService } from './group-choices.service';
import { ScalingGroupStore } from './scaling-group.store';
import { GroupDraft } from './group-draft';
import { TABLE } from './scaling-tabs-format';
import { SettingsListEditorComponent } from './settings-list-editor.component';
import { ShapeSpec } from '../../model/scaling-section.models';

/**
 * What this group may buy and how it chooses: regions and shapes where the
 * provider publishes a catalogue, a bare requirement where it does not, then
 * the strategy, the billing rule and the spend ceiling.
 *
 * On a provider with no catalogue almost all of this collapses to "not
 * applicable", which is the seam this half was cut along.
 */
@Component({
  selector: 'tbody[app-group-catalogue-rows]',
  standalone: true,
  imports: [ExplainComponent, FormsModule, NgIcon, SettingsListEditorComponent],
  providers: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (d().hasCatalogue()) {
      <tr [class]="t.row" data-testid="row-regions">
        <th scope="row" [class]="t.td + ' font-normal'">Where it may buy</th>
        <td [class]="t.td">
          <app-settings-list-editor
            kind="region"
            emptyNote="nowhere to buy"
            exhausted="this cluster's network reaches no other region"
            [items]="g().regions"
            [choices]="regionChoices()"
            [labels]="labels()"
            (add)="d().addRegion($event)"
            (remove)="d().removeRegion($event)"
          />
        </td>
        <td [class]="t.tdMuted">
          <app-explain
            [floating]="true"
            label="Where it may buy."
            labelClass="text-[12px] text-muted-foreground"
            testid="regions-why"
          >
            More than one region is what opens "cheapest, anywhere", and what
            lets it find a machine when the cluster's own region is out.
          </app-explain>
        </td>
      </tr>

      <tr [class]="t.row" data-testid="row-shapes">
        <th scope="row" [class]="t.td + ' font-normal'">What it may buy</th>
        <td [class]="t.td">
          <app-settings-list-editor
            kind="machine"
            [choices]="machineChoices()"
            [labels]="labels()"
            emptyNote="nothing to buy"
            [ordered]="true"
            [items]="g().shapes"
            (add)="d().addShape($event)"
            (remove)="d().removeShape($event)"
            (move)="d().moveShape($event)"
          />
        </td>
        <td [class]="t.tdMuted">
          In order of preference: the first is tried first.
        </td>
      </tr>
    } @else {
      <tr [class]="t.row" data-testid="row-requirement">
        <th scope="row" [class]="t.td + ' font-normal'">
          What a machine has to hold
        </th>
        <td [class]="t.td">
          <span class="flex flex-col gap-2">
            <label
              class="flex items-center gap-2 text-[12px] text-muted-foreground"
            >
              <span class="w-14">vCPU</span>
              <input
                [class]="t.field + ' w-24 tabular-nums'"
                [ngModel]="g().requirement?.cpu ?? ''"
                (ngModelChange)="d().setRequirement('cpu', $event)"
                data-testid="requirement-cpu"
              />
            </label>
            <label
              class="flex items-center gap-2 text-[12px] text-muted-foreground"
            >
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
          <app-explain
            [floating]="true"
            label="What the alarm asks for."
            labelClass="text-[12px] text-muted-foreground"
            testid="requirement-why"
          >
            {{ provider() }} publishes no prices, so the alarm asks for a
            machine with at least this much free and you decide which one.
          </app-explain>
        </td>
      </tr>
    }

    <tr [class]="t.row" data-testid="row-strategy">
      <th scope="row" [class]="t.td + ' font-normal'">How it chooses</th>
      <td [class]="t.td">
        @if (d().hasCatalogue()) {
          <span
            class="flex flex-col gap-1"
            role="radiogroup"
            aria-label="How it chooses"
          >
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
                <span class="text-[11px] text-muted-foreground">{{
                  option.optimises
                }}</span>
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
          Only among machines that already fit. One that is too small is never a
          candidate, whatever it costs.
          @if (d().chosenStrategy(); as picked) {
            <span
              class="mt-1 block text-foreground"
              data-testid="strategy-when"
            >
              {{ picked.when }}
            </span>
          }
        } @else {
          With no catalogue there is nothing to choose between: every node here
          is whatever was attached.
          @if (d().chosenStrategy(); as picked) {
            <span
              class="mt-1 block text-foreground"
              data-testid="strategy-when"
            >
              {{ picked.when }}
            </span>
          }
        }
      </td>
    </tr>

    <tr [class]="capWarning() ? t.rowWarn : t.row" data-testid="row-cost">
      <th scope="row" [class]="t.td + ' font-normal'">
        <app-explain
          [floating]="true"
          label="Spend cap"
          labelClass="text-[13px] text-foreground"
          testid="cap-why"
        >
          Weighed against the whole fleet's monthly bill, not against one
          machine: what is already running counts against it.
        </app-explain>
      </th>
      <td [class]="t.td">
        @if (d().hasCatalogue()) {
          <span class="inline-flex items-center gap-2">
            <span class="text-sm text-muted-foreground">€</span>
            <input
              type="number"
              min="0"
              step="1"
              [class]="t.field + ' w-28 tabular-nums'"
              placeholder="no cap"
              [ngModel]="g().limits.maxMonthlyCost"
              (ngModelChange)="d().setCost($event)"
              aria-label="Spend ceiling per month"
              data-testid="max-monthly"
            />
            <span class="text-[12px] text-muted-foreground">per month</span>
          </span>
        } @else {
          <span class="text-muted-foreground" data-testid="cost-not-applicable"
            >—</span
          >
        }
      </td>
      <td [class]="t.tdMuted">
        @if (capWarning(); as warning) {
          <span
            class="flex items-start gap-2 text-destructive"
            data-testid="cap-warning"
          >
            <ng-icon
              name="lucideTriangleAlert"
              class="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{{ warning }}</span>
          </span>
        } @else if (d().hasCatalogue()) {
          In currency, not in node count.
        } @else {
          <app-explain
            [floating]="true"
            label="Nothing to cap."
            labelClass="text-[12px] text-muted-foreground"
            testid="cost-why"
          >
            Flui never sees a bill for your own machines.
          </app-explain>
        }
      </td>
    </tr>
  `,
})
export class GroupCatalogueRowsComponent {
  private readonly catalogue = inject(GroupChoicesService);
  private readonly store = inject(ScalingGroupStore);

  /**
   * Said where the cap cannot pay for a single purchase.
   *
   * The cap is weighed against the fleet's whole monthly bill, not against one
   * machine, so a figure that looks generous next to a price list can still
   * refuse everything once what is already running is counted.
   */
  protected readonly capWarning = computed<string | null>(() => {
    const cap = this.draft().group().limits.maxMonthlyCost;
    if (cap === null) return null;

    const shapes = this.draft().group().shapes;
    const priced = shapes
      .map((shape) => this.listed().get(shape)?.monthlyEur)
      .filter((v): v is number => typeof v === 'number');
    const cheapest = priced.length
      ? Math.min(...priced)
      : this.catalogue.cheapestMonthly(this.draft().provider(), shapes);
    if (cheapest === null) return null;

    const committed = this.store.row().data?.monthlyEur ?? 0;
    if (committed + cheapest <= cap) return null;

    const running = committed
      ? `The fleet already costs €${committed.toFixed(0)} a month and the `
      : 'The ';
    return `${running}cheapest machine this group may buy adds €${cheapest.toFixed(0)}, so nothing can be bought under €${cap}.`;
  });

  constructor() {
    effect(() => void this.catalogue.load(this.draft().provider()));
  }

  protected readonly regionChoices = computed(() =>
    this.catalogue.regionChoices(
      this.draft().provider(),
      this.draft().buyableRegions(),
    ),
  );

  /**
   * The machines as the API prices them — the price the spend ceiling counts.
   * The wizard's catalogue stays the fallback for a shape the API did not read.
   */
  private readonly listed = computed(
    () =>
      new Map(
        (this.store.catalogue().data?.shapes ?? [])
          .filter((s) => s.facts)
          .map((s) => [s.shape, s.facts!]),
      ),
  );

  protected readonly machineChoices = computed(() =>
    this.catalogue
      .machineChoices(this.draft().provider(), this.draft().group().regions)
      ?.map((choice) => {
        const spec = this.listed().get(choice.value);
        return spec ? { ...choice, note: specNote(spec) } : choice;
      }) ?? null,
  );

  protected readonly labels = computed(() => {
    const out = { ...this.catalogue.labels(this.draft().provider()) };
    for (const [shape, spec] of this.listed()) out[shape] = specNote(spec);
    return out;
  });

  readonly draft = input.required<GroupDraft>();

  protected readonly t = TABLE;
  protected readonly strategies = STRATEGIES;

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());
}

function specNote(spec: ShapeSpec): string {
  const monthly = spec.monthlyEur === null ? '' : ` · €${spec.monthlyEur.toFixed(2)}/mo`;
  return `${spec.cores} vCPU · ${Math.round(spec.memoryMi / 1024)} GB${monthly}`;
}
