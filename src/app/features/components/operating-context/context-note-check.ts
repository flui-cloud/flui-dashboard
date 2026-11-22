import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import {
  CheckKind,
  ContextProbeOption,
  ContextProbeParam,
  PREMISE_HINT,
  PROBE_OPS,
  ProbeOp,
  ProbeValueType,
} from '../../model/operating-context.models';

export interface ParamRow {
  name: string;
  value: string;
}

@Component({
  selector: 'app-context-note-check',
  imports: [FormsModule, ExplainComponent, FlField, FlButton],
  host: { class: 'block' },
  template: `
    <fieldset class="fl-fieldset">
      <legend class="fl-row">
        <span>What keeps it honest</span>
        <app-explain
          label="why this matters"
          labelClass="text-fl-body-sm font-normal text-fl-ink-muted"
          testid="honest-why"
        >
          A note ages. Leaning it on a live fact, or on a signature with a shelf life, is what lets
          it ask to be revisited instead of advising something that stopped being true.
          <strong>Nothing</strong> means it is prose and says so;
          <strong>a signature</strong> lapses after the days you give it;
          <strong>a live fact</strong> is compared against the platform and falls on its own.
        </app-explain>
      </legend>

      <span class="fl-select-wrap">
        <select
          class="fl-select"
          [ngModel]="checkKind()"
          name="checkKind"
          (ngModelChange)="checkKind.set($event)"
          aria-label="What keeps it honest"
          data-testid="check-kind"
        >
          <option value="none">Nothing, it is prose</option>
          <option value="attestation">A signature, with a shelf life</option>
          @if (probeUsable()) {
            <option value="probe">A live fact</option>
          }
        </select>
      </span>

      @if (!probeUsable()) {
        <app-explain
          label="No live fact at this level"
          labelClass="text-fl-caption text-fl-ink-muted"
          testid="no-probe-here"
        >
          A note about the whole installation cannot be compared with anything: it is either an
          intention, or it belongs at a narrower level.
        </app-explain>
      }

      @if (checkKind() === 'attestation') {
        <fl-field label="A confirmation is worth (days)" for="valid-for-days">
          <div class="fl-input fl-input--lg">
            <input
              id="valid-for-days"
              type="number"
              min="1"
              max="365"
              [ngModel]="validForDays()"
              name="validForDays"
              (ngModelChange)="validForDays.set(+$event)"
              data-testid="valid-for-days"
            />
          </div>
        </fl-field>
      }

      @if (checkKind() === 'probe') {
        <div class="flex flex-col gap-3" data-testid="probe-editor">
          <span class="fl-select-wrap">
            <select
              class="fl-select"
              [ngModel]="probeId()"
              name="probeId"
              (ngModelChange)="pickProbe($event)"
              aria-label="Which fact"
              data-testid="probe-id"
            >
              <option value="">Pick a fact…</option>
              @for (probe of probes(); track probe.id) {
                <option [value]="probe.id">{{ probe.id }}</option>
              }
            </select>
          </span>

          @if (probeDescription(); as describes) {
            <p class="m-0 text-fl-caption text-fl-ink-muted" data-testid="probe-describes">
              {{ describes }}
            </p>
          }

          @if (declaredParams(); as declared) {
            @for (param of declared; track param.name) {
              <fl-field
                [label]="param.required ? param.name : param.name + ' (optional)'"
                [for]="'param-' + param.name"
                data-testid="declared-param"
              >
                @if (param.oneOf; as choices) {
                  <span class="fl-select-wrap">
                    <select
                      class="fl-select"
                      [id]="'param-' + param.name"
                      [ngModel]="paramValue(param.name)"
                      [name]="'param-' + param.name"
                      (ngModelChange)="setParam(param.name, $event)"
                      [attr.data-testid]="'param-' + param.name"
                    >
                      <option value="">Pick one…</option>
                      @for (choice of choices; track choice) {
                        <option [value]="choice">{{ choice }}</option>
                      }
                    </select>
                  </span>
                } @else {
                  <div class="fl-input fl-input--lg">
                    <input
                      [id]="'param-' + param.name"
                      [placeholder]="param.name"
                      [ngModel]="paramValue(param.name)"
                      [name]="'param-' + param.name"
                      (ngModelChange)="setParam(param.name, $event)"
                      [attr.data-testid]="'param-' + param.name"
                    />
                  </div>
                }
              </fl-field>
            }
          } @else {
            <app-explain
              label="This fact did not say what it wants"
              labelClass="text-fl-caption text-fl-ink-muted"
              testid="undeclared-params"
            >
              Name the parameters yourself: the API will say if one is missing.
            </app-explain>
            @for (row of paramRows(); track $index) {
              <div class="grid gap-2 sm:grid-cols-2">
                <div class="fl-input fl-input--lg">
                  <input
                    placeholder="parameter"
                    aria-label="Parameter name"
                    [ngModel]="row.name"
                    [name]="'param-name-' + $index"
                    (ngModelChange)="setRow($index, 'name', $event)"
                    data-testid="param-name"
                  />
                </div>
                <div class="fl-input fl-input--lg">
                  <input
                    placeholder="value"
                    aria-label="Parameter value"
                    [ngModel]="row.value"
                    [name]="'param-value-' + $index"
                    (ngModelChange)="setRow($index, 'value', $event)"
                    data-testid="param-value"
                  />
                </div>
              </div>
            }
            <button
              flButton="ghost"
              size="sm"
              type="button"
              class="self-start"
              (click)="addParam()"
              data-testid="add-param"
            >
              Another parameter
            </button>
          }

          <div class="grid gap-2 sm:grid-cols-2">
            <span class="fl-select-wrap">
              <select
                class="fl-select"
                [ngModel]="probeOp()"
                name="probeOp"
                (ngModelChange)="probeOp.set($event)"
                aria-label="Comparison"
                data-testid="probe-op"
              >
                @for (op of probeOps; track op) {
                  <option [value]="op">{{ op }}</option>
                }
              </select>
            </span>
            @if (probeOp() !== 'exists') {
              @switch (answerType()) {
                @case ('boolean') {
                  <span class="fl-select-wrap">
                    <select
                      class="fl-select"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    >
                      <option value="">Pick one…</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </span>
                }
                @case ('number') {
                  <div class="fl-input fl-input--lg">
                    <input
                      type="number"
                      placeholder="expected number"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    />
                  </div>
                }
                @default {
                  <div class="fl-input fl-input--lg">
                    <input
                      placeholder="expected value"
                      aria-label="Expected value"
                      [ngModel]="probeExpected()"
                      name="probeExpected"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="probeExpected.set($event)"
                      data-testid="probe-expected"
                    />
                  </div>
                }
              }
            }
          </div>
          <app-explain
            label="How the value is read"
            labelClass="text-fl-caption text-fl-ink-muted"
            testid="premise-hint"
          >
            {{ premiseHint }}
          </app-explain>
        </div>
      }
    </fieldset>
  `,
})
export class ContextNoteCheckComponent {
  readonly probes = input<ContextProbeOption[]>([]);
  readonly probeUsable = input(true);
  readonly declaredParams = input<ContextProbeParam[] | undefined>(undefined);
  readonly probeDescription = input('');
  readonly answerType = input<ProbeValueType | undefined>(undefined);

  readonly checkKind = model.required<CheckKind>();
  readonly validForDays = model.required<number>();
  readonly probeId = model.required<string>();
  readonly probeOp = model.required<ProbeOp>();
  readonly probeExpected = model.required<string>();
  readonly paramRows = model.required<ParamRow[]>();
  readonly paramAnswers = model.required<Record<string, string>>();

  protected readonly probeOps = PROBE_OPS;
  protected readonly premiseHint = PREMISE_HINT;

  protected paramValue(name: string): string {
    return this.paramAnswers()[name] ?? '';
  }

  protected setParam(name: string, value: string): void {
    this.paramAnswers.update((answers) => ({ ...answers, [name]: value }));
  }

  protected pickProbe(id: string): void {
    this.probeId.set(id);
    this.paramAnswers.set({});
  }

  protected setRow(index: number, field: 'name' | 'value', value: string): void {
    this.paramRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  protected addParam(): void {
    this.paramRows.update((rows) => [...rows, { name: '', value: '' }]);
  }
}
