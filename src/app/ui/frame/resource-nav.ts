import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter, map } from 'rxjs';

export interface ResourceNavItem {
  readonly label: string;
  readonly link: string | readonly unknown[];
  readonly attention?: boolean;
  readonly count?: number | null;
  readonly disabledReason?: string | null;
  readonly testId?: string;
}

export interface ResourceNavGroup {
  readonly label: string | null;
  readonly items: readonly ResourceNavItem[];
}

let nextId = 0;

@Component({
  selector: 'fl-resource-nav',
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'fl-resnav' },
  template: `
    <nav class="fl-resnav__list" [attr.aria-label]="label()">
      @for (group of groups(); track group.label ?? '') {
        @if (group.label) {
          <div class="fl-resnav__group">{{ group.label }}</div>
        }
        @for (item of group.items; track item.label) {
          @if (item.disabledReason) {
            <span
              class="fl-resnav__item is-disabled"
              aria-disabled="true"
              [title]="item.disabledReason"
              [attr.data-testid]="item.testId ? 'tab-off-' + item.testId : null"
              >{{ item.label }}</span
            >
          } @else {
            <a
              class="fl-resnav__item"
              [routerLink]="item.link"
              routerLinkActive
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: false }"
              [attr.data-testid]="item.testId ? 'tab-' + item.testId : null"
            >
              {{ item.label }}
              @if (item.count) {
                <span class="fl-resnav__count">{{ item.count }}</span>
              } @else if (item.attention) {
                <span class="fl-resnav__mark" aria-label="Needs attention"></span>
              }
            </a>
          }
        }
      }
    </nav>
    <div class="fl-resnav__picker">
      <label class="fl-sr" [for]="pickerId">{{ label() }}</label>
      <span class="fl-select-wrap">
        <select class="fl-select" [id]="pickerId" (change)="go($event)">
          @for (group of groups(); track group.label ?? '') {
            <optgroup [label]="group.label ?? 'General'">
              @for (item of group.items; track item.label) {
                <option
                  [value]="href(item)"
                  [selected]="href(item) === activeHref()"
                  [disabled]="!!item.disabledReason"
                >
                  {{ item.label }}
                </option>
              }
            </optgroup>
          }
        </select>
      </span>
    </div>
  `,
})
export class FlResourceNav {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly groups = input.required<readonly ResourceNavGroup[]>();
  readonly label = input('Sections');
  protected readonly pickerId = `fl-resnav-${nextId++}`;
  private readonly flat = computed(() => this.groups().flatMap((g) => g.items));
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeHref = computed(() => {
    const url = this.url().split('?')[0];
    return (
      this.flat()
        .map((item) => this.href(item))
        .find((href) => url === href || url.startsWith(`${href}/`)) ?? null
    );
  });

  protected href(item: ResourceNavItem): string {
    const commands = typeof item.link === 'string' ? [item.link] : [...item.link];
    return this.router.serializeUrl(
      this.router.createUrlTree(commands, { relativeTo: this.route }),
    );
  }

  protected go(event: Event): void {
    const url = (event.target as HTMLSelectElement).value;
    if (this.flat().length) void this.router.navigateByUrl(url);
  }
}
