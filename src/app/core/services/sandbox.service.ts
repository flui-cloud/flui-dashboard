import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { FenceRule, fenceAllows, parseFenceRule } from './sandbox-fence';

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
  /** Until when the guest's applications stay if nothing else happens; each action moves it. */
  appsKeptUntil?: string | null;
  loginUrl: string;
}

export type SandboxLevel = 'full' | 'read-only' | 'stand-in' | 'closed';

export interface SandboxArea {
  key: string;
  area: string;
  level: SandboxLevel;
  why: string;
}

export interface SandboxQuota {
  cpu: string;
  memory: string;
  storage: string;
  pods?: number | string;
}

interface SandboxLimits {
  areas: SandboxArea[];
  allowed?: Array<{ routes: string[] }>;
  quota?: SandboxQuota;
}

export const SANDBOX_LEVEL_LABEL: Record<SandboxLevel, string> = {
  full: '',
  'read-only': 'Read-only in the trial',
  'stand-in': 'Example data',
  closed: 'Not part of the trial',
};

/** The last answer, so a reload knows it is a guest before the first call leaves. */
const REMEMBERED_KEY = 'flui:sandbox';

interface Remembered {
  session: SandboxSession;
  areas: SandboxArea[];
  fence: string[];
}

function recall(): Remembered | null {
  try {
    const raw = sessionStorage.getItem(REMEMBERED_KEY);
    return raw ? (JSON.parse(raw) as Remembered) : null;
  } catch {
    return null;
  }
}

function remember(value: Remembered | null): void {
  try {
    if (value) sessionStorage.setItem(REMEMBERED_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(REMEMBERED_KEY);
  } catch {
    // A browser that refuses storage only loses the head start.
  }
}

@Injectable({ providedIn: 'root' })
export class SandboxService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly _session = signal<SandboxSession | null>(null);
  private readonly _areas = signal<SandboxArea[]>([]);
  private readonly _fence = signal<FenceRule[]>([]);
  private readonly _quota = signal<SandboxQuota | null>(null);
  /** What one guest's space may use, as the API states it. */
  readonly quota = this._quota.asReadonly();
  // Counted down locally: the display moves every second, the server is asked rarely.
  private readonly _secondsRemaining = signal(0);
  private ticker?: ReturnType<typeof setInterval>;
  private fenceRoutes: string[] = [];
  private markKnown!: () => void;
  private readonly known = new Promise<void>((resolve) => (this.markKnown = resolve));

  constructor() {
    const remembered = recall();
    if (!remembered) return;
    this._session.set(remembered.session);
    this._areas.set(remembered.areas);
    this.setFence(remembered.fence);
    this.markKnown();
  }

  /**
   * Whether the caller is a demo guest, once that is known. Screens that load
   * the operator's control room ask this first, so a guest's first page does not
   * send what the fence refuses. Never waits more than a few seconds: an answer
   * that does not come is taken as "not a guest", and the API still decides.
   */
  async whenKnown(maxWaitMs = 4000): Promise<boolean> {
    await Promise.race([this.known, new Promise((r) => setTimeout(r, maxWaitMs))]);
    return this.inSandbox();
  }

  readonly session = this._session.asReadonly();
  readonly areas = this._areas.asReadonly();
  readonly inSandbox = computed(() => this._session() !== null);
  readonly secondsRemaining = this._secondsRemaining.asReadonly();
  readonly workloadTtlHours = computed(
    () => this._session()?.workloadTtlHours ?? null,
  );

  readonly hasArea = computed(() => this._session()?.hasArea === true);
  readonly appsKeptUntil = computed(() => this._session()?.appsKeptUntil ?? null);

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

  /**
   * Whether the API's fence lets a guest make this call. Until the limits
   * arrive the answer is yes: the API still decides.
   */
  allows(method: string, apiPath: string): boolean {
    if (!this.inSandbox()) return true;
    const fence = this._fence();
    return fence.length === 0 || fenceAllows(fence, method, apiPath);
  }

  whyFor(key: string): string {
    return this._areas().find((a) => a.key === key)?.why ?? '';
  }

  private limitsAsked = false;

  private loadAreas(): void {
    if (this.limitsAsked) return;
    this.limitsAsked = true;
    this.http
      .get<SandboxLimits>(`${this.base}/limits`)
      .pipe(catchError(() => of({ areas: [] as SandboxArea[] } as SandboxLimits)))
      .subscribe((limits) => {
        this._areas.set(limits.areas ?? []);
        this._quota.set(limits.quota ?? null);
        this.setFence((limits.allowed ?? []).flatMap((rule) => rule.routes));
        this.persist();
      });
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

  private setFence(routes: string[]): void {
    this.fenceRoutes = routes;
    this._fence.set(
      routes.map(parseFenceRule).filter((rule): rule is FenceRule => rule !== null),
    );
  }

  private persist(): void {
    const session = this._session();
    remember(
      session ? { session, areas: this._areas(), fence: this.fenceRoutes } : null,
    );
  }

  private adopt(session: SandboxSession): void {
    this._session.set(session);
    this.persist();
    this.markKnown();
    this.loadAreas();
    this._secondsRemaining.set(Math.max(0, session.secondsRemaining));
    if (session.hasArea) this.startTicking();
    else this.stopTicking();
  }

  private clear(): void {
    this._session.set(null);
    remember(null);
    this.markKnown();
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
  ['/cluster/*/storage', 'storage'],
  ['/cluster/*/scaling', 'scaling'],
  ['/cluster/*/firewall', 'firewall'],
  ['/cluster/*/variables', 'platform-config'],
  ['/cluster/*/pricing', 'pricing'],
  ['/scaling', 'scaling'],
  ['/management/operating-context', 'operating-context'],
];

/** A prefix of path segments, where `*` stands for any one segment (a cluster's id). */
function prefixMatches(prefix: string, url: string): boolean {
  const want = prefix.split('/');
  const have = url.split(/[?#]/)[0].split('/');
  if (have.length < want.length) return false;
  return want.every((segment, i) => segment === '*' || segment === have[i]);
}

export function sandboxAreaForUrl(url: string): string | null {
  const match = SANDBOX_ROUTE_AREAS.filter(([prefix]) =>
    prefix.includes('*') ? prefixMatches(prefix, url) : url.startsWith(prefix),
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
