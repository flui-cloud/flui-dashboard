import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../core/api/variables';
import {
  CreateScheduledJobRequest,
  ScheduledJob,
  ScheduledJobRun,
  UpdateScheduledJobRequest,
} from '../model/scheduled-job.models';

/**
 * Scheduled jobs (cron) for an application. Uses raw HttpClient because these
 * endpoints are not yet in the generated OpenAPI client.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationCronService {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH, { optional: true }) ?? '';

  private readonly jobsData = signal<ScheduledJob[]>([]);
  private readonly loadingData = signal<boolean>(false);
  private readonly savingData = signal<boolean>(false);
  private readonly errorData = signal<string | null>(null);

  readonly jobs = this.jobsData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly saving = this.savingData.asReadonly();
  readonly error = this.errorData.asReadonly();

  private base(appId: string): string {
    return `${this.basePath}/api/v1/applications/${encodeURIComponent(appId)}/schedules`;
  }

  async loadForApp(appId: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const data = await firstValueFrom(
        this.http.get<ScheduledJob[]>(this.base(appId)),
      );
      this.jobsData.set(data ?? []);
    } catch (error: any) {
      console.error('Error loading schedules:', error);
      this.errorData.set(this.message(error, 'Failed to load schedules'));
    } finally {
      this.loadingData.set(false);
    }
  }

  async create(
    appId: string,
    body: CreateScheduledJobRequest,
  ): Promise<ScheduledJob | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const created = await firstValueFrom(
        this.http.post<ScheduledJob>(this.base(appId), body),
      );
      if (created) {
        this.jobsData.update((list) => [created, ...list]);
      }
      return created;
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      this.errorData.set(this.message(error, 'Failed to create schedule'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  async update(
    appId: string,
    name: string,
    body: UpdateScheduledJobRequest,
  ): Promise<ScheduledJob | null> {
    this.savingData.set(true);
    this.errorData.set(null);
    try {
      const updated = await firstValueFrom(
        this.http.patch<ScheduledJob>(
          `${this.base(appId)}/${encodeURIComponent(name)}`,
          body,
        ),
      );
      if (updated) {
        this.jobsData.update((list) =>
          list.map((j) => (j.name === name ? updated : j)),
        );
      }
      return updated;
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      this.errorData.set(this.message(error, 'Failed to update schedule'));
      return null;
    } finally {
      this.savingData.set(false);
    }
  }

  async toggle(
    appId: string,
    job: ScheduledJob,
  ): Promise<ScheduledJob | null> {
    return this.update(appId, job.name, { enabled: !job.enabled });
  }

  async delete(appId: string, name: string): Promise<boolean> {
    this.errorData.set(null);
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${this.base(appId)}/${encodeURIComponent(name)}`,
        ),
      );
      this.jobsData.update((list) => list.filter((j) => j.name !== name));
      return true;
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      this.errorData.set(this.message(error, 'Failed to delete schedule'));
      return false;
    }
  }

  async trigger(appId: string, name: string): Promise<string | null> {
    this.errorData.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<{ jobName: string }>(
          `${this.base(appId)}/${encodeURIComponent(name)}/trigger`,
          {},
        ),
      );
      return res?.jobName ?? null;
    } catch (error: any) {
      console.error('Error triggering schedule:', error);
      this.errorData.set(this.message(error, 'Failed to trigger schedule'));
      return null;
    }
  }

  async listRuns(appId: string, name: string): Promise<ScheduledJobRun[]> {
    try {
      const runs = await firstValueFrom(
        this.http.get<ScheduledJobRun[]>(
          `${this.base(appId)}/${encodeURIComponent(name)}/runs`,
        ),
      );
      return runs ?? [];
    } catch (error: any) {
      console.error('Error loading runs:', error);
      this.errorData.set(this.message(error, 'Failed to load runs'));
      return [];
    }
  }

  async runLogs(
    appId: string,
    name: string,
    jobName: string,
  ): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ jobName: string; logs: string }>(
          `${this.base(appId)}/${encodeURIComponent(name)}/runs/${encodeURIComponent(jobName)}/logs`,
        ),
      );
      return res?.logs ?? '';
    } catch (error: any) {
      console.error('Error loading run logs:', error);
      return '';
    }
  }

  reset(): void {
    this.jobsData.set([]);
    this.errorData.set(null);
  }

  private message(error: any, fallback: string): string {
    return error?.error?.message || error?.message || fallback;
  }
}
