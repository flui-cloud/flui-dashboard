import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OidcAuthService } from '../../../../core/services/oidc-auth.service';
import { TurnstileService } from './turnstile.service';
import { visitorRefusalOf } from './visitor-refusal';

interface Admission {
  nonce: string;
  expiresInSeconds: number;
}

/** The demo's open door: a visitor looks around without an account. */
@Component({
  selector: 'app-try',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background px-4">
      <div class="flex flex-col items-center gap-4 text-center">
        <div #challenge></div>
        @if (ended) {
          <p class="text-sm">Your visit ended. Here is a new one.</p>
        }
        <p class="text-sm text-muted-foreground">Opening the demo…</p>
      </div>
    </div>
  `,
})
export class TryComponent implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly oidc = inject(OidcAuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly turnstile = inject(TurnstileService);
  private readonly challenge = viewChild.required<ElementRef<HTMLElement>>('challenge');
  readonly ended = inject(ActivatedRoute).snapshot.queryParamMap.get('ended') === '1';

  ngAfterViewInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    void this.open();
  }

  ngOnDestroy(): void {
    this.meta.removeTag("name='robots'");
  }

  async open(): Promise<void> {
    if (this.auth.isUserAuthenticated()) {
      void this.router.navigateByUrl('/', { replaceUrl: true });
      return;
    }
    const entry = await firstValueFrom(this.cfg.visitorEntry());
    if (!entry.clientId) {
      void this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    try {
      const turnstileToken = entry.turnstileSiteKey
        ? await this.turnstile.token(entry.turnstileSiteKey, this.challenge().nativeElement)
        : undefined;
      const admission = await firstValueFrom(
        this.http.post<Admission>(
          `${this.cfg.apiBaseUrl}/api/v1/sandbox/visitor/admission`,
          turnstileToken ? { turnstileToken } : {},
        ),
      );
      await this.oidc.loginAsVisitor(entry.clientId, admission.nonce);
    } catch (error) {
      void this.router.navigate(['/login'], {
        queryParams: { visitor: 'refused', reason: visitorRefusalOf(error) },
        replaceUrl: true,
      });
    }
  }
}
