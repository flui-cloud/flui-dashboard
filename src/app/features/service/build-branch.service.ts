import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RepositoriesService } from '../../core/api/api/repositories.service';
import { Application } from '../model/application.models';
import { resolveBuildBranch, sourceBranchOf, sourceRepositoryIdOf } from '../model/app-branch';
import { RepositoryService } from './repository.service';

@Injectable({ providedIn: 'root' })
export class BuildBranchService {
  private readonly repositories = inject(RepositoryService);
  private readonly repositoriesApi = inject(RepositoriesService);

  async branchFor(
    app: Application | null | undefined,
    buildBranch?: string | null,
  ): Promise<string> {
    const sourceBranch = sourceBranchOf(app);
    if (buildBranch?.trim() || sourceBranch) {
      return resolveBuildBranch({ buildBranch, sourceBranch });
    }
    const repositoryDefaultBranch = await this.defaultBranchOf(sourceRepositoryIdOf(app));
    return resolveBuildBranch({ repositoryDefaultBranch });
  }

  private async defaultBranchOf(repositoryId: string | null): Promise<string | null> {
    if (!repositoryId) return null;
    const known = this.repositories.repositories().find((r) => r.id === repositoryId);
    if (known?.branch) return known.branch;
    try {
      const repo = (await firstValueFrom(
        this.repositoriesApi.repositoriesControllerGetRepository(repositoryId),
      )) as { defaultBranch?: string } | null;
      return repo?.defaultBranch ?? null;
    } catch {
      return null;
    }
  }
}
