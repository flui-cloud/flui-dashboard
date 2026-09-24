import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';

let nextId = 0;

@Component({
  selector: 'app-explain',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-block max-w-full" [class.relative]="floating()">
      <span class="inline-flex items-center gap-1.5 align-middle">
        <span [class]="labelClass()">{{ label() }}</span>
        <button
          type="button"
          class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="id"
          [attr.aria-label]="open() ? 'Hide the explanation' : 'What is this?'"
          [attr.data-testid]="testid() ? testid() + '-toggle' : null"
          (click)="toggle()"
        >
          <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
        </button>
      </span>

      @if (open()) {
        <span
          #panel
          [id]="id"
          role="note"
          [class]="panelClass()"
          [style.top.px]="escaped()?.top"
          [style.left.px]="escaped()?.left"
          [attr.data-testid]="testid()"
        >
          <ng-content />
        </span>
      }
    </span>
  `,
})
export class ExplainComponent {
  readonly label = input.required<string>();

  readonly labelClass = input('text-[12px] font-medium text-foreground');

  readonly testid = input<string | null>(null);

  /**
   * Float the explanation over the page instead of letting it take space.
   *
   * For an explanation that sits in a table cell: one of prose width widens the
   * column under it, and a table that moves while a person reads is worse than
   * one that says less.
   */
  readonly floating = input(false, { transform: booleanAttribute });

  protected readonly open = signal(false);

  protected readonly panelClass = computed(() => {
    if (!this.floating()) {
      return 'mt-1.5 block max-w-prose text-[12px] leading-relaxed text-muted-foreground';
    }
    const look =
      'z-30 block w-72 rounded-md border border-border bg-card p-3 text-[12px] leading-relaxed text-muted-foreground shadow-lg';
    if (this.escaped()) return `fixed ${look}`;
    const side = this.dropUp() ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
    const edge = this.alignRight() ? 'right-0' : 'left-0';
    return `absolute ${edge} ${side} ${look}`;
  });

  /**
   * Opens upward where opening downward would be cut off.
   *
   * The settings table scrolls sideways, and a box told to scroll on one axis
   * clips the other too — so a panel hung under the last row is half hidden by
   * its container rather than by the window. Measured against whatever actually
   * clips: that container on the last rows, the window elsewhere.
   */
  private readonly dropUp = signal(false);

  /**
   * Hangs from the right edge where hanging from the left would run past what
   * clips it — the case of a column near the end of a table that scrolls
   * sideways, where the overflow is silent rather than scrollable.
   */
  private readonly alignRight = signal(false);

  /**
   * Coordinates for a panel that has left its container entirely.
   *
   * The last resort, for a clipping box too small to hold the panel on either
   * side of the anchor — a table of one row, whose header is both at its top
   * and near its bottom. Positioned against the window, so it closes on a
   * scroll rather than drifting away from what it explains.
   */
  protected readonly escaped = signal<{ top: number; left: number } | null>(
    null,
  );

  private readonly host = inject(ElementRef<HTMLElement>);

  /** Roughly the panel: a side has to be chosen before it exists to measure. */
  private static readonly PANEL_HEIGHT = 110;

  /** `w-72`, and the one number here that is exact. */
  private static readonly PANEL_WIDTH = 288;

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  /** One correction per opening: a flip changes the rect it was measured from. */
  private corrected = false;

  constructor() {
    // The side is chosen before the panel exists, from an estimate of its
    // height; this measures the one that was drawn. An effect rather than a
    // frame callback because only Angular knows when the panel is there.
    effect(() => {
      const el = this.panelRef()?.nativeElement;
      if (!el || !this.floating()) return;
      untracked(() => {
        if (this.corrected) return;
        this.corrected = true;
        this.correct(el);
      });
    });
  }

  protected toggle(): void {
    const opening = !this.open();
    this.escaped.set(null);
    this.corrected = false;
    if (opening && this.floating()) this.place();
    this.open.set(opening);
  }

  private correct(el: HTMLElement): void {
    const panel = el.getBoundingClientRect();
    const clip = this.clipRect();
    const anchor = (
      this.host.nativeElement as HTMLElement
    ).getBoundingClientRect();

    if (!this.dropUp() && panel.bottom > clip.bottom) {
      this.dropUp.set(anchor.top - clip.top > clip.bottom - anchor.bottom);
    }
    if (!this.alignRight() && panel.right > clip.right) {
      this.alignRight.set(anchor.right - clip.left > clip.right - anchor.left);
    }
    requestAnimationFrame(() => this.escapeIfStillCut(el, clip));
  }

  private escapeIfStillCut(el: HTMLElement, clip: DOMRect): void {
    const panel = el.getBoundingClientRect();
    if (
      panel.bottom <= clip.bottom &&
      panel.top >= clip.top &&
      panel.right <= clip.right
    ) {
      return;
    }

    const anchor = (
      this.host.nativeElement as HTMLElement
    ).getBoundingClientRect();
    const below = anchor.bottom + 6;
    const top =
      below + panel.height <= window.innerHeight
        ? below
        : Math.max(6, anchor.top - 6 - panel.height);
    const left = Math.min(
      Math.max(6, anchor.left),
      window.innerWidth - ExplainComponent.PANEL_WIDTH - 6,
    );
    this.escaped.set({ top, left });
    window.addEventListener('scroll', this.closeOnScroll, {
      once: true,
      capture: true,
    });
  }

  private readonly closeOnScroll = () => {
    this.open.set(false);
    this.escaped.set(null);
  };

  /**
   * Picks the corner to hang from, against whatever actually clips: the
   * container on a table that scrolls sideways, the window elsewhere. Each axis
   * flips only when the other side has more room, so a panel never moves to a
   * place that is worse.
   */
  private place(): void {
    const anchor = (
      this.host.nativeElement as HTMLElement
    ).getBoundingClientRect();
    const clip = this.clipRect();

    const roomBelow = clip.bottom - anchor.bottom;
    this.dropUp.set(
      roomBelow < ExplainComponent.PANEL_HEIGHT &&
        anchor.top - clip.top > roomBelow,
    );

    const roomRight = clip.right - anchor.left;
    this.alignRight.set(
      roomRight < ExplainComponent.PANEL_WIDTH &&
        anchor.right - clip.left > roomRight,
    );
  }

  private clipRect(): DOMRect {
    const el = this.host.nativeElement as HTMLElement;
    for (let n = el.parentElement; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        return n.getBoundingClientRect();
      }
    }
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }
  protected readonly id = `explain-${nextId++}`;
}
