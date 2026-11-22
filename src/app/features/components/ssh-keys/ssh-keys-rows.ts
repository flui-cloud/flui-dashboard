import type { Observable } from 'rxjs';
import type { SSHKeyDto } from '../../../core/api';
import type { MenuAction } from '../../../ui/overlays/actions-menu';
import type { StatusTone } from '../../../ui/primitives/status';

export type ProviderSlug = 'contabo' | 'hetzner' | 'scaleway' | 'ovh' | 'byos';

export interface ProviderRef {
  readonly id: string;
  readonly displayName: string;
}

export interface ProviderSync extends ProviderRef {
  readonly synced: boolean;
  readonly error: string | null;
}

export interface ProviderSyncView {
  readonly id: string;
  readonly tone: StatusTone;
  readonly label: string;
  readonly title: string;
}

export interface DeleteTarget {
  readonly removeFromProviders: boolean;
  readonly provider: ProviderSlug | undefined;
}

export function providerRefs(
  active: readonly { provider: string }[],
  definitions: readonly { id: string; displayName?: string }[],
): ProviderRef[] {
  return active.map((config) => {
    const def = definitions.find((d) => d.id === config.provider);
    return { id: config.provider, displayName: def?.displayName ?? config.provider };
  });
}

export function providerSyncOf(key: SSHKeyDto, providers: readonly ProviderRef[]): ProviderSync[] {
  const mappings = key.providerKeyMappings as Record<string, string> | undefined;
  const errors = key.syncErrors as Record<string, string> | undefined;
  return providers.map((p) => {
    const synced = !!mappings?.[p.id];
    const error = !synced && errors?.[p.id] ? errors[p.id] : null;
    return { ...p, synced, error };
  });
}

export function syncToken(keyId: string, providerId: string): string {
  return `${keyId}:${providerId}`;
}

export function withToken(set: ReadonlySet<string>, token: string): Set<string> {
  const next = new Set(set);
  next.add(token);
  return next;
}

export function withoutToken(set: ReadonlySet<string>, token: string): Set<string> {
  const next = new Set(set);
  next.delete(token);
  return next;
}

export function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  return set.has(id) ? withoutToken(set, id) : withToken(set, id);
}

export function syncView(p: ProviderSync, syncing: boolean, unsyncing: boolean): ProviderSyncView {
  if (syncing) {
    return { id: p.id, tone: 'progress', label: p.displayName, title: 'Syncing' };
  }
  if (unsyncing) {
    return { id: p.id, tone: 'progress', label: p.displayName, title: 'Removing' };
  }
  if (p.synced) return { id: p.id, tone: 'success', label: p.displayName, title: 'Synced' };
  if (p.error) return { id: p.id, tone: 'error', label: p.displayName, title: p.error };
  return { id: p.id, tone: 'neutral', label: p.displayName, title: 'Not synced' };
}

export function keyRowActions(
  sync: readonly ProviderSync[],
  isBusy: (providerId: string) => boolean,
): MenuAction[] {
  const providerActions: MenuAction[] = sync.map((p) =>
    p.synced
      ? {
          id: `unsync:${p.id}`,
          label: `Remove from ${p.displayName}`,
          disabled: isBusy(p.id),
        }
      : {
          id: `sync:${p.id}`,
          label: p.error ? `Retry sync to ${p.displayName}` : `Sync to ${p.displayName}`,
          disabled: isBusy(p.id),
        },
  );
  return [
    { id: 'copy', label: 'Copy public key' },
    { id: 'download', label: 'Download public key' },
    ...providerActions.map((a, i) => (i === 0 ? { ...a, separatorBefore: true } : a)),
    { id: 'delete', label: 'Delete key', danger: true, separatorBefore: true },
  ];
}

export function dedupeByFingerprint(keys: readonly SSHKeyDto[]): SSHKeyDto[] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    if (seen.has(k.fingerprint)) return false;
    seen.add(k.fingerprint);
    return true;
  });
}

export function sortByCreated(keys: readonly SSHKeyDto[], dir: 'asc' | 'desc'): SSHKeyDto[] {
  return [...keys].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === 'desc' ? -diff : diff;
  });
}

export function deleteTarget(scope: string): DeleteTarget {
  return {
    removeFromProviders: scope !== 'db-only',
    provider: scope !== 'all' && scope !== 'db-only' ? (scope as ProviderSlug) : undefined,
  };
}

export function bulkDeleteTarget(key: SSHKeyDto, scope: string): DeleteTarget {
  if (key.syncedFromProvider && key.source !== 'local' && key.source !== 'byos') {
    return { removeFromProviders: true, provider: key.source };
  }
  return deleteTarget(scope);
}

export function bulkDeleteMessage(total: number, failed: number): string {
  const deleted = total - failed;
  if (failed > 0) return `${deleted} deleted, ${failed} failed.`;
  return `${deleted} key${deleted > 1 ? 's' : ''} deleted.`;
}

export function keysSummary(keys: readonly SSHKeyDto[], now = new Date()): string {
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const active = keys.filter((k) => k.isActive).length;
  const recent = keys.filter((k) => new Date(k.createdAt) > weekAgo).length;
  const auto = keys.filter((k) => k.autoGenerated).length;
  return `${active} active · ${recent} added this week · ${auto} auto-generated`;
}

export function formatKeyDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

export function downloadPublicKey(key: SSHKeyDto): void {
  const blob = new Blob([key.publicKey], { type: 'text/plain' });
  const url = globalThis.window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key.name.replaceAll(/\s+/g, '_')}.pub`;
  a.click();
  globalThis.window.URL.revokeObjectURL(url);
}

export function runInSequence<T>(
  items: readonly T[],
  run: (item: T) => Observable<unknown>,
  each: (item: T, ok: boolean) => void,
  done: (failed: number) => void,
): void {
  const next = (index: number, failed: number): void => {
    if (index >= items.length) {
      done(failed);
      return;
    }
    const item = items[index];
    run(item).subscribe({
      next: () => {
        each(item, true);
        next(index + 1, failed);
      },
      error: () => {
        each(item, false);
        next(index + 1, failed + 1);
      },
    });
  };
  next(0, 0);
}
