import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationService } from '../../service/application.service';
import { ApplicationResponseDto } from '../../../core/api/model/applicationResponseDto';
import { ConnectedRepository } from '../../service/repository.service';

@Injectable()
export class RepositoriesDeployStore {
  private readonly appService = inject(ApplicationService);
  private readonly router = inject(Router);

  readonly choiceRepo = signal<ConnectedRepository | null>(null);
  readonly choiceApps = signal<ApplicationResponseDto[]>([]);
  readonly checking = signal(false);

  async deploy(repo: ConnectedRepository): Promise<void> {
    if (this.checking()) return;
    this.checking.set(true);
    try {
      if (this.appService.applications().length === 0) {
        await this.appService.loadApplications();
      }
      const matched = this.appService
        .applications()
        .filter(
          (app) =>
            app.sourceType === ApplicationResponseDto.SourceTypeEnum.GitBuild &&
            (app.sourceConfig as { repositoryId?: string } | undefined)?.repositoryId === repo.id,
        );

      if (matched.length === 0) {
        this.openWizard(repo);
        return;
      }

      this.choiceApps.set(matched);
      this.choiceRepo.set(repo);
    } finally {
      this.checking.set(false);
    }
  }

  closeChoice(): void {
    this.choiceRepo.set(null);
    this.choiceApps.set([]);
  }

  triggerBuild(appId: string): void {
    this.closeChoice();
    this.router.navigate(['/apps/applications', appId, 'builds']);
  }

  createNewApp(): void {
    const repo = this.choiceRepo();
    this.closeChoice();
    if (repo) this.openWizard(repo);
  }

  private openWizard(repo: ConnectedRepository): void {
    this.router.navigate(['/apps/deploy/new'], { queryParams: { repoId: repo.id } });
  }
}
