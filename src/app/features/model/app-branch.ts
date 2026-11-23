import { Application } from './application.models';

export const FALLBACK_BRANCH = 'main';

interface SourceConfig {
  readonly branch?: unknown;
  readonly repositoryId?: unknown;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sourceOf(app: Application | null | undefined): SourceConfig {
  const cfg = app?.sourceConfig;
  return typeof cfg === 'object' && cfg !== null ? (cfg as SourceConfig) : {};
}

export function sourceBranchOf(app: Application | null | undefined): string | null {
  return nonEmpty(sourceOf(app).branch);
}

export function sourceRepositoryIdOf(app: Application | null | undefined): string | null {
  return nonEmpty(sourceOf(app).repositoryId);
}

export function resolveBuildBranch(candidates: {
  readonly buildBranch?: string | null;
  readonly sourceBranch?: string | null;
  readonly repositoryDefaultBranch?: string | null;
}): string {
  return (
    nonEmpty(candidates.buildBranch) ??
    nonEmpty(candidates.sourceBranch) ??
    nonEmpty(candidates.repositoryDefaultBranch) ??
    FALLBACK_BRANCH
  );
}
