import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ProjectsService } from '../../../../core/api/api/projects.service';

export interface SelectableProject {
  id: string;
  name: string;
}

/**
 * A project is a grouping, not an application list a picker has to expand:
 * scoping a key to a project id is enough, and `AppAccessGuard` resolves
 * membership itself against each application's own `projectId` on every
 * request. Nothing here needs to know which — or how many — applications a
 * project currently holds.
 */
@Injectable({ providedIn: 'root' })
export class AgentKeyProjectsService {
  private readonly projectsApi = inject(ProjectsService);

  list() {
    return this.projectsApi.projectsControllerList().pipe(
      map((projects: Array<{ id: string; name: string }>) =>
        projects.map((p) => ({ id: p.id, name: p.name })),
      ),
    );
  }
}
