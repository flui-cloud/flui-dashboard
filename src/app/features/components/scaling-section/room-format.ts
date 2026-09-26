import { FleetRoom, NodeRoom } from '../../model/scaling-group.models';

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
  buys = true,
): string {
  const fit = room.largestFit;
  if (!fit) return 'No node takes new apps right now.';
  const most = `${gib(fit.memoryMi)} · ${cores(fit.cpuMillicores)}`;
  if (waiting) {
    return `An app waiting needs ${waiting.memory} and ${waiting.cpu}; the most any node has left is ${most}.`;
  }
  const bigger = buys
    ? 'Anything bigger makes Flui buy a node.'
    : 'Anything bigger needs a new node, and this group buys none on its own.';
  return `The largest app that still fits: ${most} (on ${fit.node}). ${bigger}`;
}

/** Past this share a node reads as nearly full. */
export const TIGHT_PERCENT = 85;

/**
 * What the node is doing now and what its apps may grow to, beside what they
 * reserve. Limits past what the node holds is the window in which a spike
 * makes the node stop apps rather than wait for a new one.
 */
export function nodeUsageLine(node: NodeRoom): { text: string; overcommitted: boolean } | null {
  const parts: string[] = [];
  if (node.used) parts.push(`In use now ${gib(node.used.memoryMi)} · ${cores(node.used.cpuMillicores)}`);
  if (node.limits) parts.push(`at their limits ${gib(node.limits.memoryMi)} · ${cores(node.limits.cpuMillicores)}`);
  if (!parts.length) return null;
  const overcommitted = !!node.limits && node.limits.memoryMi > node.allocatable.memoryMi;
  return {
    text: parts.join(' — ') + (overcommitted ? ', more memory than the node holds' : ''),
    overcommitted,
  };
}
