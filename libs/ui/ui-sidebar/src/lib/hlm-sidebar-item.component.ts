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
  AfterViewInit
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { PortalModule } from '@angular/cdk/portal';
import { OverlayModule } from '@angular/cdk/overlay';
import { HlmSidebarTooltipComponent } from './hlm-sidebar-tooltip.component';

@Component({
  selector: 'hlm-sidebar-item',
  standalone: true,
  imports: [CommonModule, OverlayModule, PortalModule, RouterModule],
  host: {
    '[class]': '_computedClass()',
  },
  template: `
    <a
      [routerLink]="routerLink()"
      [routerLinkActive]="routerLinkActive()"
      variant="ghost"
      [ngClass]="{ 'pl-2': _sidebarService.isExpanded() }"
      class="group relative h-9 w-full flex"
      (click)="clicked.emit();"
    >
      <div
        class="flex w-full items-center"
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
        <span class="text-foreground ml-2 overflow-hidden truncate">{{
          label()
        }}</span>
      </div>
    </a>
  `,
})
export class HlmSidebarItemComponent implements OnDestroy {
  protected readonly _sidebarService = inject(BrnSidebarService);
  protected readonly _computedClass = computed(() =>
    hlm('block', this.userClass())
  );

  public readonly clicked = output<void>();
  public readonly userClass = input<ClassValue>('');
  public readonly label = input.required<string>();
  public readonly routerLink = input<string | any[]>('');
  public readonly routerLinkActive = input<string>('');

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
