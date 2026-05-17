import { Component, HostBinding, inject, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UniverseMapComponent } from '../../../features/components/topology/universe-map.component';
import { UniverseOverlayService } from '../../../features/service/universe-overlay.service';
import {
  SidebarVariant,
  CollapsibleMode,
  BrnSidebarService,
} from '@dawit-io/spartan-sidebar-core';
import {
  HlmSidebarContentHeaderComponent,
  HlmSidebarTriggerComponent,
} from '@dawit-io/spartan-sidebar';
import { provideIcons } from '@ng-icons/core';
import { lucideSun, lucideMoon } from '@ng-icons/lucide';
import { ThemeService } from '../../../core/services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { QuickSshOverlayComponent } from '../../../features/components/ssh/quick-ssh-overlay.component';
import { QuickSshDockComponent } from '../../../features/components/ssh/quick-ssh-dock.component';
import { ToastContainerComponent } from '../../../shared/components/toast-container.component';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [
    SidebarComponent,
    HlmSidebarContentHeaderComponent,
    HlmSidebarTriggerComponent,
    HeaderComponent,
    RouterOutlet,
    QuickSshOverlayComponent,
    QuickSshDockComponent,
    ToastContainerComponent,
    UniverseMapComponent,
  ],
  providers: [
    BrnSidebarService,
    provideIcons({ lucideSun, lucideMoon }),
  ],
  styles: [`
    .subtle-scroll {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
    }
    .subtle-scroll:hover {
      scrollbar-color: hsl(var(--muted-foreground) / 0.4) transparent;
    }
    .subtle-scroll::-webkit-scrollbar {
      width: 4px;
    }
    .subtle-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .subtle-scroll::-webkit-scrollbar-thumb {
      background-color: transparent;
      border-radius: 4px;
      box-shadow: inset 0 0 0 4px transparent;
      transition: box-shadow 0.3s ease;
    }
    .subtle-scroll:hover::-webkit-scrollbar-thumb {
      box-shadow: inset 0 0 0 4px hsl(var(--muted-foreground) / 0.4);
    }
    .universe-overlay {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: #02040d;
    }
  `],
  template: `
    <div class="flex bg-background border-gray h-screen">
      <sidebar
        [sidebarVariant]="sidebarVariant()"
        [collapsibleMode]="collapsibleMode()"
        class="h-full overflow-y-auto"
      >
      </sidebar>
      <div class="flex-1 flex flex-col h-full overflow-hidden">
        <hlm-sidebar-content-header class="flex-shrink-0">
          <hlm-sidebar-trigger />
          <div class="h-3 w-[1px] bg-foreground/20 ml-2 mr-2"></div>
          <div class="ml-auto bg-background"></div>
          <header></header>
        </hlm-sidebar-content-header>
        <div class="flex-1 overflow-y-auto p-2 subtle-scroll">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
    <app-quick-ssh-overlay />
    <app-quick-ssh-dock />
    <app-toast-container />

    @if (universeOverlay.isOpen()) {
      <app-universe-map class="universe-overlay" />
    }
  `,
})
export class ShellLayoutComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly universeOverlay = inject(UniverseOverlayService);
  sidebarVariant = input<SidebarVariant>('sidebar');
  collapsibleMode = input<CollapsibleMode>('icon');

  @HostBinding('class.dark') get mode() {
    return this.themeService.isDarkMode();
  }
}
