import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronUp } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

export type ProbeType = 'http' | 'tcp' | 'none';

const METHODS: readonly { value: ProbeType; title: string; desc: string }[] = [
  { value: 'none', title: 'Disabled', desc: 'Skip availability checks.' },
  { value: 'http', title: 'Web request', desc: 'A URL has to return a successful response.' },
  { value: 'tcp', title: 'Port check', desc: 'The application port has to accept connections.' },
];

@Component({
  selector: 'app-deploy-env-health-check',
  imports: [FlField, FlButton, FlIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronUp })],
  host: { class: 'flex flex-col gap-4 border-t border-fl-border pt-4' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-1">
        <h3 class="m-0 text-fl-body-sm font-semibold">Availability check</h3>
        <span class="text-fl-body-sm text-fl-ink-muted">{{ summary() }}</span>
      </div>
      <button
        flButton="ghost"
        size="sm"
        type="button"
        aria-controls="deploy-health-check"
        [attr.aria-expanded]="expanded()"
        (click)="expandedChange.emit(!expanded())"
      >
        <fl-icon [name]="expanded() ? 'lucideChevronUp' : 'lucideChevronDown'" />
        {{ expanded() ? 'Hide' : 'Configure' }}
      </button>
    </div>

    @if (expanded()) {
      <fieldset id="deploy-health-check" class="fl-fieldset">
        <legend class="fl-sr">Availability check settings</legend>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Flui checks that the application responds. After repeated failures the instance leaves
          traffic until it recovers. You can change this later in the application settings.
        </p>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Method">
          @for (m of methods; track m.value) {
            <label class="fl-radiocard">
              <input
                type="radio"
                name="deploy-probe-type"
                [checked]="type() === m.value"
                (change)="typeChange.emit(m.value)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">{{ m.title }}</span>
                <span class="fl-radiocard__desc">{{ m.desc }}</span>
              </span>
            </label>
          }
        </div>

        @if (type() !== 'none') {
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            @if (type() === 'http') {
              <fl-field label="URL path" for="deploy-probe-path">
                <div class="fl-input fl-input--lg">
                  <input
                    id="deploy-probe-path"
                    type="text"
                    class="fl-mono"
                    [value]="path()"
                    (input)="pathChange.emit($any($event.target).value)"
                  />
                </div>
              </fl-field>
            }
            <fl-field
              label="Startup grace period"
              for="deploy-probe-delay"
              hint="Wait before the first check."
            >
              <div class="fl-input fl-input--lg">
                <input
                  id="deploy-probe-delay"
                  type="number"
                  class="fl-num"
                  min="0"
                  [value]="initialDelay()"
                  (input)="initialDelayChange.emit(+$any($event.target).value)"
                />
                <span class="text-fl-caption">s</span>
              </div>
            </fl-field>
            @if (type() === 'http') {
              <fl-field label="Check every" for="deploy-probe-period">
                <div class="fl-input fl-input--lg">
                  <input
                    id="deploy-probe-period"
                    type="number"
                    class="fl-num"
                    min="1"
                    [value]="period()"
                    (input)="periodChange.emit(+$any($event.target).value)"
                  />
                  <span class="text-fl-caption">s</span>
                </div>
              </fl-field>
              <fl-field label="Mark unavailable after" for="deploy-probe-failures">
                <div class="fl-input fl-input--lg">
                  <input
                    id="deploy-probe-failures"
                    type="number"
                    class="fl-num"
                    min="1"
                    [value]="failureThreshold()"
                    (input)="failureThresholdChange.emit(+$any($event.target).value)"
                  />
                  <span class="text-fl-caption">failures</span>
                </div>
              </fl-field>
            }
          </div>
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            @if (type() === 'http') {
              Flui requests <span class="fl-mono">{{ path() }}</span> on port {{ port() }} every
              {{ period() }}s. The app has {{ initialDelay() }}s to start before checks begin.
            } @else {
              Flui checks that port {{ port() }} accepts connections. Use it when the app has no
              HTTP endpoint.
            }
          </p>
        }
      </fieldset>
    }
  `,
})
export class DeployEnvHealthCheck {
  readonly type = input<ProbeType>('none');
  readonly path = input('/');
  readonly initialDelay = input(30);
  readonly period = input(30);
  readonly failureThreshold = input(3);
  readonly port = input<number | null>(null);
  readonly expanded = input(false);
  readonly typeChange = output<ProbeType>();
  readonly pathChange = output<string>();
  readonly initialDelayChange = output<number>();
  readonly periodChange = output<number>();
  readonly failureThresholdChange = output<number>();
  readonly expandedChange = output<boolean>();

  protected readonly methods = METHODS;

  protected readonly summary = computed(() => {
    switch (this.type()) {
      case 'http':
        return `Web request on ${this.path()} :${this.port() ?? ''}`;
      case 'tcp':
        return `Port check on :${this.port() ?? ''}`;
      default:
        return 'Disabled';
    }
  });
}
