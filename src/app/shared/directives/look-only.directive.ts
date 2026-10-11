import { Directive, input } from '@angular/core';

/**
 * A section somebody may look at but not operate — an application in the
 * showcase. Its values stay on screen and can still be opened (a button that
 * discloses, marked `aria-expanded`, stays); every other button goes, and the
 * fields stop taking clicks.
 */
@Directive({
  selector: '[appLookOnly]',
  standalone: true,
  host: {
    '[class.look-only]': 'on()',
  },
})
export class LookOnlyDirective {
  readonly on = input(false, { alias: 'appLookOnly' });
}
