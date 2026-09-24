import {
  AvailabilityOutlook,
  LadderRung,
  ScalingPreview,
} from '../../model/scaling-group.models';
import { SectionGroup } from '../../model/scaling-section.models';
import { eurHour, heldFor } from './now-format';

export interface LadderRow {
  rung: LadderRung;
  chosen: boolean;
  offer: string;
  verdict: string;
  why: string;
  icon: string;
  tone: string;
}

/** Everything a rung's wording depends on, gathered once instead of per row. */
export interface LadderContext {
  group: SectionGroup;
  preview: ScalingPreview;
  outlook: Record<string, AvailabilityOutlook>;
  /** The catalogue answered, so a price or an availability means something. */
  read: boolean;
}

export function ladderRows(ctx: LadderContext): LadderRow[] {
  const chosenStep = ctx.preview.chosen?.step ?? null;

  return ctx.preview.ladder.map((rung) => ({
    rung,
    chosen: rung.step === chosenStep,
    offer: offer(rung),
    verdict: verdict(ctx, rung),
    why: why(ctx, rung),
    icon: icon(ctx, rung.outcome),
    tone: tone(ctx, rung, rung.step === chosenStep),
  }));
}

/** True where every rung reaches the same verdict, so the list adds nothing to it. */
export function rowsAgree(rows: LadderRow[]): boolean {
  const deciding = rows.filter((r) => r.rung.outcome !== 'alert');
  if (deciding.length < 2) return true;
  return deciding.every((r) => r.why === deciding[0].why);
}

/** The provider has no create API, so no rung can end in a purchase. */
function manual(ctx: LadderContext): boolean {
  return !ctx.group.capability.canProvision;
}

/** It could buy and will not: the group is armed to alarm instead. */
function withheld(ctx: LadderContext): boolean {
  return ctx.group.capability.canProvision && !ctx.group.acts.acts;
}

function offer(rung: LadderRung): string {
  if (!rung.shape) return '';
  const where = rung.region ? ` · ${rung.region}` : '';
  return `${rung.shape}${where} · ${eurHour(rung.hourlyEur)}`;
}

function verdict(ctx: LadderContext, rung: LadderRung): string {
  switch (rung.outcome) {
    case 'would-buy':
      if (manual(ctx)) return 'Would alert';
      return withheld(ctx) ? 'Wins, buys nothing' : 'Would buy';
    case 'unavailable':
      return 'Unavailable';
    case 'does-not-fit':
      return 'Does not fit';
    case 'over-budget':
      return 'Over budget';
    case 'refused-by-limit':
      return 'Refused by a limit';
    case 'alert':
      return 'Alerts you';
  }
}

/**
 * The engine writes each rung's reason with the facts in hand — which shape was
 * asked for, whether the sizes could be read at all — so its sentence wins.
 * Only where it stayed silent is one reconstructed from what the page can see,
 * and for an unavailable shape the catalogue's history is added to whatever it
 * said. The last rung's note is the whole advice — what to widen, what to
 * raise — which is why it is read one step at a time rather than on the page.
 */
function why(ctx: LadderContext, rung: LadderRung): string {
  if (rung.outcome === 'unavailable') return whyUnavailable(ctx, rung);
  if (rung.note) return rung.note;

  switch (rung.outcome) {
    case 'would-buy':
      return whyWouldBuy(ctx);
    case 'does-not-fit': {
      const waiting = ctx.preview.pending;
      return waiting
        ? `Too small for ${waiting.memory} — not a candidate.`
        : 'Too small for what is waiting — not a candidate.';
    }
    case 'over-budget': {
      const cap = ctx.group.limits.maxMonthlyCost;
      return cap === null
        ? 'Over the cost limit.'
        : `Would take the fleet past €${cap}/month.`;
    }
    case 'refused-by-limit':
      return "The group's own rules exclude it.";
    case 'alert':
      return whyAlert(ctx);
    default:
      return '';
  }
}

function whyWouldBuy(ctx: LadderContext): string {
  if (manual(ctx))
    return 'Fits and is available — but nothing here can buy it.';
  return withheld(ctx)
    ? 'Fits, available, inside the ceiling — and this group buys nothing.'
    : 'Fits, available, inside the ceiling.';
}

function whyUnavailable(ctx: LadderContext, rung: LadderRung): string {
  const state = rung.shape ? ctx.outlook[rung.shape] : undefined;
  const since = state?.sinceHours ? ` for ${heldFor(state.sinceHours)}` : '';
  const history = state?.downIn.length
    ? `Down in ${state.downIn.join(', ')}${since}.`
    : '';

  if (rung.note) return history ? `${rung.note} ${history}` : rung.note;
  if (history) return history;
  return ctx.read ? 'Not on offer.' : 'Nothing here could say.';
}

function whyAlert(ctx: LadderContext): string {
  if (ctx.group.capability.hasCatalogue) {
    return 'Nothing left below. Flui names the machine and stops.';
  }
  const req = ctx.group.requirement;
  return req
    ? `A machine with at least ${req.cpu} vCPU and ${req.memory} free. That requirement is the whole of the alarm.`
    : 'Another machine. Nothing here can name a type.';
}

function icon(ctx: LadderContext, outcome: LadderRung['outcome']): string {
  switch (outcome) {
    case 'would-buy':
      return withheld(ctx) ? 'lucidePause' : 'lucideCircleCheck';
    case 'unavailable':
      return 'lucideCircleDashed';
    case 'does-not-fit':
    case 'refused-by-limit':
      return 'lucideBan';
    case 'over-budget':
      return 'lucideEuro';
    case 'alert':
      return 'lucideBell';
  }
}

function tone(ctx: LadderContext, rung: LadderRung, chosen: boolean): string {
  if (rung.outcome === 'alert') return 'text-amber-600 dark:text-amber-400';
  if (chosen && withheld(ctx)) return 'text-foreground';
  return chosen ? 'status-healthy' : 'text-muted-foreground';
}
