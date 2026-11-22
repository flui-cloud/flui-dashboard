import { Component, computed, input } from '@angular/core';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { Level } from '../../model/installation-now.models';

export interface UsageBounds {
  readonly warnAt: number;
  readonly criticalAt: number;
}

export function levelTone(level: Level): StatusTone | null {
  if (level === 'bad') return 'error';
  return level === 'warn' ? 'warning' : null;
}

export function usageBounds(level: Level): UsageBounds {
  if (level === 'bad') return { warnAt: 0, criticalAt: 0 };
  if (level === 'warn') return { warnAt: 0, criticalAt: Infinity };
  return { warnAt: Infinity, criticalAt: Infinity };
}

@Component({
  selector: 'app-now-level',
  imports: [FlStatus],
  host: { class: 'inline-flex' },
  template: `
    @if (tone(); as t) {
      <fl-status [tone]="t" [label]="label()" />
    } @else {
      <span>{{ label() }}</span>
    }
  `,
})
export class NowLevel {
  readonly level = input.required<Level>();
  readonly label = input.required<string>();
  protected readonly tone = computed(() => levelTone(this.level()));
}
