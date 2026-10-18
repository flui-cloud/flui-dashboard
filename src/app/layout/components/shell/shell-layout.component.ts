import { Component, HostBinding, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, take } from 'rxjs';
import {
  SidebarVariant,
  CollapsibleMode,
  BrnSidebarService,
  BrnSidebarSearchService,
  BrnSidebarPinService,
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
import { AssistantWidgetComponent } from '../../../features/components/assistant/assistant-widget.component';
import { FluiBackdropComponent } from '../../../shared/components/flui-backdrop/flui-backdrop.component';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { VisitorSignInDialogComponent } from './visitor-sign-in-dialog.component';
import { InstallFluiDialogComponent } from './install-flui-dialog.component';
import { SandboxSectionNoticeComponent } from './sandbox-section-notice.component';
import { PAGE_WIDTH_CLASS, pageWidth } from './page-width';
import { PlatformUpdateWatcherComponent } from '../../../features/components/platform-updates/platform-update-watcher.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { VisitorSignInService } from '../../../core/services/visitor-sign-in.service';

@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [
    PlatformUpdateWatcherComponent,
    SandboxSectionNoticeComponent,
    SidebarComponent,
    HlmSidebarContentHeaderComponent,
    HlmSidebarTriggerComponent,
    HeaderComponent,
    RouterOutlet,
    QuickSshOverlayComponent,
    QuickSshDockComponent,
    ToastContainerComponent,
    AssistantWidgetComponent,
    FluiBackdropComponent,
    SandboxBannerComponent,
    VisitorSignInDialogComponent,
    InstallFluiDialogComponent,
  ],
  providers: [
    BrnSidebarService,
    BrnSidebarSearchService,
    BrnSidebarPinService,
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
  `],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex bg-background border-gray h-screen">
      <sidebar
        [sidebarVariant]="sidebarVariant()"
        [collapsibleMode]="collapsibleMode()"
        class="h-full overflow-y-auto"
      >
      </sidebar>
      <div class="flex-1 flex flex-col h-full overflow-hidden">
        <app-sandbox-banner class="flex-shrink-0" />
        <hlm-sidebar-content-header class="flex-shrink-0">
          <hlm-sidebar-trigger />
          <div class="h-3 w-[1px] bg-foreground/20 ml-2 mr-2"></div>
          <div class="ml-auto bg-background"></div>
          <header></header>
        </hlm-sidebar-content-header>
        <div class="relative flex-1 overflow-hidden">
          <app-flui-backdrop placement="bottom-right" intensity="soft" />
          <div class="page-outlet absolute inset-0 overflow-y-auto p-2 subtle-scroll">
            <div class="mx-auto w-full" [class]="widthClass()">
              <app-sandbox-section-notice />
              <router-outlet></router-outlet>
            </div>
          </div>
        </div>
      </div>
    </div>
    <app-quick-ssh-overlay />
    <app-quick-ssh-dock />
    <app-toast-container />
    <app-visitor-sign-in-dialog />
    <app-install-flui-dialog />
    <app-platform-update-watcher />
    <!-- Hide the global Flui assistant where a section has its own assistant
         (e.g. the SQL console), to avoid two floating assistants competing. -->
    @if (!hideAssistant()) {
      <app-assistant-widget />
    }
  `,
})
export class ShellLayoutComponent {
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly sandbox = inject(SandboxService);
  private readonly visitorSignIn = inject(VisitorSignInService);

  /** Recomputed on each navigation, from the route the page was reached by. */
  protected readonly widthClass = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => PAGE_WIDTH_CLASS[pageWidth(this.router.routerState.snapshot.root, this.router.url)]),
    ),
    { initialValue: PAGE_WIDTH_CLASS[pageWidth(this.router.routerState.snapshot.root, this.router.url)] },
  );

  constructor() {
    // A guest returning to an open tab has the cookie but not the session state.
    this.sandbox.refresh();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), take(1))
      .subscribe(() => void this.visitorSignIn.handleReturn());
  }

  // Routes that ship their own assistant — hide the global floating one there.
  private static readonly OWN_ASSISTANT = [
    '/db-console',
    '/kv-console',
    '/doc-console',
    '/object-store-console',
    '/search-console',
    '/messaging-console',
  ];
  private hasOwnAssistant(url: string): boolean {
    return ShellLayoutComponent.OWN_ASSISTANT.some((r) => url.includes(r));
  }
  protected readonly hideAssistant = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.hasOwnAssistant(this.router.url)),
    ),
    { initialValue: this.hasOwnAssistant(this.router.url) },
  );
  sidebarVariant = input<SidebarVariant>('sidebar');
  collapsibleMode = input<CollapsibleMode>('icon');

  @HostBinding('class.dark') get mode() {
    return this.themeService.isDarkMode();
  }
}
