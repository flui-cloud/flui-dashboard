import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';

export interface PlatformComponentUpdate {
  key: string;
  name: string;
  role: string;
  installedVersion: string | null;
  targetVersion: string | null;
  changed: boolean;
  restartsControlPlane: boolean;
}

export interface PlatformUpdateAdvisory {
  level: 'info' | 'warning' | 'blocker';
  title: string;
  detail: string;
}

export interface PlatformUpdateStatus {
  installedVersion: string;
  availableVersion: string | null;
  updateAvailable: boolean;
  applicable: boolean;
  publishedAt: string | null;
  notes: string[];
  migrations: number;
  components: PlatformComponentUpdate[];
  advisories: PlatformUpdateAdvisory[];
  checkedAt: string;
  checkError: string | null;
}

export interface PlatformUpdateComponentProgress {
  key: string;
  name: string;
  fromVersion: string | null;
  targetVersion: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
}

export interface PlatformUpdateOperation {
  id: string;
  status: string;
  fromVersion: string;
  targetVersion: string;
  components: PlatformUpdateComponentProgress[];
  migrations: number;
  progress: number;
  currentStep: string | null;
  awaitingSelfRestart: boolean;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  userId: string | null;
}

const POLL_INTERVAL_MS = 3000;

// Polling survives the API going away: a restart is the expected middle of an update, not an error.
@Injectable({ providedIn: 'root' })
export class PlatformUpdateService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly statusData = signal<PlatformUpdateStatus | null>(null);
  private readonly operationData = signal<PlatformUpdateOperation | null>(null);
  private readonly historyData = signal<PlatformUpdateOperation[]>([]);
  private readonly loadingData = signal(false);
  private readonly checkingData = signal(false);
  private readonly startingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly apiUnreachableData = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private loaded = false;

  readonly status = this.statusData.asReadonly();
  readonly operation = this.operationData.asReadonly();
  readonly history = this.historyData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly checking = this.checkingData.asReadonly();
  readonly starting = this.startingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly apiUnreachable = this.apiUnreachableData.asReadonly();

  readonly updateAvailable = computed(
    () => this.statusData()?.updateAvailable ?? false,
  );
  readonly availableVersion = computed(
    () => this.statusData()?.availableVersion ?? null,
  );
  readonly running = computed(() => {
    const op = this.operationData();
    return !!op && (op.status === 'PENDING' || op.status === 'IN_PROGRESS');
  });
  /** True exactly while the API is being replaced under our feet. */
  readonly controlPlaneRestarting = computed(
    () => this.operationData()?.awaitingSelfRestart === true,
  );
  readonly blockers = computed(
    () => this.statusData()?.advisories.filter((a) => a.level === 'blocker') ?? [],
  );

  private url(path = ''): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/platform/updates${path}`;
  }

  /** First read for the badge surfaces; a no-op once it has answered. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loadingData.set(true);
    try {
      await Promise.all([this.loadStatus(), this.loadCurrent()]);
      if (this.running()) this.startPolling();
    } finally {
      this.loadingData.set(false);
    }
  }

  async loadStatus(): Promise<void> {
    try {
      const status = await firstValueFrom(
        this.http.get<PlatformUpdateStatus>(this.url()),
      );
      this.statusData.set(status);
      this.errorData.set(status.checkError);
      this.apiUnreachableData.set(false);
    } catch (err) {
      this.apiUnreachableData.set(true);
      this.errorData.set(this.messageOf(err, 'Could not read the update status'));
    }
  }

  async loadCurrent(): Promise<void> {
    try {
      const operation = await firstValueFrom(
        this.http.get<PlatformUpdateOperation | null>(this.url('/current')),
      );
      this.operationData.set(operation ?? null);
      this.apiUnreachableData.set(false);
    } catch {
      // Expected while the control plane is coming back — the poll keeps asking.
      this.apiUnreachableData.set(true);
    }
  }

  async loadHistory(limit = 20): Promise<void> {
    try {
      this.historyData.set(
        await firstValueFrom(
          this.http.get<PlatformUpdateOperation[]>(
            this.url(`/history?limit=${limit}`),
          ),
        ),
      );
    } catch {
      this.historyData.set([]);
    }
  }

  async check(): Promise<void> {
    this.checkingData.set(true);
    try {
      const status = await firstValueFrom(
        this.http.post<PlatformUpdateStatus>(this.url('/check'), {}),
      );
      this.statusData.set(status);
      this.errorData.set(status.checkError);
    } catch (err) {
      this.errorData.set(this.messageOf(err, 'Could not reach the release manifest'));
    } finally {
      this.checkingData.set(false);
    }
  }

  async start(targetVersion: string): Promise<void> {
    this.startingData.set(true);
    this.errorData.set(null);
    try {
      const operation = await firstValueFrom(
        this.http.post<PlatformUpdateOperation>(this.url(), { targetVersion }),
      );
      this.operationData.set(operation);
      this.startPolling();
    } catch (err) {
      this.errorData.set(this.messageOf(err, 'Could not start the update'));
      throw err;
    } finally {
      this.startingData.set(false);
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async tick(): Promise<void> {
    const before = this.operationData();
    await this.loadCurrent();
    const after = this.operationData();

    if (after || this.apiUnreachable()) return;

    // The operation left the running set: re-read status so every surface settles, and stop.
    this.stopPolling();
    await Promise.all([this.loadStatus(), this.loadHistory()]);
    if (before?.components.some((c) => c.key === 'fluiWeb' && c.status === 'done')) {
      // The dashboard itself was replaced; this tab is running the old bundle.
      window.location.reload();
    }
  }

  private messageOf(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? fallback;
  }
}
