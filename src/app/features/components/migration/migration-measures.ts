import type { MigrationNextStep, MigrationRow } from '../../service/migration.service';

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

const UNTIL: Record<string, string> = {
  bridge: ' (until the bridge)',
  dns: ' (until DNS moved)',
  promote: ' (until the destination was promoted)',
  resume: ' (waiting in the poolers, none failed)',
};

/** Logical or physical copy, for the database and full rows. */
export function kindLabel(row: MigrationRow): string | null {
  return row.type === 'app' ? null : (row.kind ?? null);
}

/** One short line with the measured pause and interruption, when the API has them. */
export function measuresLine(row: MigrationRow): string | null {
  const parts: string[] = [];
  if (row.type !== 'app' && row.writePauseMs != null) {
    const until =
      row.type === 'full' && row.writePauseEndedBy
        ? UNTIL[row.writePauseEndedBy] ?? ''
        : '';
    parts.push(`Writes paused ${seconds(row.writePauseMs)}${until}`);
  }
  if (row.type !== 'db' && row.interruptionMs != null) {
    parts.push(`app stopped ${seconds(row.interruptionMs)}`);
  }
  if (row.type === 'db' && row.sourceWalCap) {
    parts.push(`source WAL capped at ${row.sourceWalCap.value}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** The poolers' part of the cutover: still holding writes, or who was cut at the deadline. */
export function poolerLine(row: MigrationRow): string | null {
  const pooler = row.type === 'app' ? null : row.pooler;
  if (!pooler) return null;
  if (pooler.paused) return 'Poolers holding writes';
  if (!pooler.cut.length) return null;
  const names = pooler.cut.map((c) => c.clientApp || 'a client');
  const shown = names.slice(0, 2).join(', ');
  const more = names.length > 2 ? ` and ${names.length - 2} more` : '';
  return `Cut at the ${seconds(pooler.deadlineMs)} deadline: ${shown}${more}`;
}

export function nextStepsOf(row: MigrationRow): MigrationNextStep[] {
  return row.type === 'app' ? [] : (row.nextSteps ?? []);
}
