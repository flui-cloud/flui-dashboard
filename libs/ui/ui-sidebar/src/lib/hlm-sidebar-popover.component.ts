// File: hlm-sidebar-popover.component.ts
import { Component, ElementRef, HostListener, Input, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'hlm-sidebar-popover',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-content></ng-content>

    <div
      *ngIf="isOpen"
      class="absolute z-50 left-full ml-2 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-max text-xs"
      (mouseenter)="cancelHideTimer()"
      (mouseleave)="startHideTimer()"
      style="top: 0; white-space: nowrap;"
    >
      {{ popoverText }}
    </div>
  `,
  host: {
    'class': 'relative inline-block',
    '(mouseenter)': 'showPopover()',
    '(mouseleave)': 'startHideTimer()',
    '(click)': 'togglePopover()'
  }
})
export class HlmSidebarPopoverComponent {
  @Input() popoverText: string = '';

  isOpen = false;
  hideTimer: any = null;

  constructor(private elementRef: ElementRef) {}

  togglePopover(): void {
    this.isOpen = !this.isOpen;
  }

  showPopover(): void {
    this.cancelHideTimer();
    this.isOpen = true;
  }

  startHideTimer(): void {
    this.cancelHideTimer();
    this.hideTimer = setTimeout(() => {
      this.isOpen = false;
    }, 300); // Piccolo ritardo per permettere di muovere il mouse dal trigger al contenuto
  }

  cancelHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
