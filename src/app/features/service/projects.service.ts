import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AppConfigService } from '../../core/services/app-config.service';
import { NotificationService } from '../../core/services/notification.service';
import { Project } from '../model/project.model';
import { AppAttributes } from '../model/iam.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly notify = inject(NotificationService);

  private base(path = ''): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/projects${path}`;
  }

  private readonly _projects = signal<Project[]>([]);
  readonly projects = this._projects.asReadonly();

  private readonly _residents = signal<ReadonlyMap<string, number> | null>(null);
  readonly residents = this._residents.asReadonly();

  loadProjects(): void {
    this.http.get<Project[]>(this.base()).subscribe({
      next: (p) => this._projects.set(p),
      error: () => this._projects.set([]),
    });
  }

  loadResidents(): void {
    this.http.get<AppAttributes[]>(`${this.appConfig.apiBaseUrl}/api/v1/iam/resources`).subscribe({
      next: (apps) => this._residents.set(residentsByProject(apps)),
      error: () => this._residents.set(null),
    });
  }

  create(
    input: { name: string; description?: string; color?: string },
    onCreated?: (project: Project) => void,
  ): void {
    this.http.post<Project>(this.base(), input).subscribe({
      next: (p) => {
        this._projects.update((list) => [...list, p].sort((a, b) => a.name.localeCompare(b.name)));
        onCreated?.(p);
      },
      error: (e) => this.fail('create project', e),
    });
  }

  update(
    id: string,
    input: { name?: string; description?: string | null; color?: string | null },
    onSettled?: () => void,
  ): void {
    this.http.patch<Project>(this.base(`/${id}`), input).subscribe({
      next: (p) => {
        this._projects.update((list) =>
          list.map((it) => (it.id === id ? p : it)).sort((a, b) => a.name.localeCompare(b.name)),
        );
        onSettled?.();
      },
      error: (e) => {
        this.fail('update project', e);
        onSettled?.();
      },
    });
  }

  remove(id: string): void {
    this.http.delete<void>(this.base(`/${id}`)).subscribe({
      next: () => {
        this._projects.update((list) => list.filter((p) => p.id !== id));
      },
      error: (e) => {
        if (isProjectNotEmpty(e)) {
          this.notify.add({
            title: "Couldn't delete project",
            body: 'The project still holds applications, platform ones included.',
            type: 'error',
            source: 'manual',
          });
          this.loadResidents();
          return;
        }
        this.fail('delete project', e);
      },
    });
  }

  private fail(action: string, err: unknown): void {
    const e = err as { error?: { message?: string }; message?: string };
    this.notify.add({
      title: `Couldn't ${action}`,
      body: e?.error?.message ?? e?.message,
      type: 'error',
      source: 'manual',
    });
  }
}

function residentsByProject(apps: readonly AppAttributes[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const app of apps) {
    if (app.project) counts.set(app.project, (counts.get(app.project) ?? 0) + 1);
  }
  return counts;
}

function isProjectNotEmpty(err: unknown): boolean {
  const e = err as { status?: number; error?: { code?: string } } | null;
  return e?.status === 409 && e.error?.code === 'PROJECT_NOT_EMPTY';
}
