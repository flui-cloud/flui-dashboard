import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { FlIcon } from '../primitives/icon';

@Component({
  selector: 'fl-topbar',
  imports: [RouterLink, FlIcon],
  providers: [provideIcons({ lucideSearch })],
  host: { class: 'fl-topbar', role: 'banner' },
  template: `
    <ng-content select="[topbarStart]" />
    <a class="fl-topbar__brand" [routerLink]="home()" aria-label="Flui, overview">
      <img class="fl-topbar__logo" src="icons/flui-mark.svg" alt="" width="22" height="22" />
      <span>Flui</span>
    </a>
    <div class="fl-topbar__scopes"><ng-content select="[topbarScope]" /></div>
    <button type="button" class="fl-search" (click)="searchOpen.emit()">
      <fl-icon name="lucideSearch" [size]="14" />
      <span>Search</span>
      <kbd class="fl-kbd">{{ shortcut() }}</kbd>
    </button>
    <div class="fl-topbar__end"><ng-content /></div>
  `,
})
export class FlTopbar {
  readonly home = input('/');
  readonly shortcut = input('⌘K');
  readonly searchOpen = output<void>();
}
