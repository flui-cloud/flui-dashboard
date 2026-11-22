import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { ProvisionMode } from '../../model/scaling-group.models';
import { GroupDraft } from './group-draft';

type Bound = 'min' | 'desired' | 'max';

interface BoundField {
  bound: Bound;
  label: string;
  aria: string;
  why: string;
}

const PROVISION: Record<ProvisionMode, { title: string; desc: string }> = {
  automatic: {
    title: 'Automatic',
    desc: 'Adds nodes on its own, inside the node limits and under the spending ceiling.',
  },
  manual: {
    title: 'Manual',
    desc: 'Names a machine and alerts you. A person adds it.',
  },
};

@Component({
  selector: 'app-group-bounds-rows',
  imports: [ExplainComponent, FormsModule],
  host: { class: 'flex flex-col gap-5' },
  template: `
    <fieldset class="fl-fieldset" data-testid="row-provision">
      <legend>
        <app-explain
          [floating]="true"
          label="Provisioning"
          labelClass="text-fl-body-sm font-semibold"
          testid="provision-why"
        >
          @if (d().canProvision()) {
            Automatic stays inside the node limits below, and under the spending ceiling, and never
            asks again.
          } @else {
            Not a choice here: Flui cannot create a machine on
            {{ provider() }}.
          }
        </app-explain>
      </legend>
      @if (d().canProvision()) {
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          @for (mode of provisionModes; track mode) {
            <label class="fl-radiocard" [attr.data-testid]="'provision-' + mode">
              <input
                type="radio"
                [name]="'provision-' + g().id"
                [checked]="g().provision === mode"
                (change)="d().setProvision(mode)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">{{ provision[mode].title }}</span>
                <span class="fl-radiocard__desc">{{ provision[mode].desc }}</span>
              </span>
            </label>
          }
        </div>
      } @else {
        <span class="text-fl-body-sm font-medium" data-testid="provision-fixed">Manual</span>
        <span class="fl-field__hint">Fixed: nothing here can add a machine.</span>
      }
    </fieldset>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      @for (field of bounds; track field.bound) {
        @let problem = d().boundProblems()[field.bound];
        <div
          class="fl-field"
          [class.is-invalid]="!!problem"
          [attr.data-testid]="'row-' + field.bound"
        >
          <app-explain
            [floating]="true"
            [label]="field.label"
            labelClass="fl-field__label"
            [testid]="field.why"
          >
            @switch (field.bound) {
              @case ('min') {
                Below it the installation is broken, so this is the one bound that acts without
                waiting.
              }
              @case ('desired') {
                Nothing is added to reach it: the fleet only drifts back to it when load subsides.
              }
              @default {
                @if (d().canProvision()) {
                  Reached with whatever fits, not with a preferred machine. What it can cost is
                  shown below, from min to max.
                } @else {
                  <span data-testid="max-meaning-manual">
                    Machines arrive by hand here, so going past it is reported rather than
                    prevented.
                  </span>
                }
              }
            }
          </app-explain>
          <div class="fl-input fl-input--lg">
            <input
              type="number"
              min="1"
              max="20"
              class="fl-mono"
              [ngModel]="g().bounds[field.bound]"
              (ngModelChange)="d().setBound(field.bound, $event)"
              [attr.aria-label]="field.aria"
              [attr.aria-invalid]="!!problem"
              [attr.data-testid]="'bound-' + field.bound + '-input'"
            />
          </div>
          @if (problem) {
            <span
              class="fl-field__error"
              role="alert"
              [attr.data-testid]="'bound-' + field.bound + '-error'"
              >{{ problem }}</span
            >
          } @else {
            <span class="fl-field__hint">{{ hint(field.bound) }}</span>
          }
        </div>
      }
    </div>

    <div class="fl-field max-w-xs" data-testid="row-settle">
      <app-explain
        [floating]="true"
        label="Settle window"
        labelClass="fl-field__label"
        testid="settle-why"
      >
        Long enough to be sure the app is really stuck and not just starting. It never waits for a
        cheaper machine.
      </app-explain>
      <div class="fl-input fl-input--lg">
        <input
          type="number"
          min="0"
          max="3600"
          class="fl-mono"
          [ngModel]="g().settleSeconds"
          (ngModelChange)="d().setSettle($event)"
          aria-label="Settle window in seconds"
          data-testid="settle-input"
        />
        <span class="text-fl-caption">seconds</span>
      </div>
      <span class="fl-field__hint">
        How long an app must be stuck before this
        {{ d().canProvision() ? 'adds a node.' : 'alerts.' }}
      </span>
    </div>
  `,
})
export class GroupBoundsRowsComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly provisionModes: readonly ProvisionMode[] = ['automatic', 'manual'];
  protected readonly provision = PROVISION;
  protected readonly bounds: readonly BoundField[] = [
    { bound: 'min', label: 'Min nodes', aria: 'Min nodes', why: 'floor-why' },
    { bound: 'desired', label: 'Target', aria: 'Target nodes', why: 'target-why' },
    { bound: 'max', label: 'Max nodes', aria: 'Max nodes', why: 'ceiling-why' },
  ];

  protected readonly d = this.draft;
  protected readonly g = computed(() => this.draft().group());
  protected readonly provider = computed(() => this.draft().provider());

  protected hint(bound: Bound): string {
    if (bound === 'min') return 'Never fewer nodes than this. Held now, always.';
    if (bound === 'desired') return 'Where the fleet would like to sit.';
    return this.draft().canProvision() ? 'Never more nodes than this.' : 'Reported, not prevented.';
  }
}
