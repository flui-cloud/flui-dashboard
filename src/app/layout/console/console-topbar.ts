import { CdkMenu, CdkMenuItem, CdkMenuItemCheckbox, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, OnInit, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCircleHelp, lucideMenu, lucideTerminal } from '@ng-icons/lucide';
import { AuthService } from '../../core/services/auth.service';
import { MaskModeService } from '../../core/services/mask-mode.service';
import { SandboxService } from '../../core/services/sandbox.service';
import { SystemAppsPreference } from '../../core/services/system-apps-preference.service';
import { FLUI_CORE_REPO_URL } from '../../core/utils/install-flui';
import { PlatformVersionService } from '../../features/service/platform-version.service';
import { QuickSshService } from '../../features/service/quick-ssh.service';
import { FlTopbar } from '../../ui/frame/topbar';
import { FlIcon } from '../../ui/primitives/icon';
import { NotificationPanelComponent } from '../components/notifications/notification-panel.component';
import { userBadge } from './user-badge';

@Component({
  selector: 'app-console-topbar',
  imports: [
    FlTopbar,
    FlIcon,
    RouterLink,
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemCheckbox,
    CdkMenuTrigger,
    NotificationPanelComponent,
  ],
  providers: [provideIcons({ lucideCheck, lucideCircleHelp, lucideMenu, lucideTerminal })],
  template: `
    <fl-topbar home="/dashboard" (searchOpen)="searchOpen.emit()">
      <button
        topbarStart
        type="button"
        class="fl-topbar__icon fl-topbar__menu"
        aria-label="Menu"
        [attr.aria-expanded]="navOpen()"
        (click)="menuToggle.emit()"
      >
        <fl-icon name="lucideMenu" />
      </button>

      <button
        type="button"
        class="fl-topbar__icon"
        [attr.aria-label]="ssh.hasActiveSession() ? 'SSH, a session is open' : 'SSH'"
        (click)="ssh.toggle()"
      >
        <fl-icon name="lucideTerminal" />
        @if (ssh.hasActiveSession()) {
          <span class="fl-topbar__dot"></span>
        }
      </button>
      <app-notification-panel />
      <button type="button" class="fl-topbar__icon" aria-label="Help" [cdkMenuTriggerFor]="help">
        <fl-icon name="lucideCircleHelp" />
      </button>
      <button
        type="button"
        class="fl-topbar__user"
        aria-label="Account menu"
        [cdkMenuTriggerFor]="user"
      >
        <span class="fl-avatar">{{ badge().initials }}</span>
        <span class="fl-topbar__username">{{ badge().name }}</span>
      </button>
    </fl-topbar>

    <ng-template #help>
      <div class="fl-menu" cdkMenu>
        <a class="fl-menu__item" cdkMenuItem routerLink="/management/operating-context"
          >How Flui is run</a
        >
        <a
          class="fl-menu__item"
          cdkMenuItem
          [href]="repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          >Source code</a
        >
        @if (version(); as v) {
          <div class="fl-menu__sep" role="separator"></div>
          <div class="fl-menu__note" [title]="v.detail">Flui {{ v.label }}</div>
        }
      </div>
    </ng-template>

    <ng-template #user>
      <div class="fl-menu" cdkMenu>
        <div class="fl-menu__note">
          <span class="fl-menu__note-title">{{ badge().name }}</span>
          {{ badge().email }}
        </div>
        <div class="fl-menu__sep" role="separator"></div>
        @if (!visitor()) {
          <a class="fl-menu__item" cdkMenuItem routerLink="/account">Account</a>
        }
        <a class="fl-menu__item" cdkMenuItem routerLink="/settings">Settings</a>
        <div class="fl-menu__sep" role="separator"></div>
        <button
          type="button"
          class="fl-menu__item"
          cdkMenuItemCheckbox
          [cdkMenuItemChecked]="systemApps.shown()"
          (cdkMenuItemTriggered)="systemApps.toggle()"
        >
          <span class="fl-menu__check" aria-hidden="true">
            @if (systemApps.shown()) {
              <fl-icon name="lucideCheck" [size]="14" />
            }
          </span>
          Show system apps
        </button>
        <button
          type="button"
          class="fl-menu__item"
          cdkMenuItemCheckbox
          [cdkMenuItemChecked]="mask.enabled()"
          [title]="maskHint"
          (cdkMenuItemTriggered)="toggleMask()"
        >
          <span class="fl-menu__check" aria-hidden="true">
            @if (mask.enabled()) {
              <fl-icon name="lucideCheck" [size]="14" />
            }
          </span>
          Mask sensitive values
        </button>
        <div class="fl-menu__sep" role="separator"></div>
        <button type="button" class="fl-menu__item" cdkMenuItem (cdkMenuItemTriggered)="logout()">
          Log out
        </button>
      </div>
    </ng-template>
  `,
})
export class ConsoleTopbar implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sandbox = inject(SandboxService);
  private readonly router = inject(Router);
  private readonly platformVersion = inject(PlatformVersionService);
  protected readonly ssh = inject(QuickSshService);
  protected readonly mask = inject(MaskModeService);
  protected readonly systemApps = inject(SystemAppsPreference);

  readonly navOpen = input(false);
  readonly menuToggle = output<void>();
  readonly searchOpen = output<void>();

  protected readonly repoUrl = FLUI_CORE_REPO_URL;
  protected readonly maskHint =
    "Substitutes IPs, emails and credentials in what the console shows. It cannot hide the browser's address bar.";
  protected readonly visitor = this.sandbox.visitor;
  protected readonly badge = computed(() =>
    userBadge(this.auth.currentUser(), {
      masked: this.mask.enabled(),
      visitor: this.sandbox.visitor(),
    }),
  );
  protected readonly version = computed(() => {
    const v = this.platformVersion.version();
    if (!v) return null;
    return {
      label: `v${v.version}`,
      detail: `API ${v.components.fluiApi} · Web ${v.components.fluiWeb} · Authz ${v.components.fluiAuthz}`,
    };
  });

  ngOnInit(): void {
    void this.platformVersion.load();
  }

  protected toggleMask(): void {
    this.mask.toggle();
    window.location.reload();
  }

  protected logout(): void {
    this.auth.logout().subscribe({ complete: () => void this.router.navigate(['/login']) });
  }
}
