import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideSun, lucideMoon, lucideTerminal, lucideOrbit } from '@ng-icons/lucide';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationPanelComponent } from '../notifications/notification-panel.component';
import { QuickSshService } from '../../../features/service/quick-ssh.service';
import { UniverseOverlayService } from '../../../features/service/universe-overlay.service';

@Component({
  selector: 'header',
  standalone: true,
  imports: [NgIcon, NotificationPanelComponent],
  providers: [
    provideIcons({ lucideGithub, lucideSun, lucideMoon, lucideTerminal, lucideOrbit }),
  ],
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
  protected readonly quickSsh = inject(QuickSshService);
  protected readonly universeOverlay = inject(UniverseOverlayService);
}
