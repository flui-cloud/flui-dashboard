import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Configuration } from '../../core/api/configuration';
import { RepositoriesService } from '../../core/api/api/repositories.service';
import { RepositoryMapResponseDto } from '../../core/api/model/repositoryMapResponseDto';
import { SkippedUnitDto } from '../../core/api/model/skippedUnitDto';

/** `GET /repositories/:id/branches` is untyped in the generated client (the controller declares no
 * response schema), so the shape is named once here instead of `any` at every call site. */
export interface RepoBranch {
  name: string;
  sha: string;
}

/** `POST /repositories/:id/map/apply` is not in the generated client either — regenerating it
 * would drag in months of unrelated backend change — so its request and response are named here
 * by hand, mirroring `RepositoryApplyDto` / `RepositoryApplyResponseDto`. */
export interface AppliedUnit {
  unitId: string;
  name: string;
  applicationId: string;
  slug: string;
  manifestPath: string;
  workflowPath: string;
  status: string;
  /** False means the commit landed and its build is running, but this unit answers its own
   * webhook with a 401 and will never deploy on its own. */
  armed: boolean;
  reason?: string;
  markedForReuse?: boolean;
  workflowRunUrl?: string;
}

export interface RepoApplyResult {
  repositoryId: string;
  repoFullName: string;
  baseBranch: string;
  baseCommitSha: string;
  branch: string;
  branchUrl: string;
  commitSha: string;
  commitUrl: string;
  files: string[];
  units: AppliedUnit[];
  partial: boolean;
  skipped: SkippedUnitDto[];
  verdict: string;
  verdictReason: string;
}

/** An application an apply created and then could not take back. Flui never deletes one on its
 * own — one of them may already own a database. */
export interface StrandedApplication {
  applicationId: string;
  name: string;
  slug: string;
  unitId: string;
  branch: string;
  attachedServices: string[];
}

/** The `ApplyLeftApplicationsBehind` half of a refusal: present only when something exists that
 * the caller now owns. */
export interface StrandedApply {
  branch: string;
  branchDeleted: boolean;
  committed: boolean;
  /** `undefined` when the backend did not say — never read as `false`. */
  markedForReuse?: boolean;
  applications: StrandedApplication[];
}

/**
 * A refusal from the apply endpoint. `message` is the backend's own sentence and is shown as
 * written: it names the branch, the units and the applications, and no paraphrase of it here
 * could say as much.
 */
export interface ApplyRefusal {
  status: number;
  message: string;
  stranded?: StrandedApply;
}

@Injectable({ providedIn: 'root' })
export class RepoMapService {
  private readonly api = inject(RepositoriesService);
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(Configuration);

  private readonly mapData = signal<RepositoryMapResponseDto | null>(null);
  private readonly loadingData = signal(false);
  private readonly errorData = signal<string | null>(null);
  private readonly branchesData = signal<RepoBranch[]>([]);
  private readonly branchesErrorData = signal<string | null>(null);
  private readonly applyingData = signal(false);
  private readonly applyResultData = signal<RepoApplyResult | null>(null);
  private readonly applyRefusalData = signal<ApplyRefusal | null>(null);

  readonly map = this.mapData.asReadonly();
  readonly loading = this.loadingData.asReadonly();
  readonly error = this.errorData.asReadonly();
  readonly branches = this.branchesData.asReadonly();
  /** Non-null when the provider would not list them: the caller falls back to typing a name
   * rather than pretending the repository has no branches. */
  readonly branchesError = this.branchesErrorData.asReadonly();
  readonly applying = this.applyingData.asReadonly();
  readonly applyResult = this.applyResultData.asReadonly();
  readonly applyRefusal = this.applyRefusalData.asReadonly();

  /**
   * `read.ok === false` is a real, complete answer from the engine (not-found,
   * no-credential, too-large…) — it lands in `map`, not in `error`. `error` is
   * reserved for the call itself failing (network, 4xx/5xx before the engine ran).
   */
  async loadMap(repositoryId: string, branch?: string, clusterId?: string): Promise<void> {
    this.loadingData.set(true);
    this.errorData.set(null);
    try {
      const result = await firstValueFrom(
        this.api.repositoriesControllerMapRepository(
          repositoryId,
          branch || undefined,
          clusterId || undefined,
        ),
      );
      this.mapData.set(result);
    } catch (err: unknown) {
      this.mapData.set(null);
      this.errorData.set(this.extractErrorMessage(err, 'Could not reach the mapping engine'));
    } finally {
      this.loadingData.set(false);
    }
  }

  /** The branches the repository actually has. Nothing here assumes `main` exists: when this
   * fails the caller keeps a free-text field, and when the field is left empty the engine reads
   * the repository's own default branch. */
  async loadBranches(repositoryId: string): Promise<void> {
    this.branchesErrorData.set(null);
    try {
      const result = (await firstValueFrom(
        this.api.repositoriesControllerListBranches(repositoryId),
      )) as RepoBranch[] | null;
      this.branchesData.set(Array.isArray(result) ? result.filter((b) => Boolean(b?.name)) : []);
    } catch (err: unknown) {
      this.branchesData.set([]);
      this.branchesErrorData.set(this.extractErrorMessage(err, 'Branches could not be listed'));
    }
  }

  /**
   * Acts on the map: cuts `flui/deploy-<sha7>` from the chosen branch, commits the rendered
   * manifests and their workflows there, and creates one application per unit.
   *
   * No client timeout, deliberately: the call installs from the catalog every database the
   * manifests declare before it answers, which runs into minutes. Cutting it short here would
   * abandon a request that keeps going on the server and leave the caller with no record of what
   * it created.
   *
   * A refusal is an answer too — the backend writes it as a sentence naming what it did and did
   * not do — so it lands in `applyRefusal`, not in `error`.
   */
  async applyMap(
    repositoryId: string,
    clusterId: string,
    branch?: string,
    unitIds?: string[],
  ): Promise<void> {
    this.applyingData.set(true);
    this.applyRefusalData.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<RepoApplyResult>(
          `${this.apiConfig.basePath}/api/v1/repositories/${encodeURIComponent(repositoryId)}/map/apply`,
          {
            clusterId,
            ...(branch ? { branch } : {}),
            ...(unitIds && unitIds.length > 0 ? { unitIds } : {}),
          },
          { withCredentials: this.apiConfig.withCredentials },
        ),
      );
      this.applyResultData.set(result);
    } catch (err: unknown) {
      this.applyRefusalData.set(this.toRefusal(err));
    } finally {
      this.applyingData.set(false);
    }
  }

  clear(): void {
    this.mapData.set(null);
    this.errorData.set(null);
    this.branchesData.set([]);
    this.branchesErrorData.set(null);
    this.applyResultData.set(null);
    this.applyRefusalData.set(null);
  }

  /** Forgets the last apply. Called when the map is read again: that answer belonged to the
   * previous read, and the branch and commit it names live on in GitHub either way. */
  clearApply(): void {
    this.applyResultData.set(null);
    this.applyRefusalData.set(null);
  }

  private toRefusal(err: unknown): ApplyRefusal {
    const e = err as { status?: number; error?: Record<string, unknown> } | null;
    const body = (e?.error ?? {}) as Record<string, unknown>;
    const message = this.extractErrorMessage(err, 'The apply could not be completed.');
    const status = typeof e?.status === 'number' ? e.status : 0;
    if (body['error'] !== 'ApplyLeftApplicationsBehind') return { status, message };
    return {
      status,
      message,
      stranded: {
        branch: typeof body['branch'] === 'string' ? body['branch'] : '',
        branchDeleted: body['branchDeleted'] === true,
        committed: body['committed'] === true,
        // Three states, not two. Absent is not `false`: an older backend, or an error assembled
        // somewhere else, simply does not say — and reading silence as "not marked" disabled the
        // retry with "remove them by hand first" directly above the backend's own message saying
        // they WERE marked and the next apply would adopt them. Only an explicit `false` closes
        // that door.
        markedForReuse:
          typeof body['markedForReuse'] === 'boolean'
            ? (body['markedForReuse'] as boolean)
            : undefined,
        applications: Array.isArray(body['strandedApplications'])
          ? (body['strandedApplications'] as StrandedApplication[])
          : [],
      },
    };
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string | string[] }; message?: string };
    const message = e?.error?.message;
    if (Array.isArray(message)) return message.join(' ');
    return message ?? e?.message ?? fallback;
  }
}
