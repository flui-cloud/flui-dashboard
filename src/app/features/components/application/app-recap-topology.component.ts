import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Tone } from '../dashboard/home-state';
import { ComponentCard } from './app-recap-bundle';
import { AppRecapComponentCardComponent } from './app-recap-component-card.component';
import { RunState, TONE_TEXT } from './app-recap-view';

@Component({
  selector: 'app-recap-topology',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRecapComponentCardComponent],
  host: { class: 'block' },
  template: `
    <section class="card-surface p-6" data-testid="recap-topology">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-semibold text-foreground">How it fits together</h2>
        <span class="text-xs text-muted-foreground">{{ summary() }}</span>
      </div>
      <div class="mt-4 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        @if (endpointHost()) {
          <div class="flex flex-col gap-1 rounded-lg border border-dashed border-border px-4 py-3 lg:w-48">
            <span class="text-label">Internet</span>
            <span class="truncate font-mono text-xs text-foreground" [title]="endpointHost()">{{ endpointHost() }}</span>
            @if (health().label) {
              <span class="text-[11px]" [class]="text[health().tone]">{{ health().label }}</span>
            }
          </div>
          <span class="self-center text-primary" aria-hidden="true">→</span>
        }
        <div class="flex flex-1 flex-col gap-3">
          @for (c of front(); track c.app.id) {
            <app-recap-component-card [card]="c" [protectionLoaded]="protectionLoaded()" [runState]="runState()" (backUp)="backUp.emit($event)" />
          }
        </div>
        @if (back().length) {
          <span class="self-center text-muted-foreground" aria-hidden="true">⇢</span>
          <div class="flex flex-1 flex-col gap-3">
            @for (c of back(); track c.app.id) {
              <app-recap-component-card [card]="c" [protectionLoaded]="protectionLoaded()" [runState]="runState()" (backUp)="backUp.emit($event)" />
            }
          </div>
        }
      </div>
      @if (note()) {
        <p class="mt-4 text-xs text-muted-foreground">{{ note() }}</p>
      }
    </section>
  `,
})
export class AppRecapTopologyComponent {
  readonly endpointHost = input('');
  readonly health = input.required<{ label: string; tone: Tone }>();
  readonly front = input.required<ComponentCard[]>();
  readonly back = input.required<ComponentCard[]>();
  readonly summary = input.required<string>();
  readonly note = input('');
  readonly protectionLoaded = input.required<boolean>();
  readonly runState = input.required<Record<string, RunState>>();
  readonly backUp = output<string>();

  protected readonly text = TONE_TEXT;
}
