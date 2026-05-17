import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideEcharts } from 'ngx-echarts';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { Configuration } from './core/api';
import { AppConfigService } from './core/services/app-config.service';
import { NotificationService } from './core/services/notification.service';
import { OidcAuthService } from './core/services/oidc-auth.service';
import { AuthService } from './core/services/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideEcharts(),
    provideOAuthClient(),
    provideAppInitializer(async () => {
      const cfg = inject(AppConfigService);
      const oidc = inject(OidcAuthService);
      const auth = inject(AuthService);
      const apiConfig = inject(Configuration);

      await firstValueFrom(cfg.load());

      // Update basePath after config is loaded from config.json
      apiConfig.basePath = cfg.apiBaseUrl;

      if (cfg.authMode === 'oidc') {
        await oidc.init();
      }

      auth.refreshAuthState();

      if (auth.isUserAuthenticated()) {
        await firstValueFrom(auth.loadCurrentUser());
      }
    }),
    provideAppInitializer(() => {
      inject(NotificationService).bootstrapWebSocketListeners();
    }),
    {
      provide: Configuration,
      useFactory: (cfg: AppConfigService) => new Configuration({ basePath: cfg.apiBaseUrl, withCredentials: true }),
      deps: [AppConfigService],
    },
  ],
};
