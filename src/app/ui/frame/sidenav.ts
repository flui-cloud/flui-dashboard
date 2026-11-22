import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';
import { FlTag } from '../primitives/tag';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly link: string;
  readonly icon: string;
  readonly count?: number | null;
  readonly tag?: string | null;
  readonly attention?: boolean;
  readonly current?: boolean | null;
  readonly keywords?: readonly string[];
}

export interface NavSection {
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

@Component({
  selector: 'fl-sidenav',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, FlIcon, FlTag],
  providers: [provideIcons({ lucideTriangleAlert })],
  host: { class: 'fl-sidenav', role: 'navigation', 'aria-label': 'Console' },
  template: `
    @for (section of sections(); track section.label ?? '') {
      @if (section.label) {
        <div class="fl-sidenav__section">{{ section.label }}</div>
      }
      @for (item of section.items; track item.id) {
        @if (item.current === null || item.current === undefined) {
          <a
            class="fl-sidenav__item"
            [routerLink]="item.link"
            routerLinkActive
            ariaCurrentWhenActive="page"
            (click)="navigate.emit()"
          >
            <ng-container *ngTemplateOutlet="body; context: { $implicit: item }" />
          </a>
        } @else {
          <a
            class="fl-sidenav__item"
            [routerLink]="item.link"
            [attr.aria-current]="item.current ? 'page' : null"
            (click)="navigate.emit()"
          >
            <ng-container *ngTemplateOutlet="body; context: { $implicit: item }" />
          </a>
        }
      }
    }
    <ng-content />

    <ng-template #body let-item>
      <span class="fl-sidenav__label"><fl-icon [name]="item.icon" />{{ item.label }}</span>
      @if (item.attention) {
        <fl-icon class="fl-sidenav__attention" name="lucideTriangleAlert" [size]="14" />
      } @else if (item.tag) {
        <fl-tag>{{ item.tag }}</fl-tag>
      } @else if (item.count) {
        <span class="fl-sidenav__count">{{ item.count }}</span>
      }
    </ng-template>
  `,
})
export class FlSidenav {
  readonly sections = input.required<readonly NavSection[]>();
  readonly navigate = output<void>();
}
