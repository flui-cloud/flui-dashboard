import { AccessSelector } from './iam.model';

export const CONTEXT_SCOPE_TYPES = ['global', 'cluster', 'selector'] as const;

export type ContextScopeType = (typeof CONTEXT_SCOPE_TYPES)[number];

export const ENTRY_NATURES = ['practice', 'rationale'] as const;

export type EntryNature = (typeof ENTRY_NATURES)[number];

export type CheckKind = 'none' | 'attestation' | 'probe';

export type Validity = 'checked' | 'stale' | 'broken' | 'unverified';

export type ReachAudience = 'installation' | 'cluster' | 'selection';

export const PROBE_OPS = [
  'equals',
  'notEquals',
  'atLeast',
  'atMost',
  'exists',
] as const;

export type ProbeOp = (typeof PROBE_OPS)[number];

export interface EntryReach {
  audience: ReachAudience;
  scopeType: ContextScopeType;
  scopeRef?: string | null;
  nature: EntryNature;
  descends: boolean;
  reachesGuests: boolean;
  sentence: string;
}

export interface ContextHand {
  name: string | null;
  isYou: boolean;
}

export interface ContextEntry {
  id: string;
  scopeType: ContextScopeType;
  scopeRef?: string | null;
  nature: EntryNature;
  topic: string;
  title: string;
  body: string;
  confidence: Validity;
  checkedBy: CheckKind;
  updatedAt: string;
  reaches?: EntryReach;
  selector?: AccessSelector | null;
  pinnedToAnOwner?: boolean;
  writtenBy?: ContextHand | null;
  confirmedBy?: ContextHand | null;
  archivedBy?: ContextHand | null;
  archivedAt?: string | null;
}

export interface ContextConflict {
  topic: string;
  entryIds: string[];
}

export interface ContextDelivery {
  preamble: string;
  advice: ContextEntry[];
  needsReview: ContextEntry[];
  conflicts: ContextConflict[];
}

export type ProbeValueType = 'string' | 'number' | 'boolean';

export interface ContextProbeParam {
  name: string;
  required: boolean;
  oneOf?: string[];
}

export interface ContextProbeOption {
  id: string;
  describes: string;
  takes?: ContextProbeParam[];
  answers?: ProbeValueType;
  answersPer?: { param: string; types: Record<string, ProbeValueType> };
}

export function answerTypeOf(
  probe: ContextProbeOption | undefined,
  params: Record<string, unknown>,
): ProbeValueType | undefined {
  if (!probe) return undefined;
  if (probe.answers) return probe.answers;
  const per = probe.answersPer;
  if (!per) return undefined;
  const chosen = params[per.param];
  return typeof chosen === 'string' ? per.types[chosen] : undefined;
}

export interface WriteContextEntry {
  scopeType: ContextScopeType;
  scopeRef?: string | null;
  selector?: AccessSelector;
  nature: EntryNature;
  topic: string;
  title: string;
  body: string;
  checkKind?: CheckKind;
  probeId?: string;
  probeParams?: Record<string, unknown>;
  probeOp?: ProbeOp;
  probeExpected?: unknown;
  validForDays?: number;
}

export interface EditContextEntry {
  title?: string;
  body?: string;
  topic?: string;
}

export function isSuspect(v: Validity): boolean {
  return v === 'broken';
}

export function needsReview(v: Validity): boolean {
  return v === 'broken' || v === 'stale';
}

const REVIEW_RANK: Record<Validity, number> = {
  broken: 0,
  stale: 1,
  unverified: 2,
  checked: 3,
};

export function suspectFirst<T extends { confidence: Validity }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) => REVIEW_RANK[a.confidence] - REVIEW_RANK[b.confidence],
  );
}

export interface ValidityCopy {
  label: string;
  note: string;
}

export const VALIDITY_COPY: Record<Validity, ValidityCopy> = {
  broken: {
    label: 'premise fell',
    note: 'The platform’s own state disagrees with what this note assumes. Read it as suspect, not as true.',
  },
  stale: {
    label: 'unconfirmed',
    note: 'Nobody has put their name to this inside the window it declared. Not known wrong — unconfirmed.',
  },
  checked: {
    label: 'checked',
    note: 'Compared with live state and it agreed, or confirmed by a person inside the window it declared.',
  },
  unverified: {
    label: 'prose',
    note: 'Nothing checks this one. It says so rather than being read as fact.',
  },
};

export interface NatureCopy {
  label: string;
  means: string;
}

export const NATURE_COPY: Record<EntryNature, NatureCopy> = {
  practice: {
    label: 'How it is done here',
    means: 'Reaches everyone who acts at this level, whether or not they own it.',
  },
  rationale: {
    label: 'Why it is done',
    means: 'Stays with whoever’s access covers the whole of this level — incidents, names, commercial choices.',
  },
};

export const CHECK_COPY: Record<CheckKind, string> = {
  none: 'prose — nothing compares it with anything',
  attestation: 'a person’s signature, with a shelf life',
  probe: 'compared with live state every time it is read',
};

export interface ConflictGroup {
  topic: string;
  entries: ContextEntry[];
}

export function conflictGroups(
  conflicts: readonly ContextConflict[],
  entries: readonly ContextEntry[],
): ConflictGroup[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return conflicts
    .map((c) => ({
      topic: c.topic,
      entries: c.entryIds
        .map((id) => byId.get(id))
        .filter((e): e is ContextEntry => !!e),
    }))
    .filter((g) => g.entries.length > 1);
}

const SELECTOR_PHRASES: ReadonlyArray<
  readonly [
    keyof AccessSelector,
    (value: unknown, clusterName?: (id: string) => string | undefined) => string,
  ]
> = [
  ['slugs', (v) => `applications ${asList(v)}`],
  ['type', (v) => `${String(v)} applications`],
  ['kind', (v) => `applications of kind ${String(v)}`],
  ['project', (v) => `in project ${String(v)}`],
  ['tags', (v) => `tagged ${asList(v)}`],
  ['clusterName', (v) => `on cluster ${String(v)}`],
  ['clusterId', (v, name) => `on cluster ${name?.(String(v)) ?? String(v)}`],
  ['provider', (v) => `on ${String(v)}`],
];

const asList = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : String(value);

export function describeSelector(
  selector: AccessSelector | null | undefined,
  pinnedToAnOwner?: boolean,
  clusterName?: (id: string) => string | undefined,
): string | null {
  const said: string[] = [];
  for (const [axis, phrase] of SELECTOR_PHRASES) {
    const value = selector?.[axis];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    if (axis === 'clusterId' && selector?.clusterName) continue;
    said.push(phrase(value, clusterName));
  }
  if (pinnedToAnOwner || selector?.owner !== undefined) {
    said.push('owned by one principal');
  }
  return said.length ? said.join(', ') : null;
}

export function describeScope(
  entry: Pick<
    ContextEntry,
    'scopeType' | 'scopeRef' | 'selector' | 'pinnedToAnOwner'
  >,
  clusterName?: (id: string) => string | undefined,
): string {
  switch (entry.scopeType) {
    case 'global':
      return 'the whole installation';
    case 'cluster': {
      const ref = entry.scopeRef ?? '';
      return `cluster ${(clusterName?.(ref) ?? ref) || 'unnamed'}`;
    }
    default:
      return (
        describeSelector(entry.selector, entry.pinnedToAnOwner, clusterName) ??
        'a selection this delivery does not name'
      );
  }
}

export const ABOUT_AXES = [
  'everything',
  'apps',
  'project',
  'kind',
  'tag',
] as const;

export type AboutAxis = (typeof ABOUT_AXES)[number];

export const WHERE_AXES = ['anywhere', 'cluster', 'provider'] as const;

export type WhereAxis = (typeof WHERE_AXES)[number];

export const ABOUT_LABEL: Record<AboutAxis, string> = {
  everything: 'anything on this installation',
  apps: 'these applications',
  project: 'a project',
  kind: 'applications of a kind',
  tag: 'applications carrying a tag',
};

export const WHERE_LABEL: Record<WhereAxis, string> = {
  anywhere: 'wherever it runs',
  cluster: 'on one cluster',
  provider: 'on one provider',
};

export interface LevelDraft {
  about: AboutAxis;
  where: WhereAxis;
  slugs: string[];
  project: string;
  kind: string;
  tags: string[];
  clusterId: string;
  provider: string;
}

export const EMPTY_LEVEL: LevelDraft = {
  about: 'everything',
  where: 'anywhere',
  slugs: [],
  project: '',
  kind: '',
  tags: [],
  clusterId: '',
  provider: '',
};

export interface EntryScopeDraft {
  scopeType: ContextScopeType;
  scopeRef?: string | null;
  selector?: AccessSelector;
}

function aboutSelector(d: LevelDraft): AccessSelector | null {
  switch (d.about) {
    case 'everything':
      return {};
    case 'apps':
      return d.slugs.length ? { slugs: d.slugs } : null;
    case 'project':
      return d.project ? { project: d.project } : null;
    case 'kind':
      return d.kind ? { kind: d.kind } : null;
    case 'tag':
      return d.tags.length ? { tags: d.tags } : null;
  }
}

function whereSelector(d: LevelDraft): AccessSelector | null {
  switch (d.where) {
    case 'anywhere':
      return {};
    case 'cluster':
      return d.clusterId ? { clusterId: d.clusterId } : null;
    case 'provider':
      return d.provider ? { provider: d.provider } : null;
  }
}

export function scopeOfLevel(d: LevelDraft): EntryScopeDraft | null {
  const about = aboutSelector(d);
  const where = whereSelector(d);
  if (!about || !where) return null;
  if (d.about === 'everything' && d.where === 'anywhere') {
    return { scopeType: 'global' };
  }
  if (d.about === 'everything' && d.where === 'cluster') {
    return { scopeType: 'cluster', scopeRef: d.clusterId };
  }
  return { scopeType: 'selector', selector: { ...about, ...where } };
}

export function prospectiveScope(
  d: LevelDraft,
): { scopeType: ContextScopeType; scopeRef?: string } | null {
  if (d.about === 'everything' && d.where === 'anywhere') {
    return { scopeType: 'global' };
  }
  if (d.about === 'everything' && d.where === 'cluster') {
    return d.clusterId
      ? { scopeType: 'cluster', scopeRef: d.clusterId }
      : null;
  }
  return { scopeType: 'selector' };
}

export function describeHand(hand: ContextHand | null | undefined): string | null {
  if (!hand) return null;
  if (hand.isYou) return 'you';
  return hand.name || 'someone this installation records no name for';
}

export function parseExpected(typed: unknown): unknown {
  // Three value accessors feed this: a number input emits a number, an empty one null.
  if (typeof typed === 'number') return Number.isNaN(typed) ? undefined : typed;
  if (typeof typed === 'boolean') return typed;
  if (typed === null || typed === undefined) return undefined;
  const text = String(typed);
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function probeParamsOf(
  rows: ReadonlyArray<{ name: string; value: string }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name) out[name] = row.value.trim();
  }
  return out;
}

export function declaredParamsOf(
  answers: Record<string, string>,
  takes: readonly ContextProbeParam[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const param of takes) {
    const value = (answers[param.name] ?? '').trim();
    if (value) out[param.name] = value;
  }
  return out;
}

export interface EntryDraft {
  level: LevelDraft;
  nature: EntryNature;
  topic: string;
  title: string;
  body: string;
  checkKind: CheckKind;
  probeId: string;
  probeParams: Record<string, unknown>;
  probeOp: ProbeOp;
  probeExpected: string;
  validForDays: number;
}

export const EMPTY_DRAFT: EntryDraft = {
  level: EMPTY_LEVEL,
  nature: 'practice',
  topic: '',
  title: '',
  body: '',
  checkKind: 'none',
  probeId: '',
  probeParams: {},
  probeOp: 'equals',
  probeExpected: '',
  validForDays: 90,
};

export function writeBodyOf(draft: EntryDraft): WriteContextEntry | null {
  const scope = scopeOfLevel(draft.level);
  if (!scope) return null;
  const body: WriteContextEntry = {
    scopeType: scope.scopeType,
    nature: draft.nature,
    topic: draft.topic.trim(),
    title: draft.title.trim(),
    body: draft.body.trim(),
    checkKind: draft.checkKind,
  };
  if (scope.scopeRef) body.scopeRef = scope.scopeRef;
  if (scope.selector) body.selector = scope.selector;
  if (draft.checkKind === 'probe') {
    body.probeId = draft.probeId;
    body.probeOp = draft.probeOp;
    body.probeParams = draft.probeParams;
    if (draft.probeOp !== 'exists') {
      body.probeExpected = parseExpected(draft.probeExpected);
    }
  }
  if (draft.checkKind === 'attestation') {
    body.validForDays = draft.validForDays;
  }
  return body;
}

export function whatIsStillNeeded(
  body: WriteContextEntry | null,
  probe?: ContextProbeOption,
): string | null {
  if (!body) {
    return 'Finish naming the level: an axis you picked is still empty.';
  }
  if (!body.topic) return 'Give it a subject, so two notes about one thing can be seen to disagree.';
  if (!body.title) return 'Give it a title.';
  if (!body.body) return 'Write the note itself.';
  if (body.checkKind === 'probe') {
    if (!body.probeId) return 'Pick the live fact this note leans on.';
    const params = body.probeParams ?? {};
    const unanswered = (probe?.takes ?? []).find(
      (p) => p.required && params[p.name] === undefined,
    );
    if (unanswered) {
      return `“${body.probeId}” cannot be asked without a ${unanswered.name}. Say which one this note is about.`;
    }
    const type = answerTypeOf(probe, params);
    if (
      type &&
      type !== 'number' &&
      (body.probeOp === 'atLeast' || body.probeOp === 'atMost')
    ) {
      return `That fact answers a ${type}, and “${body.probeOp}” compares numbers. Compare it with “equals”, or lean on one that answers a number.`;
    }
    if (body.probeOp !== 'exists' && body.probeExpected === undefined) {
      return `“${body.probeOp}” compares the fact with something. Write the value it should have — or say only that the fact is there, with “exists”.`;
    }
  }
  return null;
}

export function probeAllowedAt(scopeType: ContextScopeType): boolean {
  return scopeType !== 'global';
}

export const TOPIC_HINT =
  'A short lowercase handle, e.g. master-node-scaling. Two notes sharing one are about the same subject, which is how a disagreement between them can be shown at all.';

export const PREMISE_HINT =
  'The value is read in the type the fact answers: 3 against a count is stored as the number 3 and compared as one ever after. Something that cannot be read that way — three against a count — is refused while you are still here, with a sentence saying why. Nothing mistyped is saved and left to accuse itself later.';

export function reachIsWiderThanOwners(reach: EntryReach): boolean {
  return reach.descends;
}
