import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface SandboxSession {
  namespace: string;
  email: string;
  expiresAt: string;
  secondsRemaining: number;
  ttlHours: number;
}

export interface SandboxClaim extends SandboxSession {
  apiKey?: string;
  loginUrl: string;
}

export type SandboxClaimFailure =
  | 'full'
  | 'closed'
  | 'limit'
  | 'disabled'
  | 'unknown';

export interface SandboxClaimError {
  reason: SandboxClaimFailure;
  message: string;
}

const MESSAGES: Record<SandboxClaimFailure, string> = {
  full: 'Every sandbox is taken right now. They are released continuously, so this usually clears within a few minutes.',
  closed:
    'The sandbox is not accepting new visitors at the moment. Anyone already inside is unaffected.',
  limit:
    'This address already has a sandbox open. They last 24 hours — carry on in the one you have.',
  disabled: 'This instance does not run a sandbox.',
  unknown: 'The sandbox could not be reached. Try again in a moment.',
};

@Injectable({ providedIn: 'root' })
export class SandboxService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly _session = signal<SandboxSession | null>(null);
  // Counted down locally: the display moves every second, the server is asked rarely.
  private readonly _secondsRemaining = signal(0);
  private ticker?: ReturnType<typeof setInterval>;

  readonly session = this._session.asReadonly();
  readonly inSandbox = computed(() => this._session() !== null);
  readonly secondsRemaining = this._secondsRemaining.asReadonly();

  readonly urgent = computed(
    () => this.inSandbox() && this._secondsRemaining() < 3600,
  );
  readonly expired = computed(
    () => this.inSandbox() && this._secondsRemaining() <= 0,
  );

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/sandbox`;
  }

  claim(): Observable<SandboxClaim> {
    return this.http.post<SandboxClaim>(`${this.base}/claim`, {}).pipe(
      tap((claim) => this.adopt(claim)),
      catchError((error: HttpErrorResponse) =>
        throwError(() => this.describe(error)),
      ),
    );
  }

  refresh(): void {
    this.probe().subscribe();
  }

  // Never errors: not being in a sandbox is an answer, not a failure.
  probe(): Observable<boolean> {
    return this.http.get<SandboxSession>(`${this.base}/session`).pipe(
      map((session) => {
        this.adopt(session);
        return true;
      }),
      catchError(() => {
        this.clear();
        return of(false);
      }),
    );
  }

  private adopt(session: SandboxSession): void {
    this._session.set(session);
    this._secondsRemaining.set(Math.max(0, session.secondsRemaining));
    this.startTicking();
  }

  private clear(): void {
    this._session.set(null);
    this._secondsRemaining.set(0);
    this.stopTicking();
  }

  private startTicking(): void {
    this.stopTicking();
    this.ticker = setInterval(() => {
      const left = this._secondsRemaining();
      if (left <= 0) {
        this.stopTicking();
        return;
      }
      this._secondsRemaining.set(left - 1);
    }, 1000);
  }

  private stopTicking(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  private reasonFor(
    code: string | undefined,
    status: number,
  ): SandboxClaimFailure {
    if (code === 'SANDBOX_FULL' || status === 503) return 'full';
    if (code === 'SANDBOX_CLOSED') return 'closed';
    if (code === 'SANDBOX_CLAIM_LIMIT' || status === 409) return 'limit';
    if (status === 404) return 'disabled';
    return 'unknown';
  }

  private describe(error: HttpErrorResponse): SandboxClaimError {
    const code = error.error?.code as string | undefined;
    const reason = this.reasonFor(code, error.status);
    // The server's wording wins: it knows the real limit and remaining time.
    return {
      reason,
      message: (error.error?.message as string) || MESSAGES[reason],
    };
  }
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
