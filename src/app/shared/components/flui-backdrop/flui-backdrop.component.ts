import { Component, input } from '@angular/core';

@Component({
  selector: 'app-flui-backdrop',
  standalone: true,
  host: {
    '[attr.data-placement]': 'placement()',
    '[attr.data-intensity]': 'intensity()',
    '[class.no-glow]': '!glow()',
  },
  styles: [`
    :host {
      --mark-o: 0.05;
      --glow-a: 0.09;
      --glow-x: 86%;
      --glow-y: 82%;
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }

    :host([data-intensity="soft"]) { --mark-o: 0.075; --glow-a: 0.13; }
    :host([data-intensity="bold"]) { --mark-o: 0.11;  --glow-a: 0.17; }

    :host([data-placement="center"])    { --glow-x: 50%; --glow-y: 44%; }
    :host([data-placement="top-right"]) { --glow-x: 86%; --glow-y: 16%; }

    .glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        55% 55% at var(--glow-x) var(--glow-y),
        hsl(var(--brand) / var(--glow-a)) 0%,
        transparent 70%
      );
      animation: glow-breathe 9s ease-in-out infinite alternate;
    }
    :host(.no-glow) .glow { display: none; }

    @keyframes glow-breathe {
      from { opacity: 0.7; }
      to   { opacity: 1; }
    }

    .mark {
      position: absolute;
      width: clamp(260px, 38vw, 540px);
      height: auto;
      opacity: var(--mark-o);
      object-fit: contain;
    }

    .mark-dark { display: none; }
    :host-context(.dark) .mark-light { display: none; }
    :host-context(.dark) .mark-dark  { display: block; }

    :host([data-placement="bottom-right"]) .mark { bottom: -7%; right: -4%; }
    :host([data-placement="top-right"])    .mark { top: -6%;    right: -4%; }
    :host([data-placement="center"]) .mark {
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: clamp(320px, 46vw, 680px);
    }

    @media (prefers-reduced-motion: reduce) {
      .glow { animation: none; }
    }
  `],
  template: `
    <div class="glow"></div>
    <img class="mark mark-light" src="/icons/flui-mark/blue-512.png" alt="" aria-hidden="true" draggable="false" />
    <img class="mark mark-dark"  src="/icons/flui-mark/bright-512.png" alt="" aria-hidden="true" draggable="false" />
  `,
})
export class FluiBackdropComponent {
  readonly placement = input<'bottom-right' | 'top-right' | 'center'>('bottom-right');
  readonly intensity = input<'subtle' | 'soft' | 'bold'>('subtle');
  readonly glow = input(true);
}
