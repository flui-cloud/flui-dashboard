import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ClusterOrphanedVolumesComponent } from './cluster-orphaned-volumes.component';
import {
  ClusterOrphanedClaimsService,
  OrphanedClaim,
} from '../../service/cluster-orphaned-claims.service';
import { PermissionService } from '../../../core/services/permission.service';

describe('the volumes no application owns', () => {
  let fixture: ComponentFixture<ClusterOrphanedVolumesComponent>;
  let remove: jasmine.Spy;
  let claims: ReturnType<typeof signal<OrphanedClaim[]>>;

  const claim = (over: Partial<OrphanedClaim> = {}): OrphanedClaim => ({
    name: 'data-uptime-kuma-0',
    namespace: 'user-a1b2c3',
    requested: '10Gi',
    requestedBytes: 10737418240,
    sizeLabel: '10 GiB',
    storageClass: 'flui-shared',
    phase: 'Bound',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastKnownApplication: {
      id: 'app-1',
      name: 'uptime-kuma',
      deletedAt: '2026-02-01T00:00:00.000Z',
    },
    reason: 'its application "uptime-kuma" was deleted and no pod mounts it',
    ...over,
  });

  async function mount(options: {
    rows: OrphanedClaim[];
    can?: boolean;
    note?: string | null;
  }): Promise<void> {
    claims = signal<OrphanedClaim[]>(options.rows);
    remove = jasmine.createSpy('remove').and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ClusterOrphanedVolumesComponent],
      providers: [
        {
          provide: ClusterOrphanedClaimsService,
          useValue: {
            claims,
            totalLabel: signal('10 GiB'),
            note: signal(options.note ?? null),
            loading: signal(false),
            error: signal(null),
            removing: signal(null),
            load: () => Promise.resolve(),
            remove,
          },
        },
        {
          provide: PermissionService,
          useValue: { can: () => options.can ?? true },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClusterOrphanedVolumesComponent);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  const REF = 'user-a1b2c3/data-uptime-kuma-0';

  afterEach(() => TestBed.resetTestingModule());

  it('draws the card even when the list is empty', async () => {
    await mount({ rows: [] });
    expect(el('orphaned-volumes')).not.toBeNull();
  });

  it('says "none found", never "none exist", when the list is empty', async () => {
    await mount({ rows: [] });
    const empty = el('orphaned-empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('none found');
  });

  it('refuses to call an unproven scan an empty one', async () => {
    await mount({
      rows: [],
      note: 'The cluster has no kubeconfig on file, so nothing could be scanned.',
    });
    expect(el('orphaned-empty')).toBeNull();
    expect(el('orphaned-note')!.textContent).toContain('nothing could be scanned');
  });

  it('names the dead application each volume came from, and its size', async () => {
    await mount({ rows: [claim()] });
    const row = el(`orphaned-row-${REF}`);
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('uptime-kuma');
    expect(row!.textContent).toContain('10 GiB');
    expect(row!.textContent).toContain('data-uptime-kuma-0');
  });

  it('falls back to the reason when no application is remembered', async () => {
    await mount({
      rows: [
        claim({
          lastKnownApplication: undefined,
          reason: 'no application, no StatefulSet and no pod refers to it',
        }),
      ],
    });
    const row = el(`orphaned-row-${REF}`);
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('no application, no StatefulSet');
  });

  it('shows no delete control to a principal who may not manage the cluster', async () => {
    await mount({ rows: [claim()], can: false });
    expect(el(`orphaned-row-${REF}`)).not.toBeNull();
    expect(el(`orphaned-delete-${REF}`)).toBeNull();
  });

  it('shows the delete control to one who may — so the test above proves a gate, not an empty page', async () => {
    await mount({ rows: [claim()], can: true });
    expect(el(`orphaned-delete-${REF}`)).not.toBeNull();
  });

  it('deletes nothing on the first click', async () => {
    await mount({ rows: [claim()] });
    (el(`orphaned-delete-${REF}`) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(remove).not.toHaveBeenCalled();
  });

  it('names the volume and its size in the confirmation, and says it is final', async () => {
    await mount({ rows: [claim()] });
    (el(`orphaned-delete-${REF}`) as HTMLButtonElement).click();
    fixture.detectChanges();
    const confirm = el(`orphaned-confirm-${REF}`);
    expect(confirm).not.toBeNull();
    expect(confirm!.textContent).toContain(REF);
    expect(confirm!.textContent).toContain('10 GiB');
    expect(confirm!.textContent).toContain('nothing brings it back');
  });

  it('deletes once, and only after the second click', async () => {
    await mount({ rows: [claim()] });
    (el(`orphaned-delete-${REF}`) as HTMLButtonElement).click();
    fixture.detectChanges();
    (el(`orphaned-confirm-delete-${REF}`) as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.calls.mostRecent().args[0]).toBe('cluster-1');
    expect(remove.calls.mostRecent().args[1].name).toBe('data-uptime-kuma-0');
  });

  it('deletes nothing when the person backs out', async () => {
    await mount({ rows: [claim()] });
    (el(`orphaned-delete-${REF}`) as HTMLButtonElement).click();
    fixture.detectChanges();
    const keep = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.trim() === 'Keep it');
    expect(keep).toBeDefined();
    (keep as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el(`orphaned-confirm-${REF}`)).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
