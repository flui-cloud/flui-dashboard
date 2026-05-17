import { Component, HostBinding, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NetworkStatusBannerComponent } from './shared/components/network-status-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NetworkStatusBannerComponent],
  providers: [ThemeService],
  template: `
    <router-outlet></router-outlet>
    <app-network-status-banner />
  `,
})
export class AppComponent {
  protected readonly themeService = inject(ThemeService);

  @HostBinding('class.dark') get mode() {
    return this.themeService.isDarkMode();
  }
}
