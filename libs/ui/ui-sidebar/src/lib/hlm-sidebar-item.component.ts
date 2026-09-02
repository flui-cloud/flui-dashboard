import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  ViewChild,
  ElementRef,
  OnDestroy,
  signal,
  effect,
  AfterViewInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { hlm } from '@spartan-ng/brain/core';
import { HighlightSegment, splitLabelByQuery } from './utils/highlight-segments';
import { BrnSidebarPinService, BrnSidebarSearchService, BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { PortalModule } from '@angular/cdk/portal';
import { OverlayModule } from '@angular/cdk/overlay';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePin, lucidePinOff } from '@ng-icons/lucide';
import { HlmSidebarTooltipComponent } from './hlm-sidebar-tooltip.component';

@Component({
  selector: 'hlm-sidebar-item',
  standalone: true,
  imports: [CommonModule, OverlayModule, PortalModule, RouterModule, NgIconComponent],
  providers: [provideIcons({ lucidePin, lucidePinOff })],
  host: {
    '[class]': '_computedClass()',
  },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="group relative h-9 w-full flex items-center">
      <a
        [routerLink]="routerLink()"
        [routerLinkActive]="routerLinkActive()"
        variant="ghost"
        [ngClass]="{ 'pl-2': _sidebarService.isExpanded() }"
        class="relative h-9 min-w-0 flex-1 flex"
        (click)="clicked.emit();"
      >
        <div
          class="flex w-full min-w-0 items-center"
          [class.justify-start]="_sidebarService.isExpanded()"
          [class.justify-center]="!_sidebarService.isExpanded()"
        >
          <div
            #iconContainer
            class="transition-transform duration-200 ease-in-out group-hover:scale-110 relative"
            (mouseenter)="handleMouseEnter()"
            (mouseleave)="handleMouseLeave()"
          >
            <ng-content select="ng-icon" />
          </div>
          <!-- kept on one line, no whitespace between segments: a newline/indent
          between branches renders as a literal space, splitting the label apart -->
          <span class="text-foreground ml-2 overflow-hidden truncate">@for (segment of _labelSegments(); track $index) {@if (segment.matched) {<mark class="rounded-sm bg-primary/30 text-inherit">{{ segment.text }}</mark>} @else {{{ segment.text }}}}</span>
        </div>
      </a>
      @if (_sidebarService.isExpanded() && pinnable()) {
      <button
        type="button"
        class="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        [class.opacity-100]="_isPinned()"
        (click)="onTogglePin($event)"
      >
        <ng-icon [name]="_isPinned() ? 'lucidePinOff' : 'lucidePin'" class="h-3.5 w-3.5" />
      </button>
      }
    </div>
  `,
})
export class HlmSidebarItemComponent implements OnDestroy {
  protected readonly _sidebarService = inject(BrnSidebarService);
  protected readonly _pinService = inject(BrnSidebarPinService);
  protected readonly _searchService = inject(BrnSidebarSearchService);
  protected readonly _computedClass = computed(() =>
    hlm('block', this.userClass())
  );

  public readonly clicked = output<void>();
  public readonly userClass = input<ClassValue>('');
  public readonly label = input.required<string>();
  public readonly routerLink = input<string | any[]>('');
  public readonly routerLinkActive = input<string>('');
  public readonly id = input<string>('');
  public readonly pinnable = input<boolean>(true);

  protected readonly _itemId = computed(() => {
    const id = this.id();
    if (id) return id;
    const link = this.routerLink();
    return typeof link === 'string' ? link : JSON.stringify(link);
  });

  protected readonly _isPinned = computed(() => this._pinService.isPinned(this._itemId()));

  protected readonly _labelSegments = computed<HighlightSegment[]>(() =>
    splitLabelByQuery(this.label(), this._searchService.query())
  );

  onTogglePin(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this._pinService.toggle(this._itemId());
  }

  @ViewChild('iconContainer') iconContainer!: ElementRef;

  private overlayRef: OverlayRef | null = null;
  private overlay = inject(Overlay);

  private showTooltipSignal = signal(false);

  constructor() {
    effect(() => {
      const shouldShow = this.showTooltipSignal();

      if (shouldShow && !this._sidebarService.isExpanded()) {
        this.createTooltip();
      } else {
        this.removeTooltip();
      }
    });
  }

  handleMouseEnter(): void {
    this.showTooltipSignal.set(true);
  }

  handleMouseLeave(): void {
    this.showTooltipSignal.set(false);
  }

  private createTooltip(): void {
    if (!this.iconContainer) {
      return;
    }

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.iconContainer)
      .withPositions([
        {
          originX: 'end',
          originY: 'center',
          overlayX: 'start',
          overlayY: 'center',
          offsetX: 8
        }
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });

    const tooltipPortal = new ComponentPortal(HlmSidebarTooltipComponent);
    const tooltipRef = this.overlayRef.attach(tooltipPortal);
    tooltipRef.instance.text.set(this.label());
  }

  private removeTooltip(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }

  ngOnDestroy(): void {
    this.removeTooltip();
  }
}
