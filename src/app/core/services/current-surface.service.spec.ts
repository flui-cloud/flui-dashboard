import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import { CurrentSurfaceService } from './current-surface.service';

function snapshot(surfaceId: string): SurfaceSnapshot {
  return {
    schemaVersion: '0.2',
    app: { id: 'flui-dashboard' },
    surface: {
      id: surfaceId,
      revision: 1,
      generatedAt: '2026-09-03T00:00:00.000Z',
    },
    attention: [],
    scopes: [],
  };
}

describe('CurrentSurfaceService', () => {
  it('holds whatever was last written, starting null', () => {
    const service = new CurrentSurfaceService();
    expect(service.current()).toBeNull();

    const a = snapshot('page-a');
    service.set(a);
    expect(service.current()).toBe(a);
  });

  it('clears cleanly on an explicit null write, and a fresh write after that is not a canary violation', () => {
    const service = new CurrentSurfaceService();
    const warn = spyOn(console, 'error');

    service.set(snapshot('page-a'));
    service.set(null);
    service.set(snapshot('page-b'));

    expect(service.current()!.surface.id).toBe('page-b');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when the same page rewrites its own snapshot (a real re-render, not two producers)', () => {
    const service = new CurrentSurfaceService();
    const warn = spyOn(console, 'error');

    service.set(snapshot('page-a'));
    service.set(snapshot('page-a')); // new object, same surface.id

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when a different snapshot replaces a live one with no intervening clear (the canary)', () => {
    const service = new CurrentSurfaceService();
    const warn = spyOn(console, 'error');

    service.set(snapshot('page-a'));
    service.set(snapshot('page-b')); // page-a's own ngOnDestroy never ran

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.calls.mostRecent().args[0]).toContain('page-b');
    expect(warn.calls.mostRecent().args[0]).toContain('page-a');
    // The write itself is never blocked — only flagged.
    expect(service.current()!.surface.id).toBe('page-b');
  });
});
