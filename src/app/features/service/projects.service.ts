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

  private readonly _apps = signal<AppAttributes[]>([]);
  readonly apps = this._apps.asReadonly();

  refresh(): void {
    this.loadProjects();
    this.loadApps();
  }

  loadProjects(): void {
    this.http.get<Project[]>(this.base()).subscribe({
      next: (p) => this._projects.set(p),
      error: () => this._projects.set([]),
    });
  }

  private loadApps(): void {
    this.http
      .get<AppAttributes[]>(`${this.appConfig.apiBaseUrl}/api/v1/iam/resources`)
      .subscribe({
        next: (a) => this._apps.set(a),
        error: () => this._apps.set([]),
      });
  }

  create(input: { name: string; description?: string; color?: string }): void {
    this.http.post<Project>(this.base(), input).subscribe({
      next: (p) =>
        this._projects.update((list) =>
          [...list, p].sort((a, b) => a.name.localeCompare(b.name)),
        ),
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
          list
            .map((it) => (it.id === id ? p : it))
            .sort((a, b) => a.name.localeCompare(b.name)),
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
        this.loadApps();
      },
      error: (e) => this.fail('delete project', e),
    });
  }

  assignApp(projectId: string, appId: string, onSettled?: () => void): void {
    const slug = this._projects().find((p) => p.id === projectId)?.slug;
    this.patchAppProject(appId, slug);
    this.http
      .post<void>(this.base(`/${projectId}/apps/${appId}`), {})
      .subscribe({
        next: () => {
          this.loadApps();
          onSettled?.();
        },
        error: (e) => {
          this.loadApps();
          this.fail('assign app', e);
          onSettled?.();
        },
      });
  }

  unassignApp(projectId: string, appId: string, onSettled?: () => void): void {
    this.patchAppProject(appId, undefined);
    this.http
      .delete<void>(this.base(`/${projectId}/apps/${appId}`))
      .subscribe({
        next: () => {
          this.loadApps();
          onSettled?.();
        },
        error: (e) => {
          this.loadApps();
          this.fail('remove app', e);
          onSettled?.();
        },
      });
  }

  private patchAppProject(appId: string, project: string | undefined): void {
    this._apps.update((list) =>
      list.map((a) => (a.id === appId ? { ...a, project } : a)),
    );
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
