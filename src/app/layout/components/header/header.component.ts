import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideSun, lucideMoon, lucideTerminal, lucideOrbit, lucideEyeOff, lucideEye } from '@ng-icons/lucide';
import { ThemeService } from '../../../core/services/theme.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { NotificationPanelComponent } from '../notifications/notification-panel.component';
import { QuickSshService } from '../../../features/service/quick-ssh.service';
import { UniverseOverlayService } from '../../../features/service/universe-overlay.service';

// Stated on the toggle rather than in a settings page: the address bar is
// the one surface mask mode cannot reach, and that is worth reading at the
// moment someone turns it on.
const MASK_MODE_TOOLTIP =
  "Mask mode substitutes sensitive values (IPs, emails, credentials) in what the dashboard renders. " +
  "It cannot hide your browser's own address bar — an instance domain there (e.g. an IP-literal nip.io " +
  "address) stays visible during a live screen-share; only cropped or viewport screenshots are unaffected.";

@Component({
  selector: 'header',
  standalone: true,
  imports: [NgIcon, NotificationPanelComponent],
  providers: [
    provideIcons({ lucideGithub, lucideSun, lucideMoon, lucideTerminal, lucideOrbit, lucideEyeOff, lucideEye }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex items-center gap-1">
      <app-notification-panel />

      <!-- Universe Map -->
      <button
        type="button"
        (click)="universeOverlay.open()"
        class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Universe Map">
        <ng-icon name="lucideOrbit" class="h-4 w-4" />
      </button>

      <!-- Quick SSH button -->
      <button
        (click)="quickSsh.toggle()"
        class="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Quick SSH access">
        <ng-icon name="lucideTerminal" class="h-4 w-4" />
        @if (quickSsh.hasActiveSession()) {
          <span class="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background"></span>
        }
      </button>

      <!-- Mask mode toggle -->
      <button
        type="button"
        data-testid="mask-mode-toggle"
        (click)="maskMode.toggle()"
        class="p-1.5 rounded-md hover:bg-muted transition-colors"
        [class.text-amber-500]="maskMode.enabled()"
        [class.text-muted-foreground]="!maskMode.enabled()"
        [class.hover:text-foreground]="!maskMode.enabled()"
        [title]="(maskMode.enabled() ? 'Mask mode is on — click to turn off. ' : 'Mask mode is off — click to turn on before screen-sharing. ') + maskModeTooltip">
        <ng-icon [name]="maskMode.enabled() ? 'lucideEyeOff' : 'lucideEye'" class="h-4 w-4" />
      </button>

      <button
        (click)="themeService.toggleDarkMode()"
        class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        [title]="themeService.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'">
        <ng-icon
          [name]="themeService.isDarkMode() ? 'lucideSun' : 'lucideMoon'"
          class="h-4 w-4"
        />
      </button>
      <a
        href="https://github.com/flui-cloud"
        target="_blank"
        rel="noopener noreferrer"
        class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
        <ng-icon name="lucideGithub" class="h-4 w-4" />
      </a>
    </div>
  `
})
export class HeaderComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly maskMode = inject(MaskModeService);
  protected readonly quickSsh = inject(QuickSshService);
  protected readonly universeOverlay = inject(UniverseOverlayService);

  protected readonly maskModeTooltip = MASK_MODE_TOOLTIP;
}
