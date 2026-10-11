import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ExplainComponent } from '../../../shared/components/explain.component';
import { Tone } from '../dashboard/home-state';
import { ComponentCard, ComponentTrend } from './app-recap-bundle';
import { AppRecapComponentCardComponent } from './app-recap-component-card.component';
import { RunState, TONE_TEXT } from './app-recap-view';
import { AppAvailability } from '../../service/fleet.service';

@Component({
  selector: 'app-recap-topology',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRecapComponentCardComponent, ExplainComponent],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-4" data-testid="recap-topology">
      <div class="card-surface flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
        <h2 class="mr-2 font-semibold text-foreground">How it fits together</h2>
        @if (endpointHost()) {
          <span
            class="max-w-[16rem] truncate rounded-full border border-dashed border-border px-2.5 py-0.5 font-mono text-xs text-foreground"
            [title]="endpointHost() + (health().label ? ' · ' + health().label : '')"
          >internet</span>
          <span class="text-primary" aria-hidden="true">→</span>
        }
        @for (c of front(); track c.app.id) {
          <span class="rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-foreground">{{ c.role }}</span>
        }
        @if (back().length) {
          <span class="text-muted-foreground" aria-hidden="true">⇢</span>
          @for (c of back(); track c.app.id) {
            <span class="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">{{ c.role }}</span>
          }
        }
        <span class="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {{ summary() }}
          @if (note()) {
            <app-explain label="" floating>{{ note() }}</app-explain>
          }
        </span>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (c of cards(); track c.app.id) {
          <app-recap-component-card
            [card]="c"
            [recapPath]="recapPath()"
            [protectionLoaded]="protectionLoaded()"
            [availability]="availability()[c.app.id] ?? null"
            [runState]="runState()"
            [trend]="trends()[c.app.id] ?? null"
            [address]="c === front()[0] ? endpointHost() : ''"
            (backUp)="backUp.emit($event)"
          />
        }
      </div>
    </section>
  `,
})
export class AppRecapTopologyComponent {
  readonly recapPath = input('');
  readonly endpointHost = input('');
  readonly health = input.required<{ label: string; tone: Tone }>();
  readonly front = input.required<ComponentCard[]>();
  readonly back = input.required<ComponentCard[]>();
  readonly summary = input.required<string>();
  readonly note = input('');
  readonly protectionLoaded = input.required<boolean>();
  readonly availability = input<Record<string, AppAvailability>>({});
  readonly runState = input.required<Record<string, RunState>>();
  readonly trends = input<Record<string, ComponentTrend>>({});
  readonly backUp = output<string>();

  protected readonly cards = computed(() => [...this.front(), ...this.back()]);

  protected readonly text = TONE_TEXT;
}
