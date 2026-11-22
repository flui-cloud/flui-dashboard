import { Component, computed, input, output } from '@angular/core';
import { ClusterScalingRow } from '../../model/scaling-section.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-scaling-growth-card',
  imports: [FlPanel, FlStatus, FlUsageBar, FlButton],
  host: { class: 'block' },
  template: `
    <fl-panel title="How this cluster grows" data-testid="growth-card">
      <div panelActions class="fl-row">
        @if (row()?.mode; as mode) {
          <fl-status
            [tone]="mode.attention ? 'warning' : 'neutral'"
            [label]="mode.label"
            data-testid="growth-mode"
          />
        }
        @if (row()?.groupCount === 0) {
          <button
            flButton
            size="sm"
            type="button"
            (click)="editLimits.emit()"
            data-testid="edit-limits"
          >
            Edit limits
          </button>
          <button
            flButton="primary"
            size="sm"
            type="button"
            (click)="setUp.emit()"
            data-testid="set-up-scaling"
          >
            Set up scaling
          </button>
        } @else {
          <button
            flButton
            size="sm"
            type="button"
            (click)="setUp.emit()"
            data-testid="edit-scaling"
          >
            Edit
          </button>
        }
      </div>

      <div class="flex flex-col gap-4">
        <p class="m-0 max-w-prose text-fl-body" data-testid="growth-sentence">{{ sentence() }}</p>

        @if (nodeUse() || spendUse()) {
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            @if (nodeUse(); as use) {
              <section class="flex flex-col gap-2" aria-label="Nodes against the ceiling">
                <h3 class="m-0 text-fl-body-sm font-semibold">Nodes against the ceiling</h3>
                <fl-usage-bar
                  [percent]="use.percent"
                  label="Nodes against the ceiling"
                  [aside]="use.aside"
                  [criticalAt]="100"
                />
              </section>
            }
            @if (spendUse(); as use) {
              <section class="flex flex-col gap-2" aria-label="Spend against the ceiling">
                <h3 class="m-0 text-fl-body-sm font-semibold">Spend against the ceiling</h3>
                <fl-usage-bar
                  [percent]="use.percent"
                  label="Spend against the ceiling"
                  [aside]="use.aside"
                />
              </section>
            }
          </div>
        }

        @if (row()?.groupId; as groupId) {
          <a [href]="'/scaling/' + groupId + '/market'" class="fl-link self-start text-fl-body-sm">
            What it would add
          </a>
        }
      </div>
    </fl-panel>
  `,
})
export class ScalingGrowthCardComponent {
  readonly row = input.required<ClusterScalingRow | null>();
  readonly editLimits = output<void>();
  readonly setUp = output<void>();

  protected readonly nodeUse = computed(() => {
    const row = this.row();
    const max = row?.bounds?.max;
    if (!row || !max) return null;
    return {
      percent: (row.nodes / max) * 100,
      aside: `${row.nodes} of ${max} ${max === 1 ? 'node' : 'nodes'}`,
    };
  });

  protected readonly spendUse = computed(() => {
    const row = this.row();
    if (row?.monthlyEur == null || !row.monthlyCap) return null;
    return {
      percent: (row.monthlyEur / row.monthlyCap) * 100,
      aside: `€${row.monthlyEur.toFixed(2)} of €${row.monthlyCap.toFixed(0)} a month`,
    };
  });

  readonly sentence = computed(() => {
    const row = this.row();
    if (!row) return '';

    if (row.groupCount === 0) {
      return row.capability.canProvision
        ? 'Nothing grows it. Flui can add a node on ' +
            row.capability.provider +
            ', but today one appears only when a person adds it.'
        : 'Nothing grows it, and Flui cannot add a node on ' +
            row.capability.provider +
            ': a node appears only when a person adds it.';
    }

    if (row.groupCount > 1) {
      return `This cluster has ${row.groupCount} scaling groups, set up outside the dashboard. Open the scaling section to see them.`;
    }

    if (!row.acts) {
      return row.capability.canProvision
        ? 'Flui names the machine that would fit when an app has nowhere to run, and adds nothing: the group is manual. Switch it to automatic in the scaling section, or add the machine yourself.'
        : 'Flui raises an alarm when an app has nowhere to run, and names the machine that would fit. It cannot add one here.';
    }

    const ceiling = row.bounds ? `up to ${row.bounds.max} nodes` : 'within its limits';
    const cap = row.monthlyCap != null ? ` and €${row.monthlyCap.toFixed(0)} a month` : '';
    return `Flui adds a node when an app has nowhere to run, ${ceiling}${cap}, without asking you, and removes one when the work fits without it. Each node added is a server billed by the provider.`;
  });
}
