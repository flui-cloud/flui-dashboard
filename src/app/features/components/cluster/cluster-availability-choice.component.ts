import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { HaPlanResponseDto } from '../../../core/api/model/haPlanResponseDto';
import { HaPlanServerDto } from '../../../core/api/model/haPlanServerDto';
import { ClusterService } from '../../service/cluster.service';
import { PricingService } from '../../../shared/services/pricing.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
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
  imports: [FlAlert, FlButton, FlStatus, FlTable],
  template: `
    @if (visible()) {
      <fieldset
        class="fl-fieldset border-t border-fl-border pt-4"
        data-testid="availability-choice"
      >
        <legend>Availability</legend>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="fl-radiocard" data-testid="availability-standard">
            <input
              type="radio"
              name="cluster-availability"
              [checked]="!highlyAvailable()"
              (change)="choose('standard')"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">Standard</span>
              <span class="fl-radiocard__desc">Servers in one location</span>
            </span>
          </label>
          <label class="fl-radiocard" data-testid="availability-three-locations">
            <input
              type="radio"
              name="cluster-availability"
              [checked]="highlyAvailable()"
              (change)="choose('three-locations')"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">High availability, three locations</span>
              <span class="fl-radiocard__desc">Keeps running if a location goes down</span>
            </span>
          </label>
        </div>

        @if (highlyAvailable()) {
          <div class="flex flex-col gap-4">
            @if (fallbackCandidates().length > 0) {
              <div class="flex flex-col gap-2">
                <span class="text-fl-body-sm font-medium">
                  Other sizes to try, in order
                  <span class="font-normal text-fl-ink-muted">(optional)</span>
                </span>
                <div class="fl-row gap-4" data-testid="ha-fallbacks">
                  @for (size of fallbackCandidates(); track size.id) {
                    <label class="fl-check">
                      <input
                        type="checkbox"
                        [checked]="fallbackOrder(size.id) > 0"
                        [attr.data-testid]="'ha-fallback-' + size.id"
                        (change)="toggleFallback(size.id)"
                      />
                      <span class="fl-mono">{{ size.name }}</span>
                      @if (fallbackOrder(size.id) > 0) {
                        <span class="fl-num text-fl-ink-muted">{{ fallbackOrder(size.id) }}</span>
                      }
                    </label>
                  }
                </div>
              </div>
            }

            @if (loading()) {
              <fl-status tone="progress" label="Checking the three locations" />
            } @else if (plan(); as p) {
              @if (p.possible) {
                <div class="fl-table-wrap rounded-fl-lg border border-fl-border">
                  <table flTable density="dense" data-testid="ha-plan">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Role</th>
                        <th scope="col">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (server of p.servers; track server.zone) {
                        <tr data-testid="ha-plan-server">
                          <td>
                            <span class="fl-mono">{{ server.zone }}</span>
                            @if (server.first) {
                              <span class="ml-2 text-fl-ink-muted" data-testid="ha-plan-first"
                                >Joins first</span
                              >
                            }
                          </td>
                          <td>
                            {{ server.role === 'data' ? 'Holds copies of data' : 'Only votes' }}
                          </td>
                          <td class="fl-mono">{{ server.shape }}</td>
                        </tr>
                      }
                      @for (zone of p.later; track zone) {
                        <tr data-testid="ha-plan-later">
                          <td class="fl-mono">{{ zone }}</td>
                          <td colspan="2"><fl-status tone="warning" label="Added later" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (p.measured === false) {
                  <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="ha-plan-unmeasured">
                    The provider declares these as close zones of one region; Flui has not measured
                    them yet.
                  </p>
                }
                @if (monthlyCost(); as cost) {
                  <p
                    class="m-0 fl-num text-fl-body-sm text-fl-ink-muted"
                    data-testid="ha-plan-cost"
                  >
                    ~€{{ cost }}/month for {{ p.servers.length }} servers
                  </p>
                }
              } @else {
                <fl-alert tone="error" title="Three locations are not possible with these sizes">
                  <span data-testid="ha-refusal">{{ p.refusal }}</span>
                </fl-alert>
              }
              @if (p.completeLaterHelps || completeLater()) {
                <label class="fl-check">
                  <input
                    type="checkbox"
                    data-testid="ha-complete-later"
                    [checked]="completeLater()"
                    (change)="setCompleteLater($any($event.target).checked)"
                  />
                  Create in the locations that have it and add the rest later
                </label>
              }
            }

            <div class="flex flex-col items-start gap-1">
              <button
                flButton="ghost"
                size="sm"
                type="button"
                [attr.aria-expanded]="showWhy()"
                (click)="showWhy.set(!showWhy())"
              >
                {{ showWhy() ? 'Hide details' : 'Why three locations?' }}
              </button>
              @if (showWhy()) {
                <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                  One server in each location, joined one at a time. A location that holds copies of
                  data keeps one copy of your data, the others only vote, so the cluster keeps
                  working when one location is lost. Add more servers once it is ready.
                </p>
              }
            </div>
          </div>
        }
      </fieldset>
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
    return answer?.provider === this.provider() && answer?.region === this.region() ? answer : null;
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

  private sizeFor(zone: string, shape: string): ServerTypeOption | undefined {
    const matches = (s: ServerTypeOption) => s.name === shape || s.id === shape;
    return (
      this.wizardService.serverTypesData()[`${this.provider()}:${zone}`]?.find(matches) ??
      this.sizesHere().find(matches)
    );
  }
}
