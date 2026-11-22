import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AppliedUnit, RepoMapService } from '../../service/repo-map.service';
import { RepositoryService } from '../../service/repository.service';
import { ClusterService } from '../../service/cluster.service';
import { ClusterStatus } from '../../model/cluster.models';

import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  RepoMapSurfaceInput,
  RepoMapSurfaceRevision,
  buildRepoMapSurface,
  presentedContent as repoMapPresentedContent,
} from './repo-map-surface';

import { RenderedUnitDto } from '../../../core/api/model/renderedUnitDto';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlCopyId } from '../../../ui/patterns/copy-id';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { RepoMapControls } from './repo-map-controls';
import { RepoMapFindings } from './repo-map-findings';
import { RepoMapGaps } from './repo-map-gaps';
import { RepoMapUnits } from './repo-map-units';
import { RepoMapApply } from './repo-map-apply';
import {
  UNACTIONABLE_OUTCOMES,
  fileBaseUrl,
  firstSentence,
  neededFrom,
  obstaclesFrom,
  outcomeLabel,
  outcomeTone,
  questionsFrom,
  readinessOf,
  shortSha,
  str,
  unitName,
} from './repo-map-view';

export { BAD_OUTCOMES } from './repo-map-view';

@Component({
  selector: 'app-repo-map',
  imports: [
    FlPageHeader,
    FlStatus,
    FlCopyId,
    FlAlert,
    FlPanel,
    FlLoadingState,
    RepoMapControls,
    RepoMapFindings,
    RepoMapGaps,
    RepoMapUnits,
    RepoMapApply,
  ],
  template: `
    <div class="fl-page">
      <fl-page-header [title]="repo()?.fullName ?? 'Deploy readiness'" [breadcrumb]="breadcrumb()">
        @if (assessed()) {
          <fl-status headerStatus [tone]="outcomeTone()" [label]="outcomeLabel()" />
        }
        @if (result()?.read?.commitSha; as sha) {
          <fl-copy-id headerMeta [value]="sha" [display]="shortSha(sha)" label="commit SHA" />
        }
      </fl-page-header>

      <app-repo-map-controls
        [(branch)]="branchInput"
        [(clusterId)]="clusterIdInput"
        [branches]="branches()"
        [clusters]="activeClusters()"
        [defaultBranch]="repo()?.branch"
        [branchesError]="branchesError()"
        [loading]="loading()"
        [hasRun]="hasRun()"
        (check)="runMap()"
      />

      @if (error()) {
        <fl-alert tone="error" title="Check failed">{{ error() }}</fl-alert>
      }

      @if (loading() && !result()) {
        <fl-panel><fl-loading-state [rows]="4" /></fl-panel>
      }

      @if (result(); as r) {
        @if (!r.read.ok) {
          <fl-alert tone="error" title="This repository could not be read">
            <span class="fl-mono">{{ r.read.reason || 'unknown' }}</span> on branch
            <span class="fl-mono">{{ r.branch }}</span>
          </fl-alert>
        } @else if (r.map; as map) {
          <app-repo-map-findings [verdict]="r.verdict" [needed]="needed()" />
          @if (obstacles().length > 0 || questions().length > 0) {
            <app-repo-map-gaps [obstacles]="obstacles()" [questions]="questions()" />
          }
          <app-repo-map-units
            [map]="map"
            [verdict]="r.verdict"
            [skipped]="skippedUnitIds()"
            [fileBase]="fileBase()"
          />
          <app-repo-map-apply
            [result]="r"
            [renderedUnits]="renderedUnits()"
            [applied]="applied()"
            [unmarked]="unmarkedUnits()"
            [refusal]="applyRefusal()"
            [applying]="applying()"
            [disabled]="applyDisabled()"
            [blockedReason]="applyBlockedReason()"
            [expanded]="expandedKeys()"
            (apply)="apply()"
            (toggled)="toggle($event)"
          />
        }
      }
    </div>
  `,
})
export class RepoMapComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repoMapService = inject(RepoMapService);
  private readonly repoService = inject(RepositoryService);
  private readonly clusterService = inject(ClusterService);

  private readonly repositoryId = signal<string>('');
  readonly branchInput = signal('');
  readonly clusterIdInput = signal('');
  readonly hasRun = signal(false);

  readonly result = this.repoMapService.map;
  readonly branches = this.repoMapService.branches;
  readonly branchesError = this.repoMapService.branchesError;
  readonly loading = this.repoMapService.loading;
  readonly error = this.repoMapService.error;
  readonly applying = this.repoMapService.applying;
  readonly applied = this.repoMapService.applyResult;
  readonly applyRefusal = this.repoMapService.applyRefusal;

  /** The (branch, cluster) pair the map on screen was read for. The apply is refused on a verdict
   * that is a function of exactly that pair, so a picker changed without checking again would
   * send the user off a verdict they were never shown. */
  private readonly ranWith = signal<{ branch: string; clusterId: string } | null>(null);

  readonly repo = computed(
    () => this.repoService.repositories().find((r) => r.id === this.repositoryId()) ?? null,
  );

  readonly activeClusters = computed(() =>
    this.clusterService.clusters().filter((c) => c.status === ClusterStatus.ACTIVE),
  );

  protected readonly expandedKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly breadcrumb = computed<Crumb[]>(() => {
    const name = this.repo()?.fullName;
    return [
      { label: 'Repositories', link: '/apps/repositories' },
      ...(name ? [{ label: name }] : []),
      { label: 'Readiness map' },
    ];
  });

  protected readonly assessed = computed(() => {
    const r = this.result();
    return Boolean(r?.read.ok && r.map);
  });

  readonly outcomeLabel = computed(() => outcomeLabel(this.result()?.verdict.outcome));
  protected readonly outcomeTone = computed(() => outcomeTone(this.result()?.verdict.outcome));

  readonly needed = computed(() => neededFrom(this.result()?.map));

  readonly questions = computed(() => questionsFrom(this.result()?.map));

  readonly renderedUnits = computed<RenderedUnitDto[]>(() => this.result()?.render?.units ?? []);

  readonly skippedUnitIds = computed<Set<string>>(
    () => new Set((this.result()?.render?.skipped ?? []).map((s) => str(s.unitId))),
  );

  readonly obstacles = computed(() => obstaclesFrom(this.result()?.map, this.result()?.verdict));

  protected readonly fileBase = computed(() => {
    const repo = this.repo();
    return fileBaseUrl(repo?.url, repo?.provider, this.result()?.read.commitSha);
  });

  readonly applyBlockedReason = computed<string>(() => {
    const r = this.result();
    if (!r?.read.ok) return 'Check this repository first.';
    const left = this.applyRefusal()?.stranded;
    if (left?.markedForReuse === false) {
      return 'The last attempt left applications behind that were not marked for reuse — remove them first, or this builds a second set beside them.';
    }
    if (!this.clusterIdInput().trim()) {
      return 'Pick a cluster above — an apply always deploys onto one.';
    }
    const ran = this.ranWith();
    const moved =
      ran?.branch !== this.branchInput().trim() || ran.clusterId !== this.clusterIdInput().trim();
    if (moved) {
      return 'The branch or the cluster changed since this map was read — check again first.';
    }
    if (UNACTIONABLE_OUTCOMES.has(r.verdict.outcome)) {
      return `Flui will not apply a map whose verdict is \`${r.verdict.outcome}\`.`;
    }
    if (this.renderedUnits().length === 0) {
      return 'No flui.yaml was rendered, so there is nothing to commit.';
    }
    return '';
  });

  readonly applyDisabled = computed(() => this.applying() || this.applyBlockedReason() !== '');

  /** Units the commit carries that were not armed and that Flui could not even mark: the next
   * apply will not find them and will build a second set beside them. */
  readonly unmarkedUnits = computed<AppliedUnit[]>(() =>
    (this.applied()?.units ?? []).filter((u) => !u.armed && u.markedForReuse === false),
  );

  private readonly currentSurface = inject(CurrentSurfaceService);
  private readonly surfaceRevision = new RepoMapSurfaceRevision();

  /** What this page is showing, for the Semantic Surface. Every field is read from the same
   * computed the template renders — never a second pass over the map response — so anything the
   * screen filters or trims is inherited here (playbook §5). */
  private readonly surfaceInput = computed<RepoMapSurfaceInput>(() => {
    const r = this.result();
    const needed = this.needed();
    const verdict = r?.verdict;
    const applied = this.applied();
    const refusal = this.applyRefusal();
    const cluster = this.activeClusters().find((c) => c.id === this.clusterIdInput());
    const countReadiness = (readiness: string) =>
      verdict ? verdict.units.filter((u) => u.readiness === readiness).length : 0;

    return {
      repositoryId: this.repositoryId(),
      repoFullName: this.repo()?.fullName,
      branchInput: this.branchInput(),
      branchOptionCount: this.branches().length,
      branchListingFailed: Boolean(this.branchesError()),
      clusterIdInput: this.clusterIdInput(),
      clusterName: cluster?.name,
      hasRun: this.hasRun(),
      loading: this.loading(),
      hasLoadError: Boolean(this.error()),
      read: r
        ? {
            branch: r.branch,
            ok: r.read.ok,
            reason: r.read.reason,
            commitShortSha: r.read.commitSha ? shortSha(r.read.commitSha) : undefined,
          }
        : null,
      assessment:
        r?.read.ok && r.map && verdict
          ? {
              coverage: r.map.coverage,
              outcome: verdict.outcome,
              outcomeLabel: this.outcomeLabel(),
              unitsReady: countReadiness('deployable'),
              unitsPendingInputs: countReadiness('deployable_pending_inputs'),
              unitsBlocked: countReadiness('blocked'),
              unitsNotAssessed: countReadiness('not_assessed'),
              capacity: {
                assessed: verdict.capacity.assessed,
                notAssessedReason: verdict.capacity.notAssessedReason,
                known: verdict.capacity.assessment.known,
                fits: verdict.capacity.assessment.fits,
                requiredCpuMillicores: verdict.capacity.assessment.requiredCpuMillicores,
                requiredMemoryMebibytes: verdict.capacity.assessment.requiredMemoryMebibytes,
                availableCpuMillicores: verdict.capacity.assessment.availableCpuMillicores,
                availableMemoryMebibytes: verdict.capacity.assessment.availableMemoryMebibytes,
                uncountedCount: verdict.capacity.uncounted.length,
              },
              neededCount: needed.length,
              neededSecretCount: needed.filter((n) => n.tags.includes('secret')).length,
              neededBlocksStartCount: needed.filter((n) => n.tags.includes('needed to start'))
                .length,
              externalCount: needed.filter((n) => n.tags.includes('external service')).length,
              obstacles: this.obstacles().map((o) => ({
                hasRemedy: Boolean(o.remedy),
                unit: o.unit,
              })),
              questionCount: this.questions().length,
              questionsWithOptionsCount: this.questions().filter((q) => q.options.length > 0)
                .length,
              units: r.map.units.map((u) => ({
                id: u.id,
                name: unitName(u.id),
                buildStrategy: u.build.strategy,
                port: u.port?.value ?? null,
                readiness: readinessOf(verdict, u.id),
                skipped: this.skippedUnitIds().has(u.id),
              })),
              services: r.map.services.map((s) => ({ name: s.name, block: s.block })),
              renderedUnitCount: this.renderedUnits().length,
              caveatCount: r.map.caveats.length,
            }
          : null,
      yamlExpanded: this.isExpanded('yaml'),
      rawMapExpanded: this.isExpanded('raw'),
      applying: this.applying(),
      applyBlockedReason: this.applyBlockedReason(),
      applied: applied
        ? {
            partial: applied.partial,
            branch: applied.branch,
            commitShortSha: shortSha(applied.commitSha),
            baseBranch: applied.baseBranch,
            fileCount: applied.files.length,
            skippedCount: applied.skipped.length,
            units: applied.units,
            unmarkedCount: this.unmarkedUnits().length,
          }
        : null,
      refusal: refusal
        ? {
            status: refusal.status,
            stranded: refusal.stranded
              ? {
                  branchDeleted: refusal.stranded.branchDeleted,
                  committed: refusal.stranded.committed,
                  markedForReuse: refusal.stranded.markedForReuse,
                  applications: refusal.stranded.applications,
                }
              : null,
          }
        : null,
    };
  });

  readonly surface = computed(() => {
    const input = this.surfaceInput();
    return buildRepoMapSurface(input, {
      revision: this.surfaceRevision.next(repoMapPresentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.repositoryId.set(id);

    const qp = this.route.snapshot.queryParamMap;
    const qBranch = qp.get('branch');
    const qCluster = qp.get('clusterId');
    if (qCluster) this.clusterIdInput.set(qCluster);

    void (async () => {
      if (this.repoService.repositories().length === 0) {
        await this.repoService.loadRepositories().catch(() => undefined);
      }
      await this.repoMapService.loadBranches(id);
      const known = this.branches().map((b) => b.name);
      const repo = this.repo();
      const preferred = [qBranch, repo?.branch].find((b): b is string => Boolean(b));
      if (preferred && (known.length === 0 || known.includes(preferred))) {
        this.branchInput.set(preferred);
      } else {
        this.branchInput.set(known[0] ?? '');
      }

      if (this.clusterService.clusters().length === 0) {
        await this.clusterService.loadClusters().catch(() => undefined);
      }

      await this.runMap();
    })();
  }

  async runMap(): Promise<void> {
    const id = this.repositoryId();
    if (!id) return;
    this.hasRun.set(true);
    const branch = this.branchInput().trim();
    const clusterId = this.clusterIdInput().trim();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { branch: branch || null, clusterId: clusterId || null },
      replaceUrl: true,
    });
    this.repoMapService.clearApply();
    await this.repoMapService.loadMap(id, branch, clusterId);
    this.ranWith.set(this.result() ? { branch, clusterId } : null);
  }

  /** Cuts the Flui branch, commits the rendered manifests, starts the builds. Every unit the
   * render produced goes: narrowing the set is not offered here, and sending `unitIds` we did
   * not let anyone choose would be a choice made on their behalf. */
  async apply(): Promise<void> {
    if (this.applyDisabled()) return;
    const id = this.repositoryId();
    if (!id) return;
    await this.repoMapService.applyMap(
      id,
      this.clusterIdInput().trim(),
      this.branchInput().trim() || undefined,
    );
  }

  toggle(key: string): void {
    this.expandedKeys.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  shortSha(sha: string): string {
    return shortSha(sha);
  }

  unitName(id: string): string {
    return unitName(id);
  }

  readonly firstSentence = firstSentence;
  readonly str = str;
}
