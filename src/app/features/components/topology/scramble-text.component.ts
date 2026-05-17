import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

import { cryptoRandomInt } from './crypto-random';

const SYMBOLS = String.raw`!<>-_\/[]{}=+*^?#`;
const DIGITS = '0123456789';

export type ScrambleMode = 'symbol' | 'digit';

@Component({
  selector: 'app-scramble-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stack">
      <span class="placeholder" aria-hidden="true">{{ text() || ' ' }}</span>
      <span class="animated">{{ display() }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-block; max-width: 100%; }
    .stack { display: inline-grid; max-width: 100%; }
    .stack > * { grid-area: 1 / 1; white-space: pre-wrap; word-break: break-all; }
    .placeholder { visibility: hidden; }
  `],
})
export class ScrambleTextComponent {
  readonly text = input<string>('');
  readonly mode = input<ScrambleMode>('symbol');
  readonly display = signal<string>('');

  private rafId = 0;
  private lastText: string | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.cancel());

    effect(() => {
      const next = this.text() ?? '';
      if (next === this.lastText) return;
      this.lastText = next;
      this.start(next, this.mode());
    });
  }

  private cancel(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private isAnimatedChar(target: string, i: number, mode: ScrambleMode): boolean {
    if (mode !== 'digit') return true;
    const code = target.codePointAt(i) ?? 0;
    return code >= 48 && code <= 57;
  }

  private buildFrame(target: string, mode: ScrambleMode, charset: string, revealAt: number[], elapsed: number): string {
    let out = '';
    for (let i = 0; i < target.length; i++) {
      if (!this.isAnimatedChar(target, i, mode) || elapsed >= revealAt[i]) {
        out += target[i];
      } else {
        out += charset[cryptoRandomInt(charset.length)];
      }
    }
    return out;
  }

  private start(target: string, mode: ScrambleMode): void {
    this.cancel();
    const n = target.length;
    if (n === 0) {
      this.display.set('');
      return;
    }

    const animatedIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (this.isAnimatedChar(target, i, mode)) animatedIdx.push(i);
    }
    if (animatedIdx.length === 0) {
      this.display.set(target);
      return;
    }

    const animatedCount = animatedIdx.length;
    const duration =
      mode === 'digit'
        ? Math.min(900, 350 + animatedCount * 60)
        : Math.min(1400, 400 + animatedCount * 18);
    const revealSpan = duration * 0.85;
    const revealAt = new Array<number>(n).fill(0);
    for (let k = 0; k < animatedCount; k++) {
      const i = animatedIdx[k];
      revealAt[i] = animatedCount === 1 ? 0 : (k / (animatedCount - 1)) * revealSpan;
    }

    const charset = mode === 'digit' ? DIGITS : SYMBOLS;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      this.display.set(this.buildFrame(target, mode, charset, revealAt, elapsed));
      if (elapsed < duration) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.display.set(target);
        this.rafId = 0;
      }
    };

    this.display.set(this.buildFrame(target, mode, charset, revealAt, 0));
    this.rafId = requestAnimationFrame(tick);
  }
}
