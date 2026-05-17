import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/brain/core';
import {
  BrnSidebarGroupDirective,
  BrnSidebarGroupLabelDirective,
  BrnSidebarService,
} from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, PortalModule } from '@angular/cdk/portal';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  HlmSidebarGroupTooltipComponent,
  SidebarNavItem,
} from './hlm-sidebar-group-tooltip.component';
import { Router } from '@angular/router';

@Component({
  selector: 'hlm-sidebar-group-label',
  standalone: true,
  hostDirectives: [BrnSidebarGroupLabelDirective],
  imports: [NgIcon, OverlayModule, PortalModule],
  providers: [provideIcons({ lucideChevronDown })],
  host: {
    '[class]': '_computedClass()',
    '(click)': '_group.toggleExpansion()',
  },
  template: `
    <div
      #labelContainer
      class="flex w-full cursor-pointer items-center"
      [class.justify-center]="!_sidebarService.isExpanded()"
      (mouseenter)="handleMouseEnter()"
      (mouseleave)="handleMouseLeave()"
    >
      <div
        class="transition-transform duration-200 ease-in-out hover:scale-110"
      >
        <ng-content select="ng-icon" />
      </div>
      <span class="text-foreground ml-2 overflow-hidden truncate">
        {{ label() }}
      </span>
      @if (_sidebarService.isExpanded()) {
      <ng-icon
        name="lucideChevronDown"
        class="text-foreground ml-auto h-4 w-4 transition-transform"
        [class.rotate-270]="!_group.isExpanded()"
      />
      }
    </div>
  `,
})
export class HlmSidebarGroupLabelComponent implements OnDestroy {
  @ViewChild('labelContainer') labelContainer!: ElementRef;
  protected readonly _sidebarService = inject(BrnSidebarService);
  protected readonly _group = inject(BrnSidebarGroupDirective);
  protected readonly _router = inject(Router);
  public readonly label = input('');
  public readonly items = input<SidebarNavItem[]>([]);
  public readonly userClass = input<ClassValue>('');

  private readonly _overlay = inject(Overlay);
  private overlayRef: OverlayRef | null = null;
  private showTooltipSignal = signal(false);
  private isMouseOverTrigger = false;
  private isMouseOverTooltip = false;

  constructor() {
    effect(() => {
      const shouldShow = this.showTooltipSignal() && this.items().length > 0;
      if (shouldShow && !this._sidebarService.isExpanded()) {
        this.createTooltip();
      } else {
        this.removeTooltip();
      }
    });
  }

  ngOnDestroy(): void {
    this.removeTooltip();
  }

  protected readonly _computedClass = computed(() =>
    hlm(
      'flex items-center w-full p-2 rounded-md text-foreground',
      'hover:bg-accent hover:text-accent-foreground',
      'transition-colors',
      this.userClass()
    )
  );

  handleMouseEnter(): void {
    this.isMouseOverTrigger = true;
    this.showTooltipSignal.set(true);
  }

  handleMouseLeave(): void {
    this.isMouseOverTrigger = false;
    this.maybeRemoveTooltip();
  }

  private createTooltip(): void {
    if (!this.labelContainer) {
      return;
    }

    const positionStrategy = this._overlay
      .position()
      .flexibleConnectedTo(this.labelContainer)
      .withPositions([
        {
          originX: 'end',
          originY: 'center',
          overlayX: 'start',
          overlayY: 'center',
          offsetX: 8,
        },
      ]);

    this.overlayRef = this._overlay.create({
      positionStrategy,
      scrollStrategy: this._overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
    });

    const tooltipPortal = new ComponentPortal(HlmSidebarGroupTooltipComponent);
    const tooltipRef = this.overlayRef.attach(tooltipPortal);

    tooltipRef.setInput('groupLabel', this.label());
    tooltipRef.setInput('items', this.items());

    tooltipRef.instance.navigate.subscribe((link) => {
      console.log(`Navigating to ${link}`);
      this._router.navigateByUrl(link);
      this.removeTooltip();
    });

    const tooltipElement = this.overlayRef.overlayElement;

    tooltipElement.addEventListener('mouseenter', () => {
      this.isMouseOverTooltip = true;
    });

    tooltipElement.addEventListener('mouseleave', () => {
      this.isMouseOverTooltip = false;
      this.maybeRemoveTooltip();
    });
  }

  private maybeRemoveTooltip(): void {
    setTimeout(() => {
      if (!this.isMouseOverTrigger && !this.isMouseOverTooltip) {
        this.removeTooltip();
      }
    }, 100);
  }

  private removeTooltip(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.showTooltipSignal.set(false);
  }
}
