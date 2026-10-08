import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AppConfigService } from './app-config.service';

export interface SandboxSession {
  /** False while the guest has only looked around: the first deploy takes an area. */
  hasArea: boolean;
  expiresAt: string | null;
  secondsRemaining: number;
  ttlHours: number;
  /**
   * How long what the guest deploys lasts — shorter than the area itself, and
   * the number the banner states. Optional because an older instance does not
   * send it, and a screen that invents a deadline is worse than one that keeps
   * quiet about it.
   */
  workloadTtlHours?: number;
  loginUrl: string;
}

export type SandboxLevel = 'full' | 'read-only' | 'stand-in' | 'closed';

export interface SandboxArea {
  key: string;
  area: string;
  level: SandboxLevel;
  why: string;
}

interface SandboxLimits {
  areas: SandboxArea[];
}

export const SANDBOX_LEVEL_LABEL: Record<SandboxLevel, string> = {
  full: '',
  'read-only': 'Read-only in the trial',
  'stand-in': 'Example data',
  closed: 'Not part of the trial',
};

@Injectable({ providedIn: 'root' })
export class SandboxService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly _session = signal<SandboxSession | null>(null);
  private readonly _areas = signal<SandboxArea[]>([]);
  // Counted down locally: the display moves every second, the server is asked rarely.
  private readonly _secondsRemaining = signal(0);
  private ticker?: ReturnType<typeof setInterval>;

  readonly session = this._session.asReadonly();
  readonly areas = this._areas.asReadonly();
  readonly inSandbox = computed(() => this._session() !== null);
  readonly secondsRemaining = this._secondsRemaining.asReadonly();
  readonly workloadTtlHours = computed(
    () => this._session()?.workloadTtlHours ?? null,
  );

  readonly hasArea = computed(() => this._session()?.hasArea === true);

  readonly urgent = computed(
    () => this.hasArea() && this._secondsRemaining() < 3600,
  );
  readonly expired = computed(
    () => this.hasArea() && this._secondsRemaining() <= 0,
  );

  private get base(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/sandbox`;
  }

  refresh(): void {
    this.probe().subscribe();
  }

  /** "Keep my apps": counts as an action, so their deadline moves. */
  keep(): Observable<boolean> {
    return this.http.post<SandboxSession>(`${this.base}/keep`, {}).pipe(
      map((session) => {
        this.adopt(session);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  levelOf(key: string): SandboxLevel {
    if (!this.inSandbox()) return 'full';
    return this._areas().find((a) => a.key === key)?.level ?? 'full';
  }

  whyFor(key: string): string {
    return this._areas().find((a) => a.key === key)?.why ?? '';
  }

  private loadAreas(): void {
    if (this._areas().length > 0) return;
    this.http
      .get<SandboxLimits>(`${this.base}/limits`)
      .pipe(catchError(() => of({ areas: [] as SandboxArea[] })))
      .subscribe((limits) => this._areas.set(limits.areas ?? []));
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
    this.loadAreas();
    this._secondsRemaining.set(Math.max(0, session.secondsRemaining));
    if (session.hasArea) this.startTicking();
    else this.stopTicking();
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
}

export const SANDBOX_ROUTE_AREAS: ReadonlyArray<readonly [string, string]> = [
  ['/infrastructure/compute', 'providers'],
  ['/infrastructure/vnet', 'providers'],
  ['/infrastructure/firewall', 'firewall'],
  ['/infrastructure/domains', 'dns-zones'],
  ['/infrastructure/keys', 'keys'],
  ['/infrastructure/platform-components', 'platform-config'],
  ['/management/providers', 'providers'],
  ['/management/backup', 'backups'],
  ['/management/access', 'access'],
  ['/management/migrations', 'migrations'],
  ['/management/mail', 'mail'],
  ['/mail', 'mail'],
  ['/cluster', 'cluster'],
  ['/management/operating-context', 'operating-context'],
];

export function sandboxAreaForUrl(url: string): string | null {
  const match = SANDBOX_ROUTE_AREAS.filter(([prefix]) =>
    url.startsWith(prefix),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : null;
}

export function isSandboxRefusalCode(code: unknown): boolean {
  return typeof code === 'string' && code.startsWith('SANDBOX_');
}

export function sandboxRefusalCode(error: unknown): string | null {
  const code = (error as { error?: { code?: unknown } } | null)?.error?.code;
  return isSandboxRefusalCode(code) ? (code as string) : null;
}

export function isSandboxRefusal(error: unknown): boolean {
  return sandboxRefusalCode(error) !== null;
}

export function sandboxFailureMessage(
  error: unknown,
  fallback: string,
): string | null {
  return isSandboxRefusal(error) ? null : fallback;
}

/**
 * A deadline a person can read at a glance.
 *
 * Days appear above two of them because an area now lasts a week, and
 * `167:59:42` is a number somebody has to divide before it means anything. The
 * ticking clock stays for the last day, where the seconds are the point.
 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86_400);
  if (days >= 2) {
    const hours = Math.floor((s % 86_400) / 3600);
    return hours > 0 ? `${days} days ${hours}h` : `${days} days`;
  }
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
