import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeftRight,
  lucideBot,
  lucideBoxes,
  lucideChartColumn,
  lucideCloud,
  lucideContainer,
  lucideDatabase,
  lucideDownload,
  lucideEuro,
  lucideFileText,
  lucideFolder,
  lucideGitBranch,
  lucideGithub,
  lucideGlobe,
  lucideHistory,
  lucideKeyRound,
  lucideLayers,
  lucideLayoutGrid,
  lucideMail,
  lucideNetwork,
  lucidePackage,
  lucideServer,
  lucideSettings,
  lucideShield,
  lucideStore,
  lucideUpload,
  lucideUsers,
  lucideWorkflow,
} from '@ng-icons/lucide';
import { QuickSshOverlayComponent } from '../../../features/components/ssh/quick-ssh-overlay.component';
import { QuickSshDockComponent } from '../../../features/components/ssh/quick-ssh-dock.component';
import { ToastContainerComponent } from '../../../shared/components/toast-container.component';
import { AssistantWidgetComponent } from '../../../features/components/assistant/assistant-widget.component';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { VisitorSignInDialogComponent } from './visitor-sign-in-dialog.component';
import { InstallFluiDialogComponent } from './install-flui-dialog.component';
import { SandboxSectionNoticeComponent } from './sandbox-section-notice.component';
import { PAGE_WIDTH_CLASS, focusMode, pageWidth } from './page-width';
import { PlatformUpdateWatcherComponent } from '../../../features/components/platform-updates/platform-update-watcher.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { VisitorSignInService } from '../../../core/services/visitor-sign-in.service';
import { ThemeService } from '../../../core/services/theme.service';
import { FlSidenav } from '../../../ui/frame/sidenav';
import { CommandPaletteService } from '../../../ui/frame/command-palette';
import { ConsoleNav } from '../../console/console-nav';
import { ConsoleTopbar } from '../../console/console-topbar';

const OWN_ASSISTANT = [
  '/db-console',
  '/kv-console',
  '/doc-console',
  '/object-store-console',
  '/search-console',
  '/messaging-console',
];

@Component({
  selector: 'app-shell-layout',
  imports: [
    RouterOutlet,
    ConsoleTopbar,
    FlSidenav,
    PlatformUpdateWatcherComponent,
    SandboxSectionNoticeComponent,
    QuickSshOverlayComponent,
    QuickSshDockComponent,
    ToastContainerComponent,
    AssistantWidgetComponent,
    SandboxBannerComponent,
    VisitorSignInDialogComponent,
    InstallFluiDialogComponent,
  ],
  providers: [
    ConsoleNav,
    provideIcons({
      lucideActivity,
      lucideArrowLeftRight,
      lucideBot,
      lucideBoxes,
      lucideChartColumn,
      lucideCloud,
      lucideContainer,
      lucideDatabase,
      lucideDownload,
      lucideEuro,
      lucideFileText,
      lucideFolder,
      lucideGitBranch,
      lucideGithub,
      lucideGlobe,
      lucideHistory,
      lucideKeyRound,
      lucideLayers,
      lucideLayoutGrid,
      lucideMail,
      lucideNetwork,
      lucidePackage,
      lucideServer,
      lucideSettings,
      lucideShield,
      lucideStore,
      lucideUpload,
      lucideUsers,
      lucideWorkflow,
    }),
  ],
  host: { class: 'fl-shell', '(document:keydown)': 'onKeydown($event)' },
  template: `
    <app-console-topbar
      [navOpen]="navOpen()"
      [menuAlways]="focus()"
      (menuToggle)="navOpen.set(!navOpen())"
      (searchOpen)="openSearch()"
    />
    <app-sandbox-banner />
    <div class="fl-shell__body">
      @if (!focus() || navOpen()) {
        <fl-sidenav
          class="fl-shell__nav"
          [class.is-open]="navOpen()"
          [class.fl-shell__nav--overlay]="focus()"
          [sections]="nav.sections()"
          (navigate)="navOpen.set(false)"
        />
      }
      @if (navOpen()) {
        <button
          type="button"
          class="fl-shell__scrim"
          aria-label="Close menu"
          (click)="navOpen.set(false)"
        ></button>
      }
      <main class="fl-shell__main page-outlet" id="main">
        <div class="mx-auto w-full p-2" [class]="widthClass()">
          <app-sandbox-section-notice />
          <router-outlet />
        </div>
      </main>
    </div>
    <app-quick-ssh-overlay />
    <app-quick-ssh-dock />
    <app-toast-container />
    <app-visitor-sign-in-dialog />
    <app-install-flui-dialog />
    <app-platform-update-watcher />
    @if (!hideAssistant()) {
      <app-assistant-widget />
    }
  `,
})
export class ShellLayoutComponent {
  private readonly router = inject(Router);
  private readonly sandbox = inject(SandboxService);
  private readonly visitorSignIn = inject(VisitorSignInService);
  private readonly palette = inject(CommandPaletteService);
  protected readonly nav = inject(ConsoleNav);
  protected readonly navOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly widthClass = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(
        () => PAGE_WIDTH_CLASS[pageWidth(this.router.routerState.snapshot.root, this.router.url)],
      ),
    ),
    {
      initialValue:
        PAGE_WIDTH_CLASS[pageWidth(this.router.routerState.snapshot.root, this.router.url)],
    },
  );

  protected readonly focus = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => focusMode(this.router.routerState.snapshot.root)),
    ),
    { initialValue: focusMode(this.router.routerState.snapshot.root) },
  );

  protected readonly hideAssistant = computed(() =>
    OWN_ASSISTANT.some((r) => this.url().includes(r)),
  );

  constructor() {
    inject(ThemeService);
    this.nav.load();
    this.sandbox.refresh();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        take(1),
      )
      .subscribe(() => void this.visitorSignIn.handleReturn());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void this.openSearch();
    }
  }

  protected async openSearch(): Promise<void> {
    const link = await this.palette.pick(this.nav.paletteEntries());
    if (link) void this.router.navigateByUrl(link);
  }
}
