import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader, lucideShieldCheck } from '@ng-icons/lucide';
import { HaPlanResponseDto } from '../../../core/api/model/haPlanResponseDto';
import { HaPlanServerDto } from '../../../core/api/model/haPlanServerDto';
import { ClusterService } from '../../service/cluster.service';
import { PricingService } from '../../../shared/services/pricing.service';
import {
  ProviderWizardService,
  ServerTypeOption,
} from '../../../shared/services/provider-wizard.service';

export type AvailabilityLevel = 'standard' | 'three-locations';

export interface AvailabilityDraft {
  level: AvailabilityLevel;
  fallbacks: string[];
  completeLater: boolean;
}

export interface AvailabilityChoice {
  level: AvailabilityLevel;
  shapes: string[];
  completeLater: boolean;
  servers: HaPlanServerDto[];
  later: string[];
  pricePerHour: number | null;
  ready: boolean;
}

export const STANDARD_DRAFT: AvailabilityDraft = {
  level: 'standard',
  fallbacks: [],
  completeLater: false,
};

export const STANDARD_AVAILABILITY: AvailabilityChoice = {
  level: 'standard',
  shapes: [],
  completeLater: false,
  servers: [],
  later: [],
  pricePerHour: null,
  ready: true,
};

const PLAN_DEBOUNCE_MS = 300;

interface PlanAnswer {
  key: string;
  provider: string;
  region: string;
  plan: HaPlanResponseDto | null;
}

@Component({
  selector: 'cluster-availability-choice',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideLoader, lucideShieldCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="border-t pt-6" data-testid="availability-choice">
        <h3 class="font-medium mb-4 flex items-center">
          <ng-icon name="lucideShieldCheck" class="h-5 w-5 mr-2" />
          Availability
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
          <button
            type="button"
            (click)="choose('standard')"
            [class]="cardClass(!highlyAvailable())"
            data-testid="availability-standard"
          >
            <span class="font-medium">Standard</span>
            <span class="mt-1 text-xs text-muted-foreground">Servers in one location</span>
          </button>
          <button
            type="button"
            (click)="choose('three-locations')"
            [class]="cardClass(highlyAvailable())"
            data-testid="availability-three-locations"
          >
            <span class="font-medium">High availability · three locations</span>
            <span class="mt-1 text-xs text-muted-foreground">Keeps running if a location goes down</span>
          </button>
        </div>

        @if (highlyAvailable()) {
          <div class="mt-4 space-y-4 max-w-3xl">
            @if (fallbackCandidates().length > 0) {
              <div>
                <p class="text-sm font-medium">
                  Other sizes to try, in order
                  <span class="text-muted-foreground font-normal">(optional)</span>
                </p>
                <div class="flex flex-wrap gap-2 mt-2" data-testid="ha-fallbacks">
                  @for (size of fallbackCandidates(); track size.id) {
                    <button
                      type="button"
                      (click)="toggleFallback(size.id)"
                      [class]="chipClass(fallbackOrder(size.id) > 0)"
                      [attr.data-testid]="'ha-fallback-' + size.id"
                    >
                      @if (fallbackOrder(size.id) > 0) {
                        <span class="font-semibold">{{ fallbackOrder(size.id) }}</span>
                      }
                      {{ size.name }}
                    </button>
                  }
                </div>
              </div>
            }

            @if (loading()) {
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
                Checking the three locations…
              </div>
            } @else if (plan(); as p) {
              @if (p.possible) {
                <ul class="rounded-lg border border-border divide-y divide-border text-sm" data-testid="ha-plan">
                  @for (server of p.servers; track server.zone) {
                    <li class="grid grid-cols-3 items-center gap-3 px-3 py-2" data-testid="ha-plan-server">
                      <span class="flex items-center gap-2">
                        <span class="font-mono">{{ server.zone }}</span>
                        @if (server.first) {
                          <span class="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary" data-testid="ha-plan-first">first</span>
                        }
                      </span>
                      <span class="text-muted-foreground">{{ server.role === 'data' ? 'copies of data' : 'votes' }}</span>
                      <span class="font-mono text-right">{{ server.shape }}</span>
                    </li>
                  }
                  @for (zone of p.later; track zone) {
                    <li class="grid grid-cols-3 items-center gap-3 px-3 py-2" data-testid="ha-plan-later">
                      <span class="font-mono">{{ zone }}</span>
                      <span class="col-span-2 text-amber-600 dark:text-amber-400">added later</span>
                    </li>
                  }
                </ul>
                @if (p.measured === false) {
                  <p class="text-xs text-muted-foreground" data-testid="ha-plan-unmeasured">
                    The provider declares these as close zones of one region; Flui has not measured them yet.
                  </p>
                }
                @if (monthlyCost(); as cost) {
                  <p class="text-xs text-muted-foreground" data-testid="ha-plan-cost">
                    ~€{{ cost }}/month for {{ p.servers.length }} servers
                  </p>
                }
              } @else {
                <p class="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="ha-refusal">
                  {{ p.refusal }}
                </p>
              }
              @if (p.completeLaterHelps || completeLater()) {
                <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    [checked]="completeLater()"
                    (change)="setCompleteLater($any($event.target).checked)"
                    class="h-4 w-4 rounded border-input"
                    data-testid="ha-complete-later"
                  />
                  Create in the locations that have it and add the rest later
                </label>
              }
            }

            <div>
              <button
                type="button"
                (click)="showWhy.set(!showWhy())"
                class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {{ showWhy() ? 'Hide details' : 'Why three locations?' }}
              </button>
              @if (showWhy()) {
                <p class="mt-1 text-xs text-muted-foreground leading-relaxed">
                  One server in each location, joined one at a time. Each location marked copies
                  of data keeps one copy of your data, any other only votes, so the cluster keeps
                  working when one location is lost. Add more servers once it is ready.
                </p>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ClusterAvailabilityChoiceComponent {
  private readonly clusterService = inject(ClusterService);
  private readonly wizardService = inject(ProviderWizardService);
  private readonly pricingService = inject(PricingService);

  readonly provider = input.required<string>();
  readonly region = input.required<string>();
  readonly serverTypeId = input.required<string>();
  readonly draft = model<AvailabilityDraft>(STANDARD_DRAFT);
  readonly changed = output<AvailabilityChoice>();

  readonly showWhy = signal(false);
  private readonly answer = signal<PlanAnswer | null>(null);

  readonly highlyAvailable = computed(() => this.draft().level === 'three-locations');
  readonly completeLater = computed(() => this.draft().completeLater);

  private readonly sizesHere = computed<ServerTypeOption[]>(
    () => this.wizardService.serverTypesData()[`${this.provider()}:${this.region()}`] ?? [],
  );

  readonly fallbackCandidates = computed(() => {
    const chosen = this.sizesHere().find((s) => s.id === this.serverTypeId());
    if (!chosen) return [];
    return this.sizesHere().filter(
      (s) => s.id !== chosen.id && s.architecture === chosen.architecture,
    );
  });

  private readonly fallbacks = computed(() =>
    this.draft().fallbacks.filter((id) => this.fallbackCandidates().some((s) => s.id === id)),
  );

  readonly shapes = computed(() =>
    this.serverTypeId() ? [this.serverTypeId(), ...this.fallbacks()] : [],
  );

  private readonly query = computed(() => {
    const provider = this.provider();
    const region = this.region();
    if (!provider || !region || !this.serverTypeId()) return null;
    return {
      provider,
      region,
      shapes: this.shapes(),
      completeLater: this.completeLater(),
    };
  });

  private readonly queryKey = computed(() => {
    const query = this.query();
    return query ? JSON.stringify(query) : null;
  });

  private readonly answerHere = computed(() => {
    const answer = this.answer();
    return answer?.provider === this.provider() && answer?.region === this.region()
      ? answer
      : null;
  });

  readonly loading = computed(() => {
    const key = this.queryKey();
    return key !== null && this.answer()?.key !== key;
  });

  readonly plan = computed(() => this.answerHere()?.plan ?? null);

  readonly visible = computed(
    () => !!this.plan()?.layoutAvailable || (this.highlyAvailable() && this.loading()),
  );

  private readonly pricePerHour = computed(() => {
    const plan = this.plan();
    if (!plan?.possible || !plan.servers.length) return null;
    let total = 0;
    for (const server of plan.servers) {
      const size = this.sizeFor(server.zone, server.shape);
      if (!size) return null;
      total += size.pricePerHour;
    }
    return total;
  });

  readonly monthlyCost = computed(() => {
    const hourly = this.pricePerHour();
    return hourly === null ? null : this.pricingService.formatMonthlyPrice(hourly);
  });

  readonly choice = computed<AvailabilityChoice>(() => {
    if (!this.highlyAvailable()) return STANDARD_AVAILABILITY;
    const plan = this.loading() ? null : this.plan();
    const base = {
      level: 'three-locations' as const,
      shapes: this.shapes(),
      completeLater: this.completeLater(),
    };
    if (!plan?.possible) {
      return { ...base, servers: [], later: [], pricePerHour: null, ready: false };
    }
    return {
      ...base,
      servers: plan.servers,
      later: plan.later,
      pricePerHour: this.pricePerHour(),
      ready: true,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const query = this.query();
      const key = this.queryKey();
      if (!query || !key) return;
      const timer = setTimeout(() => {
        const settle = (plan: HaPlanResponseDto | null) => {
          if (this.queryKey() !== key) return;
          this.answer.set({ key, provider: query.provider, region: query.region, plan });
        };
        this.clusterService.highAvailabilityPlan(query).then(settle, () => settle(null));
      }, PLAN_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      const answer = this.answerHere();
      if (answer && !answer.plan?.layoutAvailable && this.highlyAvailable()) {
        this.draft.set(STANDARD_DRAFT);
      }
    });

    effect(() => this.changed.emit(this.choice()));
  }

  choose(level: AvailabilityLevel): void {
    this.draft.update((d) => ({ ...d, level }));
  }

  toggleFallback(id: string): void {
    this.draft.update((d) => ({
      ...d,
      fallbacks: d.fallbacks.includes(id)
        ? d.fallbacks.filter((f) => f !== id)
        : [...d.fallbacks, id],
    }));
  }

  fallbackOrder(id: string): number {
    return this.fallbacks().indexOf(id) + 1;
  }

  setCompleteLater(completeLater: boolean): void {
    this.draft.update((d) => ({ ...d, completeLater }));
  }

  cardClass(active: boolean): string {
    const base = 'flex flex-col items-start rounded-lg border p-4 text-left transition w-full hover:bg-accent/40';
    return active ? `${base} border-primary bg-primary/5` : `${base} border-border`;
  }

  chipClass(active: boolean): string {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono transition-colors';
    return active
      ? `${base} border-primary bg-primary/10 text-foreground`
      : `${base} border-border text-muted-foreground hover:text-foreground hover:border-foreground/30`;
  }

  private sizeFor(zone: string, shape: string): ServerTypeOption | undefined {
    const matches = (s: ServerTypeOption) => s.name === shape || s.id === shape;
    return (
      this.wizardService.serverTypesData()[`${this.provider()}:${zone}`]?.find(matches) ??
      this.sizesHere().find(matches)
    );
  }
}
