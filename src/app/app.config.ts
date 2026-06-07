import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideEcharts } from 'ngx-echarts';
import { Renderer, type Tokens } from 'marked';
import { MARKED_OPTIONS, provideMarkdown } from 'ngx-markdown';
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
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useFactory: () => {
          const renderer = new Renderer();
          renderer.code = ({ text, lang }: Tokens.Code) => {
            const language = lang ?? 'text';
            const escaped = text
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;');
            return `<div class="md-code-block"><div class="md-code-header"><span class="md-code-lang">${language}</span><span class="md-copy-btn" role="button" tabindex="0">Copy</span></div><pre><code>${escaped}</code></pre></div>`;
          };
          return { renderer };
        },
      },
    }),
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
