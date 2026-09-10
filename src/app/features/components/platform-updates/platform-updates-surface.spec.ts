import type { SurfaceSnapshot } from '@flui-cloud/semantic-surface';
import {
  expectValidSurface,
  expectDeterministicDigest,
  validateSurfaceSemantics,
} from '../../../../testing/surface-test-utils';

import {
  PlatformUpdatesSurfaceInput,
  PlatformUpdatesSurfaceRevision,
  buildPlatformUpdatesSurface,
  platformUpdateComponentEntityRef,
  platformUpdateOperationEntityRef,
  presentedContent,
} from './platform-updates-surface';
import {
  PlatformComponentUpdate,
  PlatformUpdateOperation,
  PlatformUpdateStatus,
} from '../../service/platform-update.service';

function component(over: Partial<PlatformComponentUpdate> = {}): PlatformComponentUpdate {
  return {
    key: 'fluiApi',
    name: 'API',
    role: 'control plane',
    deploymentName: 'flui-api',
    installed: true,
    observed: true,
    installedVersion: '0.13.0',
    targetVersion: '0.13.0',
    installedIsRelease: true,
    changed: false,
    restartsControlPlane: true,
    ...over,
  };
}

function status(over: Partial<PlatformUpdateStatus> = {}): PlatformUpdateStatus {
  return {
    installedVersion: '0.13.0',
    availableVersion: null,
    updateAvailable: false,
    applicable: true,
    publishedAt: null,
    notes: [],
    migrations: 0,
    components: [component()],
    advisories: [],
    checkedAt: '2026-09-02T09:00:00.000Z',
    checkError: null,
    ...over,
  };
}

function operation(over: Partial<PlatformUpdateOperation> = {}): PlatformUpdateOperation {
  return {
    id: 'op-1',
    status: 'IN_PROGRESS',
    fromVersion: '0.12.0',
    targetVersion: '0.13.0',
    components: [
      { key: 'fluiApi', name: 'API', fromVersion: '0.12.0', targetVersion: '0.13.0', status: 'running' },
    ],
    migrations: 1,
    progress: 40,
    currentStep: 'Rolling out fluiApi',
    awaitingSelfRestart: false,
    startedAt: '2026-09-02T09:00:00.000Z',
    completedAt: null,
    errorMessage: null,
    userId: 'user-1',
    ...over,
  };
}

function input(over: Partial<PlatformUpdatesSurfaceInput> = {}): PlatformUpdatesSurfaceInput {
  return {
    loading: false,
    checking: false,
    apiUnreachable: false,
    status: status(),
    operation: null,
    history: [],
    confirming: false,
    acknowledged: false,
    ...over,
  };
}

function snapshotOf(over: Partial<PlatformUpdatesSurfaceInput> = {}): SurfaceSnapshot {
  return buildPlatformUpdatesSurface(input(over), { revision: 1, generatedAt: '2026-09-02T09:00:00.000Z' });
}

const pageScope = (s: SurfaceSnapshot) => s.scopes.find((sc) => sc.id === 'platform-updates')!;
const observation = (s: SurfaceSnapshot, key: string) => pageScope(s).observations?.find((o) => o.key === key);

describe('platform updates surface producer', () => {
  it('emits a snapshot that validates against the real schema and passes semantic checks, across the real states', () => {
    expectValidSurface(snapshotOf());
    expectValidSurface(snapshotOf({ status: status({ updateAvailable: true, availableVersion: '0.14.0', components: [component({ changed: true, targetVersion: '0.14.0' })] }) }));
    expectValidSurface(snapshotOf({ status: status({ checkError: 'network unreachable' }) }));
    expectValidSurface(snapshotOf({ operation: operation() }));
    expectValidSurface(snapshotOf({ operation: operation({ status: 'COMPLETED', completedAt: '2026-09-02T09:10:00.000Z' }) }));
    expectValidSurface(snapshotOf({ status: null, loading: true }));
    expectValidSurface(snapshotOf({ status: null, apiUnreachable: true }));
    expectValidSurface(
      snapshotOf({ history: [operation({ id: 'op-old', status: 'FAILED', errorMessage: 'boom' })] }),
    );
  });

  it('renders a byte-identical digest across two calls with the same input (determinism)', () => {
    expectDeterministicDigest(snapshotOf({ operation: operation() }));
  });

  it('bumps the revision on real change, and validateSurfaceSemantics accepts it against the previous snapshot', () => {
    const tracker = new PlatformUpdatesSurfaceRevision();
    const a = input();
    const b = input({ checking: true });
    const first = buildPlatformUpdatesSurface(a, {
      revision: tracker.next(presentedContent(a)),
      generatedAt: '2026-09-02T09:00:00.000Z',
    });
    const second = buildPlatformUpdatesSurface(b, {
      revision: tracker.next(presentedContent(b)),
      generatedAt: '2026-09-02T09:01:00.000Z',
    });
    expect(second.surface.revision).toBe(first.surface.revision + 1);
    expect(validateSurfaceSemantics(second, { previousSnapshot: first })).toEqual([]);
  });

  it('flags a snapshot whose revision does not advance on the previous one', () => {
    const first = snapshotOf();
    const stale = { ...snapshotOf(), surface: { ...snapshotOf().surface, revision: first.surface.revision } };
    const issues = validateSurfaceSemantics(stale, { previousSnapshot: first });
    expect(issues).toEqual([jasmine.objectContaining({ code: 'invalid-revision', severity: 'error' })]);
  });

  it('names the running operation in attention — that is what is actually being watched, not the page in the abstract', () => {
    const snapshot = snapshotOf({ operation: operation({ status: 'IN_PROGRESS' }) });
    expect(snapshot.attention).toEqual([
      { scopeId: 'platform-updates:operation', entityRef: platformUpdateOperationEntityRef('op-1'), reason: 'active-view' },
    ]);
  });

  it('names the page once nothing is running, even with a just-finished operation still on screen', () => {
    const snapshot = snapshotOf({ operation: operation({ status: 'COMPLETED', completedAt: '2026-09-02T09:10:00.000Z' }) });
    expect(snapshot.attention).toEqual([{ scopeId: 'platform-updates', reason: 'route' }]);
    expect(snapshot.scopes.some((s) => s.id === 'platform-updates:operation')).toBeTrue();
  });

  it('presents installed/available version and whether an update exists, straight from status', () => {
    const snapshot = snapshotOf({ status: status({ updateAvailable: true, availableVersion: '0.14.0' }) });
    expect(observation(snapshot, 'flui.platform_update.installed_version')?.presentedAs.text).toBe('0.13.0');
    expect(observation(snapshot, 'flui.platform_update.available_version')?.presentedAs.text).toBe('0.14.0');
    expect(observation(snapshot, 'flui.platform_update.update_available')?.presentedAs.value).toBe(true);
  });

  it('never carries the raw checkError sentence — only the derived boolean', () => {
    const snapshot = snapshotOf({ status: status({ checkError: 'DNS resolution failed for release.flui.cloud' }) });
    expect(observation(snapshot, 'flui.platform_update.check_failed')?.presentedAs.value).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('DNS resolution failed');
  });

  it('shows the components table only while nothing is running, and the operation\'s own component steps only while an operation exists', () => {
    const idle = snapshotOf();
    expect(idle.scopes.some((s) => s.id === 'platform-updates:components')).toBeTrue();
    expect(idle.scopes.some((s) => s.id === 'platform-updates:operation:components')).toBeFalse();

    const running = snapshotOf({ operation: operation({ status: 'IN_PROGRESS' }) });
    expect(running.scopes.some((s) => s.id === 'platform-updates:components')).toBeFalse();
    expect(running.scopes.some((s) => s.id === 'platform-updates:operation:components')).toBeTrue();
  });

  it('presents one platform component\'s version/role/change facts, referencing it by a stable ref distinct from the runtime platform-component entity type', () => {
    const snapshot = snapshotOf({
      status: status({
        updateAvailable: true,
        availableVersion: '0.14.0',
        components: [component({ changed: true, targetVersion: '0.14.0' })],
      }),
    });
    const row = snapshot.scopes.find((s) => s.id === 'platform-updates:components:fluiApi')!;
    expect(row.entities).toEqual([
      { ref: platformUpdateComponentEntityRef('fluiApi'), label: 'flui-api', role: 'related' },
    ]);
    expect(platformUpdateComponentEntityRef('fluiApi')).not.toBe('flui://platform-component/fluiApi');
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.text ?? o.presentedAs.value]));
    expect(obs['flui.platform_update.component_installed_version']).toBe('0.13.0');
    expect(obs['flui.platform_update.component_target_version']).toBe('0.14.0');
    expect(obs['flui.platform_update.component_changed']).toBe(true);
  });

  it('presents the running operation\'s own progress and per-component steps', () => {
    const snapshot = snapshotOf({ operation: operation() });
    const opScope = snapshot.scopes.find((s) => s.id === 'platform-updates:operation')!;
    expect(opScope.entities).toEqual([
      { ref: platformUpdateOperationEntityRef('op-1'), label: '0.12.0 → 0.13.0', role: 'primary' },
    ]);
    const obs = Object.fromEntries(opScope.observations!.map((o) => [o.key, o.presentedAs.text ?? o.presentedAs.value]));
    expect(obs['flui.platform_update.progress']).toBe(40);
    expect(obs['flui.platform_update.current_step']).toBeUndefined();
    const step = snapshot.scopes.find((s) => s.id === 'platform-updates:operation:components:fluiApi')!;
    expect((Object.fromEntries(step.observations!.map((o) => [o.key, o.presentedAs.text])))['flui.platform_update.component_status']).toBe('running');
  });

  it('never carries an operation\'s raw errorMessage — only whether it failed', () => {
    const snapshot = snapshotOf({
      operation: operation({ status: 'FAILED', errorMessage: 'connection refused to internal registry' }),
    });
    const opScope = snapshot.scopes.find((s) => s.id === 'platform-updates:operation')!;
    expect(opScope.observations!.find((o) => o.key === 'flui.platform_update.failed')?.presentedAs.value).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('connection refused');
  });

  it('presents the update history list, honestly empty when nothing was ever applied, and never a row\'s raw error text', () => {
    const empty = snapshotOf();
    const emptyList = empty.scopes.find((s) => s.id === 'platform-updates:history')!;
    expect(emptyList.state).toEqual({ empty: true });

    const withHistory = snapshotOf({
      history: [
        operation({
          id: 'op-old',
          status: 'FAILED',
          startedAt: '2026-09-01T09:00:00.000Z',
          completedAt: '2026-09-01T09:05:00.000Z',
          errorMessage: 'a very specific failure nobody should see in a digest',
        }),
      ],
    });
    const row = withHistory.scopes.find((s) => s.id === 'platform-updates:history:op-old')!;
    expect(row.entities).toEqual([{ ref: platformUpdateOperationEntityRef('op-old'), label: '0.12.0 → 0.13.0', role: 'related' }]);
    const obs = Object.fromEntries(row.observations!.map((o) => [o.key, o.presentedAs.text ?? o.presentedAs.value]));
    expect(obs['flui.platform_update.status']).toBe('FAILED');
    expect(obs['flui.platform_update.duration_seconds']).toBe(300);
    expect(obs['flui.platform_update.failed']).toBe(true);
    expect(JSON.stringify(withHistory)).not.toContain('a very specific failure');
  });

  it('reflects the confirm dialog and migration acknowledgement as UI state, only while the checkbox would actually be on screen', () => {
    const withCheckbox = snapshotOf({ status: status({ migrations: 1 }), confirming: true, acknowledged: true });
    expect(observation(withCheckbox, 'flui.platform_update.confirm_dialog_open')?.presentedAs.value).toBe(true);
    expect(observation(withCheckbox, 'flui.platform_update.migration_acknowledged')?.presentedAs.value).toBe(true);

    const noMigrations = snapshotOf({ status: status({ migrations: 0 }), confirming: true });
    expect(observation(noMigrations, 'flui.platform_update.migration_acknowledged')).toBeUndefined();
  });

  it('marks the view as failed to load only when nothing could be read at all, not while stale data is still shown', () => {
    const neverLoaded = snapshotOf({ status: null, apiUnreachable: true });
    expect(pageScope(neverLoaded).state).toEqual({
      loading: false,
      error: true,
      errorCode: 'flui.platform_update.load_failed',
    });

    const staleButShown = snapshotOf({ status: status(), apiUnreachable: true });
    expect(pageScope(staleButShown).state?.error).toBeUndefined();
  });
});
