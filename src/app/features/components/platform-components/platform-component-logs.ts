import type { AppLogEntryDto } from '../../service/application-logs.service';

export interface ParsedLogs {
  readonly entries: AppLogEntryDto[];
  readonly parseError: string | null;
}

const TIMESTAMP_PREFIX = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)/s;

function jsonEntry(line: string, podName: string): AppLogEntryDto | null {
  if (!line.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(line);
    return {
      timestamp: parsed.timestamp ?? parsed.time ?? parsed.ts ?? new Date().toISOString(),
      level: parsed.level ?? parsed.severity ?? parsed.lvl,
      message: parsed.message ?? parsed.msg ?? parsed.log ?? line,
      pod: parsed.pod ?? podName,
      namespace: parsed.namespace,
      container: parsed.container,
      stream: parsed.stream,
      hostname: parsed.hostname ?? parsed.host,
      metadata: parsed,
    };
  } catch {
    return null;
  }
}

function textEntry(line: string, podName: string): AppLogEntryDto {
  const match = TIMESTAMP_PREFIX.exec(line);
  if (match) return { timestamp: match[1], message: match[2], pod: podName };
  return { timestamp: new Date().toISOString(), message: line, pod: podName };
}

export function parseLogText(raw: string, podName: string): ParsedLogs {
  if (!raw?.trim()) return { entries: [], parseError: null };
  const entries = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => jsonEntry(line, podName) ?? textEntry(line, podName));
  return { entries, parseError: null };
}

export function filterLogEntries(entries: AppLogEntryDto[], query: string): AppLogEntryDto[] {
  const q = query.toLowerCase().trim();
  if (!q) return entries;
  return entries.filter((e) => {
    const metaStr = e.metadata ? JSON.stringify(e.metadata) : '';
    return [
      e.message,
      e.pod,
      e.level,
      e.container,
      e.namespace,
      e.stream,
      e.hostname,
      e.server_id,
      e.server_type,
      metaStr,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}
