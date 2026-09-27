import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../../core/services/app-config.service';

/**
 * Where a gateway route that requires a Flui login sends a browser without a
 * session. The person is signed in here; this page asks for a one-time code
 * for that route and hands the browser back to it.
 */
@Component({
  selector: 'app-gateway-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background p-4">
      <div class="max-w-md w-full rounded-lg border border-border bg-card p-6 space-y-2">
        @if (error()) {
          <h1 class="text-base font-semibold">Could not open this page</h1>
          <p class="text-sm text-muted-foreground">{{ error() }}</p>
        } @else {
          <h1 class="text-base font-semibold">Signing you in…</h1>
          <p class="text-sm text-muted-foreground">
            You will be taken back to the page you asked for.
          </p>
        }
      </div>
    </div>
  `,
})
export class GatewayLoginComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.handOver();
  }

  private async handOver(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const routeId = params.get('route');
    const returnUrl = params.get('return');
    if (!routeId || !returnUrl) {
      this.error.set('The link is incomplete. Open the page you wanted again.');
      return;
    }
    try {
      const { redirect } = await firstValueFrom(
        this.http.post<{ redirect: string }>(
          `${this.config.apiBaseUrl}/api/v1/authz/gateway/${encodeURIComponent(routeId)}/sso-code`,
          { returnUrl },
        ),
      );
      window.location.assign(redirect);
    } catch (err: any) {
      this.error.set(
        err?.status === 403
          ? 'Your account does not have access to this page.'
          : (err?.error?.message ?? 'Sign-in could not be completed.'),
      );
    }
  }
}
