import { FleetRoom } from '../../model/scaling-group.models';

export function gib(mi: number): string {
  return `${(mi / 1024).toFixed(1)} GiB`;
}

export function cores(millicores: number): string {
  return `${(millicores / 1000).toFixed(1)} CPU`;
}

/** Share of the node reserved, 0–100, for a bar. */
export function share(used: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
}

/**
 * The one sentence that answers "how close is the next node".
 *
 * Said against what is waiting when something is, because then the question
 * is not how much room is left but how much is missing.
 */
export function roomLine(
  room: FleetRoom,
  waiting: { memory: string; cpu: string } | null,
): string {
  const fit = room.largestFit;
  if (!fit) return 'No node takes new apps right now.';
  const most = `${gib(fit.memoryMi)} · ${cores(fit.cpuMillicores)}`;
  if (waiting) {
    return `An app waiting needs ${waiting.memory} and ${waiting.cpu}; the most any node has left is ${most}.`;
  }
  return `The largest app that still fits: ${most} (on ${fit.node}). Anything bigger makes Flui buy a node.`;
}

/** Past this share a node reads as nearly full. */
export const TIGHT_PERCENT = 85;
