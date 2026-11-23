import {
  booleanAttribute,
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
import { provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { FlIcon } from '../../ui/primitives/icon';

let nextId = 0;

@Component({
  selector: 'app-explain',
  imports: [FlIcon],
  providers: [provideIcons({ lucideInfo })],
  template: `
    <span
      class="inline-block max-w-full"
      [class.relative]="floating()"
      (keydown.escape)="dismiss($event)"
    >
      <span class="inline-flex items-center gap-1.5 align-middle">
        <span [class]="labelClass()">{{ label() }}</span>
        <button
          type="button"
          class="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-fl-sm border-0 bg-transparent p-0 text-fl-ink-muted hover:text-fl-ink focus-visible:shadow-fl-focus focus-visible:outline-none"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="id"
          [attr.aria-label]="open() ? 'Hide the explanation' : 'What is this?'"
          [attr.data-testid]="testid() ? testid() + '-toggle' : null"
          (click)="toggle()"
        >
          <fl-icon name="lucideInfo" [size]="14" />
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

  readonly labelClass = input('text-fl-caption font-medium text-fl-ink');

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
      return 'mt-1 block max-w-prose text-fl-caption text-fl-ink-muted';
    }
    const look =
      'z-30 block w-72 rounded-fl-md border border-fl-border bg-fl-surface p-3 text-fl-caption text-fl-ink-secondary';
    if (this.escaped()) return `fixed ${look}`;
    const side = this.dropUp() ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
    const edge = this.alignRight() ? 'right-0' : 'left-0';
    return `absolute ${edge} ${side} ${look}`;
  });

  private readonly dropUp = signal(false);

  private readonly alignRight = signal(false);

  protected readonly escaped = signal<{ top: number; left: number } | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);

  private static readonly PANEL_HEIGHT = 110;

  private static readonly PANEL_WIDTH = 288;

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  private corrected = false;

  constructor() {
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

  protected dismiss(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.open.set(false);
    this.escaped.set(null);
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
    const anchor = (this.host.nativeElement as HTMLElement).getBoundingClientRect();

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
    if (panel.bottom <= clip.bottom && panel.top >= clip.top && panel.right <= clip.right) {
      return;
    }

    const anchor = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
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

  private place(): void {
    const anchor = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
    const clip = this.clipRect();

    const roomBelow = clip.bottom - anchor.bottom;
    this.dropUp.set(roomBelow < ExplainComponent.PANEL_HEIGHT && anchor.top - clip.top > roomBelow);

    const roomRight = clip.right - anchor.left;
    this.alignRight.set(
      roomRight < ExplainComponent.PANEL_WIDTH && anchor.right - clip.left > roomRight,
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
