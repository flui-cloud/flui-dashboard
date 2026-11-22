import { Component, computed, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { STRATEGIES } from '../../model/scaling-group.models';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlAlert } from '../../../ui/patterns/alert';
import { GroupChoicesService } from './group-choices.service';
import { ScalingGroupStore } from './scaling-group.store';
import { GroupDraft } from './group-draft';
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
  selector: 'app-group-catalogue-rows',
  imports: [ExplainComponent, FormsModule, FlAlert, SettingsListEditorComponent],
  host: { class: 'flex flex-col gap-5' },
  template: `
    @if (d().hasCatalogue()) {
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="fl-field" data-testid="row-regions">
          <app-explain
            [floating]="true"
            label="Where it may add nodes"
            labelClass="fl-field__label"
            testid="regions-why"
          >
            More than one region is what opens "cheapest, anywhere", and what lets it find a machine
            when the cluster's own region is out.
          </app-explain>
          <app-settings-list-editor
            kind="region"
            emptyNote="Nowhere to add nodes"
            exhausted="This cluster's network reaches no other region"
            [items]="g().regions"
            [choices]="regionChoices()"
            [labels]="labels()"
            (add)="d().addRegion($event)"
            (remove)="d().removeRegion($event)"
          />
        </div>

        <div class="fl-field" data-testid="row-shapes">
          <span class="fl-field__label">What it may add</span>
          <app-settings-list-editor
            kind="machine"
            [choices]="machineChoices()"
            [labels]="labels()"
            emptyNote="Nothing to add"
            [ordered]="true"
            [architectures]="architectures()"
            [items]="g().shapes"
            (add)="d().addShape($event)"
            (remove)="d().removeShape($event)"
            (move)="d().moveShape($event)"
          />
          <span class="fl-field__hint">In order of preference: the first is tried first.</span>
        </div>
      </div>
    } @else {
      <fieldset class="fl-fieldset" data-testid="row-requirement">
        <legend>
          <app-explain
            [floating]="true"
            label="What a machine has to hold"
            labelClass="text-fl-body-sm font-semibold"
            testid="requirement-why"
          >
            {{ provider() }} publishes no prices, so the alarm asks for a machine with at least this
            much free and you decide which one.
          </app-explain>
        </legend>
        <div class="grid max-w-md grid-cols-2 gap-3">
          <div class="fl-field">
            <label class="fl-field__label" [for]="'requirement-cpu-' + g().id">vCPU</label>
            <div class="fl-input fl-input--lg">
              <input
                class="fl-mono"
                [id]="'requirement-cpu-' + g().id"
                [ngModel]="g().requirement?.cpu ?? ''"
                (ngModelChange)="d().setRequirement('cpu', $event)"
                data-testid="requirement-cpu"
              />
            </div>
          </div>
          <div class="fl-field">
            <label class="fl-field__label" [for]="'requirement-memory-' + g().id">Memory</label>
            <div class="fl-input fl-input--lg">
              <input
                class="fl-mono"
                [id]="'requirement-memory-' + g().id"
                [ngModel]="g().requirement?.memory ?? ''"
                (ngModelChange)="d().setRequirement('memory', $event)"
                data-testid="requirement-memory"
              />
            </div>
          </div>
        </div>
        <span class="fl-field__hint">What the alarm asks for.</span>
      </fieldset>
    }

    <fieldset class="fl-fieldset" data-testid="row-strategy">
      <legend>How it chooses</legend>
      @if (d().hasCatalogue()) {
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          @for (option of strategies; track option.id) {
            <label class="fl-radiocard" [attr.data-testid]="'strategy-' + option.id">
              <input
                type="radio"
                [name]="'strategy-' + g().id"
                [checked]="g().strategy === option.id"
                (change)="d().setStrategy(option.id)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">{{ option.label }}</span>
                <span class="fl-radiocard__desc">Optimises {{ option.optimises }}</span>
              </span>
            </label>
          }
        </div>
        <span class="fl-field__hint">
          Only among machines that already fit. One that is too small is never a candidate, whatever
          it costs.
        </span>
      } @else {
        <span class="text-fl-body-sm font-medium" data-testid="strategy-inert">
          {{ d().chosenStrategy()?.label ?? g().strategy }}
        </span>
        <span class="fl-field__hint">
          With no catalogue there is nothing to choose between: every node here is whatever was
          attached.
        </span>
      }
      @if (d().chosenStrategy(); as picked) {
        <span class="text-fl-body-sm" data-testid="strategy-when">{{ picked.when }}</span>
      }
    </fieldset>

    <div class="fl-field" data-testid="row-cost">
      <app-explain
        [floating]="true"
        label="Spending ceiling"
        labelClass="fl-field__label"
        testid="cap-why"
      >
        The safety net under the node limits. Before every node is added the fleet's whole monthly
        list price is weighed against it, not one machine: what is already running counts. Required
        to add nodes automatically; set it above the worst case below and it only ever stops a
        runaway.
      </app-explain>
      @if (d().hasCatalogue()) {
        <div class="fl-input fl-input--lg max-w-xs">
          <span class="text-fl-body-sm">€</span>
          <input
            type="number"
            min="0"
            step="1"
            class="fl-mono"
            placeholder="None"
            [ngModel]="g().limits.maxMonthlyCost"
            (ngModelChange)="d().setCost($event)"
            aria-label="Spending ceiling per month"
            data-testid="max-monthly"
          />
          <span class="text-fl-caption">per month</span>
        </div>
        @if (!capWarning()) {
          <span class="fl-field__hint"
            >Safety net: never passed, whatever the node limits allow.</span
          >
        }
      } @else {
        <span class="text-fl-ink-muted" data-testid="cost-not-applicable">—</span>
        <app-explain
          [floating]="true"
          label="Nothing to cap"
          labelClass="text-fl-caption text-fl-ink-muted"
          testid="cost-why"
        >
          Flui never sees a bill for your own machines.
        </app-explain>
      }
      @if (capWarning(); as warning) {
        <fl-alert tone="warning" title="Nothing can be added" data-testid="cap-warning">
          {{ warning }}
        </fl-alert>
      }
    </div>
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
      ? `The fleet already costs €${committed.toFixed(2)} a month and the `
      : 'The ';
    return `${running}cheapest machine this group may add costs €${cheapest.toFixed(2)}, so nothing can be added under a spending ceiling of €${cap.toFixed(2)}.`;
  });

  constructor() {
    effect(() => void this.catalogue.load(this.draft().provider()));
  }

  protected readonly regionChoices = computed(() =>
    this.catalogue.regionChoices(this.draft().provider(), this.draft().buyableRegions()),
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

  protected readonly machineChoices = computed(
    () =>
      this.catalogue
        .machineChoices(this.draft().provider(), this.draft().group().regions)
        ?.map((choice) => {
          const spec = this.listed().get(choice.value);
          return spec ? { ...choice, note: specNote(spec) } : choice;
        }) ?? null,
  );

  protected readonly architectures = computed(() => {
    const out: Record<string, string | null> = {
      ...this.catalogue.architectures(this.draft().provider()),
    };
    for (const shape of this.store.catalogue().data?.shapes ?? []) {
      if (shape.architecture) out[shape.shape] = shape.architecture;
    }
    return out;
  });

  protected readonly labels = computed(() => {
    const out = { ...this.catalogue.labels(this.draft().provider()) };
    for (const [shape, spec] of this.listed()) out[shape] = specNote(spec);
    return out;
  });

  readonly draft = input.required<GroupDraft>();

  protected readonly strategies = STRATEGIES;

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());
}

function specNote(spec: ShapeSpec): string {
  const monthly = spec.monthlyEur === null ? '' : ` · €${spec.monthlyEur.toFixed(2)}/mo`;
  return `${spec.cores} vCPU · ${Math.round(spec.memoryMi / 1024)} GB${monthly}`;
}
