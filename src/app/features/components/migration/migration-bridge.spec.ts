import {
  bridgeBlocksAbort,
  bridgeLine,
  canAbort,
  canCutover,
  canDestroySource,
  canResumeCutover,
  cutoverLabel,
  destroyConfirmation,
  pendingConfirmation,
} from './migration-bridge';
import type { MigrationBridge, MigrationRow } from '../../service/migration.service';

const bridge = (over: Partial<MigrationBridge> = {}): MigrationBridge => ({
  mode: 'bridge',
  skipReason: null,
  state: 'active',
  hosts: [{ fqdn: 'shop.example.com', certificate: 'dns-01', certificateReady: true }],
  closableAt: '2026-10-11T12:05:00.000Z',
  readyToClose: false,
  blockedBy: 'ttl',
  summary: 'The old cluster forwards to the new one; safe to close from 2026-10-11T12:05:00.000Z.',
  ...over,
});

const row = (status: string, b: MigrationBridge | null, extra: Partial<MigrationRow> = {}): MigrationRow =>
  ({
    type: 'app',
    id: 'm1',
    srcAppId: 'a1',
    srcClusterId: 'c1',
    targetClusterId: 'c2',
    cutoverMode: 'manual',
    status,
    bridge: b,
    ...extra,
  }) as MigrationRow;

describe('migration bridge on the migrations list', () => {
  it('offers Destroy source while bridging and after a completed migration, once', () => {
    expect(canDestroySource(row('bridging', bridge()))).toBeTrue();
    expect(canDestroySource(row('completed', null))).toBeTrue();
    expect(canDestroySource(row('completed', null, { sourceDestroyedAt: '2026-10-11T12:00:00Z' } as never))).toBeFalse();
    expect(canDestroySource(row('ready', bridge({ state: 'preparing' })))).toBeFalse();
  });

  it('shows the API summary under an open bridge, and nothing otherwise', () => {
    expect(bridgeLine(row('bridging', bridge()))).toBe(bridge().summary);
    expect(bridgeLine(row('completed', bridge({ state: 'closed' })))).toBeNull();
    expect(bridgeLine(row('ready', null))).toBeNull();
  });

  it('asks to close the bridge anyway while cached answers may still point at the old cluster', () => {
    const c = destroyConfirmation(row('bridging', bridge()));
    expect(c.closeBridge).toBeTrue();
    expect(c.confirmText).toBe('Close bridge and destroy');
    expect(c.message).toContain(bridge().summary);
  });

  it('closes the bridge without forcing once it is safe', () => {
    const c = destroyConfirmation(row('bridging', bridge({ readyToClose: true, blockedBy: null })));
    expect(c.closeBridge).toBeFalse();
    expect(c.confirmText).toBe('Destroy');
  });

  it('does not offer Abort once the bridge is open, as the API refuses it', () => {
    expect(bridgeBlocksAbort(row('failed', bridge()))).toBeTrue();
    expect(bridgeBlocksAbort(row('failed', bridge({ state: 'preparing' })))).toBeFalse();
    expect(bridgeBlocksAbort(row('failed', null))).toBeFalse();
  });

  it('offers to resume a cutover only when the API says it can be resumed', () => {
    const stuck = row('cutover', bridge({ state: 'preparing' }), { canResumeCutover: true } as never);
    expect(canResumeCutover(stuck)).toBeTrue();
    expect(cutoverLabel(stuck)).toBe('Resume cutover');
    expect(canResumeCutover(row('cutover', null, { canResumeCutover: false } as never))).toBeFalse();
    expect(cutoverLabel(row('ready', null))).toBe('Cutover');
  });

  it('offers to resume a full migration cutover the API says can be resumed', () => {
    const full = row('failed_forward', null, { type: 'full', canResumeCutover: true } as never);
    expect(canResumeCutover(full)).toBeTrue();
    expect(cutoverLabel(full)).toBe('Resume cutover');
  });

  it('stops offering Destroy source on a full move whose source is already gone', () => {
    const gone = row('completed', null, { type: 'full', nextSteps: [{ key: 'protect-database', text: 'x' }] } as never);
    const standing = row('completed', null, {
      type: 'full',
      nextSteps: [{ key: 'destroy-source', text: 'y' }],
    } as never);
    expect(canDestroySource(gone)).toBeFalse();
    expect(canDestroySource(standing)).toBeTrue();
  });
});

describe('migration row gating and confirmation copy', () => {
  it('offers cutover on a ready app, a synced database and a resumable cutover', () => {
    expect(canCutover(row('ready', null))).toBeTrue();
    expect(canCutover(row('synced', null, { type: 'db' } as never))).toBeTrue();
    expect(canCutover(row('ready', null, { type: 'db' } as never))).toBeFalse();
    expect(canCutover(row('failed', null, { canResumeCutover: true } as never))).toBeTrue();
    expect(canCutover(row('failed', null))).toBeFalse();
  });

  it('offers abort before the bridge forwards, never after', () => {
    expect(canAbort(row('replicating', null))).toBeTrue();
    expect(canAbort(row('completed', null))).toBeFalse();
    expect(canAbort(row('failed', bridge()))).toBeFalse();
  });

  it('words the dialog for the pending action', () => {
    expect(pendingConfirmation(null)).toEqual({
      title: 'Abort migration',
      message: 'Abort this migration? The destination is torn down; the source is untouched.',
      confirmText: 'Abort',
    });
    const destroying = row('completed', null);
    expect(pendingConfirmation({ kind: 'destroy', row: destroying })).toEqual({
      title: 'Destroy source',
      message: destroyConfirmation(destroying).message,
      confirmText: destroyConfirmation(destroying).confirmText,
    });
  });
});
