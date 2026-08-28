import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBan,
  lucideBell,
  lucideCircleCheck,
  lucideCircleDashed,
  lucideEuro,
  lucidePause,
} from '@ng-icons/lucide';
import { ExplainComponent } from '../../../shared/components/explain.component';
import {
  LadderRung,
  STRATEGIES,
  ScalingPreview,
} from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { ScalingGroupStore } from './scaling-group.store';
import { TABLE, eurHour, heldFor, readingAge } from './now-format';
import {
  SectionFailureComponent,
  SectionSkeletonComponent,
} from './section-states.component';

const EMPTY_PREVIEW: ScalingPreview = {
  pending: null,
  opportunityHeldBecause: null,
  ladder: [],
  chosen: null,
  asks: null,
};

interface LadderRow {
  rung: LadderRung;
  chosen: boolean;
  offer: string;
  verdict: string;
  why: string;
  icon: string;
  tone: string;
}

@Component({
  selector: 'app-scaling-now-ladder',
  standalone: true,
  imports: [
    NgIcon,
    ExplainComponent,
    SectionFailureComponent,
    SectionSkeletonComponent,
  ],
  providers: [
    provideIcons({
      lucideBan,
      lucideBell,
      lucideCircleCheck,
      lucideCircleDashed,
      lucideEuro,
      lucidePause,
    }),
  ],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-2" data-testid="ladder">
      <h2 class="text-label m-0">If a node were needed now</h2>

      @if (loading()) {
        <app-section-skeleton
          variant="table"
          [count]="3"
          label="the urgency ladder"
          testid="ladder"
        />
      } @else if (failed()) {
        <app-section-failure [message]="failed() ?? ''" testid="ladder" (retry)="store.reload()" />
      } @else {
        <div [class]="t.card">
          <div [class]="t.scroll">
            <table [class]="t.table">
              <caption [class]="t.captionTop" data-testid="ladder-caption">
                {{ caption() }}
              </caption>
              <thead>
                <tr [class]="t.headRow">
                  <th scope="col" [class]="t.th + ' pl-2'">What it tries, in order</th>
                  @if (hasCatalogue()) {
                    <th scope="col" [class]="t.th">Shape · region · price</th>
                  } @else {
                    <th scope="col" [class]="t.th">Asks for</th>
                  }
                  <th scope="col" [class]="t.th">
                    <app-explain
                      label="Verdict"
                      labelClass="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      testid="verdict-why"
                    >
                      Fitting is a precondition, not a preference: a shape that
                      cannot hold the pending pod is not a candidate at all,
                      whatever it costs.
                    </app-explain>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.rung.step) {
                  <tr
                    [class]="t.row"
                    [attr.aria-current]="row.chosen ? 'true' : null"
                    [attr.data-testid]="'rung-' + row.rung.step"
                    [attr.data-outcome]="row.rung.outcome"
                  >
                    <th
                      scope="row"
                      [class]="
                        t.td +
                        ' border-l-2 pl-2 ' +
                        (row.chosen
                          ? 'border-l-primary font-medium'
                          : 'border-l-transparent font-normal text-muted-foreground')
                      "
                    >
                      {{ row.rung.step }}. {{ row.rung.describes }}
                    </th>
                    @if (hasCatalogue()) {
                      <td [class]="t.td">
                        @if (row.offer) {
                          <span [class]="t.mono + ' tabular-nums'">{{ row.offer }}</span>
                        }
                      </td>
                    } @else {
                      <td [class]="t.td" data-testid="rung-requirement">
                        <span [class]="t.mono">{{ requirement() }}</span>
                      </td>
                    }
                    <td [class]="t.td">
                      <span class="flex flex-col gap-0.5">
                        <span
                          class="inline-flex items-center gap-1.5 text-[13px] font-medium"
                          [class]="row.tone"
                          [attr.data-testid]="'rung-outcome-' + row.rung.step"
                        >
                          <ng-icon [name]="row.icon" class="h-4 w-4" />
                          {{ row.verdict }}
                        </span>
                        <span [class]="t.note" [attr.data-testid]="'rung-why-' + row.rung.step">
                          {{ row.why }}
                        </span>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (hasCatalogue()) {
            <p [class]="t.note + ' mt-2'" data-testid="catalogue-age">
              Every price above is one catalogue reading, {{ age() }}. Nothing
              here is live.
            </p>
          }
        </div>

        @if (asks(); as sentence) {
          <p class="m-0 max-w-prose text-[13px] text-muted-foreground" data-testid="ladder-asks">
            {{ sentence }}
          </p>
        }
      }
    </section>
  `,
})
export class ScalingNowLadderComponent {
  protected readonly store = inject(ScalingGroupStore);

  readonly group = input.required<SectionGroup>();

  protected readonly t = TABLE;

  protected readonly loading = computed(() => this.store.preview().loading);
  protected readonly failed = computed(() => this.store.preview().failed);

  private readonly preview = computed<ScalingPreview>(
    () => this.store.preview().data ?? EMPTY_PREVIEW,
  );
  private readonly outlook = computed(() => this.store.outlook());
  private readonly manual = computed(() => !this.group().capability.canProvision);

  private readonly withheld = computed(
    () => this.group().capability.canProvision && !this.group().acts.acts,
  );

  protected readonly hasCatalogue = computed(() => this.group().capability.hasCatalogue);

  protected readonly requirement = computed(() => {
    const req = this.group().requirement;
    return req ? `≥ ${req.cpu} vCPU · ${req.memory} free` : 'a machine that holds the shortfall';
  });

  protected readonly caption = computed(() => {
    const group = this.group();
    const pod = this.preview().pending;
    const strategy = STRATEGIES.find((s) => s.id === group.strategy);

    const against = pod
      ? `Measured against ${pod.cpu} · ${pod.memory}.`
      : 'Nothing is pending — this is the ladder the next stuck pod would meet.';

    if (!this.hasCatalogue()) {
      return `${against} ${group.provider} publishes no catalogue, so no rung can name a shape or a price. What the alarm asks for is the group's own requirement.`;
    }

    const picks = strategy
      ? `Among the shapes that fit, it picks for ${strategy.optimises} (${strategy.label.toLowerCase()}).`
      : '';
    const ends = this.manual()
      ? `${group.provider} has no API to create servers, so every rung ends in an alarm — one that still names a shape and a price, because the catalogue is there to read.`
      : 'Tried in order, in one pass — no rung waits for a better price.';

    return `${against} ${picks} ${ends}`;
  });

  protected readonly asks = computed<string | null>(() => {
    if (this.preview().chosen || !this.hasCatalogue()) return null;

    const written = this.preview().asks;
    if (written) return written;

    const named = this.preview()
      .ladder.filter((r) => r.shape !== null)
      .map((r) => `${r.shape}${r.region ? ' in ' + r.region : ''}`);

    return named.length
      ? `No rung wins, so nothing is bought. The alarm still names what would have been bought — ${named.join(' or ')} — because the catalogue is readable even where the create API is not.`
      : 'No rung wins, so nothing is bought and the alarm carries no shape.';
  });

  protected readonly rows = computed<LadderRow[]>(() => {
    const chosenStep = this.preview().chosen?.step ?? null;

    return this.preview().ladder.map((rung) => ({
      rung,
      chosen: rung.step === chosenStep,
      offer: this.offer(rung),
      verdict: this.verdict(rung),
      why: this.why(rung),
      icon: this.icon(rung.outcome),
      tone: this.tone(rung, rung.step === chosenStep),
    }));
  });

  protected readonly age = computed(() => {
    const catalogue = this.store.catalogue();
    if (catalogue.failed) return 'and the catalogue could not be read just now';
    return readingAge(catalogue.data?.ageSeconds ?? null);
  });

  private offer(rung: LadderRung): string {
    if (!rung.shape) return '';
    const where = rung.region ? ` · ${rung.region}` : '';
    return `${rung.shape}${where} · ${eurHour(rung.hourlyEur)}`;
  }

  private verdict(rung: LadderRung): string {
    switch (rung.outcome) {
      case 'would-buy':
        if (this.manual()) return 'Would alert';
        return this.withheld() ? 'Wins, buys nothing' : 'Would buy';
      case 'unavailable':
        return 'Unavailable';
      case 'does-not-fit':
        return 'Does not fit';
      case 'over-budget':
        return 'Over budget';
      case 'refused-by-limit':
        return 'Refused by a limit';
      case 'alert':
        return 'Alerts you';
    }
  }

  private why(rung: LadderRung): string {
    const group = this.group();

    switch (rung.outcome) {
      case 'would-buy':
        return this.whyWouldBuy();
      case 'unavailable':
        return this.whyUnavailable(rung);
      case 'does-not-fit': {
        const pod = this.preview().pending;
        return pod
          ? `Cannot hold ${pod.memory} — not a candidate.`
          : 'Cannot hold the pending pod — not a candidate.';
      }
      case 'over-budget': {
        const cap = group.limits.maxMonthlyCost;
        return cap === null ? 'Over the cost limit.' : `Would take the fleet past €${cap}/month.`;
      }
      case 'refused-by-limit':
        return rung.note ?? "The group's own rules exclude it.";
      case 'alert':
        return this.whyAlert();
    }
  }

  private whyWouldBuy(): string {
    if (this.manual()) {
      return 'Fits and is available — but nothing here can buy it.';
    }
    return this.withheld()
      ? 'Fits, available, inside the ceiling — and this group buys nothing.'
      : 'Fits, available, inside the ceiling.';
  }

  private whyUnavailable(rung: LadderRung): string {
    const state = rung.shape ? this.outlook()[rung.shape] : undefined;
    const where = state?.downIn.length ? `down in ${state.downIn.join(', ')}` : 'not on offer';
    const since = state?.sinceHours ? ` for ${heldFor(state.sinceHours)}` : '';
    return `${where}${since}.`;
  }

  private whyAlert(): string {
    if (this.hasCatalogue()) {
      return 'Nothing left below. Flui names the shape and stops.';
    }
    const req = this.group().requirement;
    return req
      ? `A machine with at least ${req.cpu} vCPU and ${req.memory} free. That requirement is the whole of the alarm.`
      : 'Another machine. Nothing here can name a shape.';
  }

  private icon(outcome: LadderRung['outcome']): string {
    switch (outcome) {
      case 'would-buy':
        return this.withheld() ? 'lucidePause' : 'lucideCircleCheck';
      case 'unavailable':
        return 'lucideCircleDashed';
      case 'does-not-fit':
      case 'refused-by-limit':
        return 'lucideBan';
      case 'over-budget':
        return 'lucideEuro';
      case 'alert':
        return 'lucideBell';
    }
  }

  private tone(rung: LadderRung, chosen: boolean): string {
    if (rung.outcome === 'alert') return 'text-amber-600 dark:text-amber-400';
    if (chosen && this.withheld()) return 'text-foreground';
    return chosen ? 'status-healthy' : 'text-muted-foreground';
  }
}
