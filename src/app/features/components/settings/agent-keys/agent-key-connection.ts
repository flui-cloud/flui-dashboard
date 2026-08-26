import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';

export type ConnectedKey = ApiKeyResponseDto & {
  skillVersion?: string | null;
};

export interface KeyConnection {
  everUsed: boolean;
  everCheckedIn: boolean;
  seen: string;
  skill: string;
  outOfDate: boolean;
}

export function readKeyConnection(
  key: ConnectedKey,
  currentSkillVersion: string | null,
  now: number = Date.now(),
): KeyConnection {
  const declared = key.skillVersion?.trim() || null;
  const outOfDate =
    !!declared && !!currentSkillVersion && declared !== currentSkillVersion;
  return {
    everUsed: !!key.lastUsedAt,
    everCheckedIn: !!declared,
    seen: lastSeen(key.lastUsedAt, now),
    skill: skillPhrase(declared, currentSkillVersion, outOfDate),
    outOfDate,
  };
}

function lastSeen(lastUsedAt: string | undefined, now: number): string {
  if (!lastUsedAt) return 'no use recorded yet';
  const ms = now - new Date(lastUsedAt).getTime();
  if (ms < 120_000) return 'in use right now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `last used ${Math.floor(ms / 60_000)} minutes ago`;
  if (hours < 24) return `last used ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `last used ${days} day${days === 1 ? '' : 's'} ago`;
}

function skillPhrase(
  declared: string | null,
  current: string | null,
  outOfDate: boolean,
): string {
  if (!declared) return 'never said which instructions it is working from';
  if (!current) return `working from skill ${declared}`;
  if (outOfDate) return `working from skill ${declared} — this instance publishes ${current}`;
  return `working from skill ${declared}, the current one`;
}
