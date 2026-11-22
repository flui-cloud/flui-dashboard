import { StatusTone } from '../../../ui/primitives/status';
import { EvidenceDto } from '../../../core/api/model/evidenceDto';
import { RepositoryMapDto } from '../../../core/api/model/repositoryMapDto';
import { VerdictDto } from '../../../core/api/model/verdictDto';

/** Every field the generator typed as bare `object` because the OpenAPI spec left it
 * `nullable: true` with no `type` — it is really `string | null` on the wire. */
export function str(v: unknown): string {
  return v === null || v === undefined ? '' : (v as string);
}

/** The engine writes paragraphs; this screen shows one sentence of them and nothing else.
 * The full text is a click away in the raw map. */
export function firstSentence(text: string): string {
  const whole = (text ?? '').trim();
  const stop = /[.!?](\s|$)/.exec(whole);
  return stop ? whole.slice(0, stop.index + 1) : whole;
}

/** Outcomes that mean something is standing in the way — the card must never be empty under one. */
export const BAD_OUTCOMES = new Set<string>([
  'blocked',
  'insufficient_capacity',
  'partial',
  'not_assessed',
]);

/** The verdicts the apply endpoint refuses outright. Deliberately not `BAD_OUTCOMES`: `partial`
 * is a verdict it acts on — the ready units go, the blocked ones are held back — and disabling
 * the button on it would refuse a deploy the backend would have accepted. */
export const UNACTIONABLE_OUTCOMES = new Set<string>([
  'blocked',
  'insufficient_capacity',
  'not_assessed',
]);

export interface Obstacle {
  summary: string;
  remedy: string;
  unit: string;
}

/** One thing the user has to hand over: a value, or the key that reaches a third party. */
export interface NeededThing {
  name: string;
  tags: string[];
  detail: string;
}

export interface MapQuestion {
  id: string;
  question: string;
  options: string[];
}

/** The engine names the root unit `.`, which on its own renders as a bare dot. */
export function unitName(id: string): string {
  return id === '.' ? 'root' : id;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 10);
}

export function outcomeLabel(outcome: string | undefined): string {
  switch (outcome) {
    case VerdictDto.OutcomeEnum.Deployable:
      return 'Ready to deploy';
    case VerdictDto.OutcomeEnum.DeployablePendingInputs:
      return 'Ready once you fill in the values below';
    case VerdictDto.OutcomeEnum.Partial:
      return 'Partly ready';
    case VerdictDto.OutcomeEnum.Blocked:
      return 'Not deployable yet';
    case VerdictDto.OutcomeEnum.InsufficientCapacity:
      return 'Too big for this cluster';
    case VerdictDto.OutcomeEnum.NotAssessed:
      return 'Not assessed';
    default:
      return 'Unknown';
  }
}

export function outcomeTone(outcome: string | undefined): StatusTone {
  switch (outcome) {
    case VerdictDto.OutcomeEnum.Deployable:
      return 'success';
    case VerdictDto.OutcomeEnum.DeployablePendingInputs:
    case VerdictDto.OutcomeEnum.Partial:
      return 'warning';
    case VerdictDto.OutcomeEnum.Blocked:
    case VerdictDto.OutcomeEnum.InsufficientCapacity:
      return 'error';
    default:
      return 'neutral';
  }
}

export function readinessOf(verdict: VerdictDto, unitId: string): string {
  return verdict.units.find((u) => u.id === unitId)?.readiness ?? 'not_assessed';
}

export function readinessLabel(readiness: string): string {
  switch (readiness) {
    case 'deployable':
      return 'Ready';
    case 'deployable_pending_inputs':
      return 'Needs values';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Not assessed';
  }
}

export function readinessTone(readiness: string): StatusTone {
  switch (readiness) {
    case 'deployable':
      return 'success';
    case 'deployable_pending_inputs':
      return 'warning';
    case 'blocked':
      return 'error';
    default:
      return 'neutral';
  }
}

/** The cluster half of the verdict, in one line and only when it was actually computed. */
export function capacityLine(v: VerdictDto): string {
  const cap = v.capacity;
  if (!cap.assessed) {
    switch (cap.notAssessedReason) {
      case 'cluster-unreadable':
        return 'The chosen cluster could not be read, so nothing was weighed against it.';
      case 'no-declared-footprint':
        return 'Nothing here declares how much it needs, so it could not be weighed against the cluster.';
      default:
        return '';
    }
  }
  const a = cap.assessment;
  const head = a.fits ? 'Fits the cluster' : 'Does not fit the cluster';
  const uncounted = cap.uncounted.length;
  const things = uncounted === 1 ? 'thing' : 'things';
  const unweighed =
    uncounted > 0 ? ` ${uncounted} ${things} could not be weighed, so this may not hold.` : '';
  return `${head}: needs ${a.requiredCpuMillicores}m CPU and ${a.requiredMemoryMebibytes}Mi, ${a.availableCpuMillicores}m and ${a.availableMemoryMebibytes}Mi free.${unweighed}`;
}

/** The units counted by readiness — structured data, not the engine's concatenated prose. */
export function verdictHeadline(v: VerdictDto): string {
  if (v.units.length === 0) return 'Nothing deployable was found on this branch.';
  const count = (readiness: string) => v.units.filter((u) => u.readiness === readiness).length;
  const ready = count('deployable');
  const pending = count('deployable_pending_inputs');
  const blocked = count('blocked');
  const unassessed = count('not_assessed');

  if (BAD_OUTCOMES.has(v.outcome) && blocked === 0 && unassessed === 0) {
    return firstSentence(v.reason);
  }

  const parts: string[] = [];
  if (ready > 0) parts.push(`${ready} ready`);
  if (pending > 0) parts.push(`${pending} needs values`);
  if (blocked > 0) parts.push(`${blocked} blocked`);
  if (unassessed > 0) parts.push(`${unassessed} not assessed`);
  return `${v.units.length} app${v.units.length === 1 ? '' : 's'}: ${parts.join(', ')}.`;
}

/** Option chips are the engine's own prose arriving through a second door: on the corpus, 163 of
 * 229 options run past eight words and the longest map reached ~1120 visible words that way. A
 * chip is a chip only while it is short. */
export function shortOptions(options: string[]): string[] {
  return options.filter((o) => o.trim().split(/\s+/).length <= 4);
}

export function longOptionCount(options: string[]): number {
  return options.length - shortOptions(options).length;
}

export function neededFrom(map: RepositoryMapDto | null | undefined): NeededThing[] {
  if (!map) return [];
  const inputs: NeededThing[] = map.inputs.map((i) => ({
    name: i.name,
    tags: [...(i.secret ? ['secret'] : []), ...(i.blocksStart ? ['needed to start'] : [])],
    detail: i.forService ? `for ${i.forService}` : '',
  }));
  const seen = new Set(inputs.map((i) => i.name));
  const externals: NeededThing[] = map.externals.flatMap((ext) => {
    const keys = ext.requires.filter((key) => !seen.has(key));
    if (keys.length === 0) {
      return [{ name: ext.name, tags: ['external service'], detail: 'credentials you bring' }];
    }
    return keys.map((key) => ({ name: key, tags: [], detail: `for ${ext.name}` }));
  });
  return [...inputs, ...externals];
}

export function questionsFrom(map: RepositoryMapDto | null | undefined): MapQuestion[] {
  if (!map) return [];
  const own = map.questions.map((q) => ({
    id: q.id,
    question: firstSentence(q.question),
    options: q.options,
  }));
  const health = map.units
    .filter((u) => !u.healthPath && u.port)
    .map((u) => ({
      id: `health:${u.id}`,
      question: `Which path answers a health check for ${unitName(u.id)}? Declare it in deploy.healthcheck.path.`,
      options: [] as string[],
    }));
  return [...own, ...health];
}

export function obstaclesFrom(
  map: RepositoryMapDto | null | undefined,
  verdict: VerdictDto | undefined,
): Obstacle[] {
  if (!map || !verdict) return [];
  const fromBlockers: Obstacle[] = map.blockers.map((b) => ({
    summary: firstSentence(b.summary),
    remedy: firstSentence(b.remedy),
    unit: str(b.unit) ? unitName(str(b.unit)) : '',
  }));
  if (fromBlockers.length > 0) return fromBlockers;
  if (BAD_OUTCOMES.has(verdict.outcome)) {
    return [
      {
        summary: firstSentence(verdict.reason),
        remedy: verdict.remedy ? firstSentence(verdict.remedy) : '',
        unit: '',
      },
    ];
  }
  return [];
}

export function fileBaseUrl(
  repoUrl: string | undefined,
  provider: string | undefined,
  commitSha: string | undefined,
): string | null {
  if (!repoUrl || !commitSha || !/^https?:\/\//.test(repoUrl)) return null;
  const root = trimTrailingSlashes(repoUrl.replace(/\.git$/, ''));
  const blob = provider === 'gitlab' ? '-/blob' : 'blob';
  return `${root}/${blob}/${commitSha}/`;
}

export function evidenceHref(base: string, evidence: EvidenceDto): string {
  const path = evidence.file.split('/').map(encodeURIComponent).join('/');
  const anchor = evidence.line ? `#L${evidence.line}` : '';
  return `${base}${path}${anchor}`;
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end--;
  return value.slice(0, end);
}
