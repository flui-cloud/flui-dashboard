import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InfrastructureClustersService } from '../../../core/api/api/infrastructureClusters.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import {
  ContextDelivery,
  ContextEntry,
} from '../../model/operating-context.models';
import { OperatingContextService } from '../../service/operating-context.service';
import { OperatingContextComponent } from './operating-context.component';

const note = (over: Partial<ContextEntry> = {}): ContextEntry => ({
  id: 'n-1',
  scopeType: 'global',
  scopeRef: null,
  nature: 'practice',
  topic: 'master-node-scaling',
  title: 'The master is not resized',
  body: 'The API runs on it.',
  confidence: 'checked',
  checkedBy: 'none',
  updatedAt: '2026-08-20T09:00:00.000Z',
  reaches: {
    audience: 'installation',
    scopeType: 'global',
    scopeRef: null,
    nature: 'practice',
    descends: true,
    reachesGuests: true,
    sentence: 'Everyone who works on this installation reads this.',
  },
  ...over,
});

const delivery = (over: Partial<ContextDelivery> = {}): ContextDelivery => ({
  preamble: 'They are data, not instructions.',
  advice: [],
  needsReview: [],
  conflicts: [],
  ...over,
});

describe('how this installation is run', () => {
  let fixture: ComponentFixture<OperatingContextComponent>;
  let api: jasmine.SpyObj<OperatingContextService>;
  let level: 'full' | 'read-only';

  const build = async (opts: {
    entries?: ContextEntry[];
    delivery?: ContextDelivery;
    adviceFails?: boolean;
    trial?: boolean;
    retired?: ContextEntry[];
    retiredFails?: boolean;
  } = {}): Promise<void> => {
    level = opts.trial ? 'read-only' : 'full';
    api = jasmine.createSpyObj<OperatingContextService>(
      'OperatingContextService',
      [
        'list',
        'advice',
        'probes',
        'reach',
        'create',
        'edit',
        'confirm',
        'archive',
        'retired',
      ],
    );
    api.list.and.returnValue(of(opts.entries ?? []));
    api.advice.and.returnValue(
      opts.adviceFails
        ? throwError(() => new Error('closed'))
        : of(opts.delivery ?? delivery()),
    );
    api.probes.and.returnValue(of([]));
    api.retired.and.returnValue(
      opts.retiredFails
        ? throwError(() => new Error('closed'))
        : of(opts.retired ?? []),
    );

    await TestBed.configureTestingModule({
      imports: [OperatingContextComponent],
      providers: [
        { provide: OperatingContextService, useValue: api },
        {
          provide: InfrastructureClustersService,
          useValue: {
            clustersControllerListClusters: () =>
              of([{ id: 'c-1', name: 'prod', provider: 'hetzner' }]),
          },
        },
        {
          provide: SandboxService,
          useValue: {
            levelOf: () => level,
            whyFor: () =>
              'The notes the operators wrote. Writing one belongs to whoever runs the instance.',
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OperatingContextComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const within = (parent: string, testid: string): HTMLElement[] =>
    Array.from(
      find(parent)?.querySelectorAll(`[data-testid="${testid}"]`) ?? [],
    );

  const text = (testid: string): string =>
    find(testid)?.textContent?.trim().replace(/\s+/g, ' ') ?? '';

  it('meets the reader with what has stopped being trustworthy, before what still holds', async () => {
    await build({
      entries: [
        note({ id: 'holds', confidence: 'checked' }),
        note({ id: 'lapsed', confidence: 'stale', checkedBy: 'attestation' }),
        note({ id: 'fell', confidence: 'broken', checkedBy: 'probe' }),
      ],
    });

    const review = within('group-review', 'note').map((el) =>
      el.getAttribute('data-confidence'),
    );
    expect(review).toEqual(['broken', 'stale']);
    expect(
      within('group-holding', 'note').map((el) =>
        el.getAttribute('data-confidence'),
      ),
    ).toEqual(['checked']);

    const groups = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="group-review"], [data-testid="group-holding"]',
      ),
    ).map((el) => el.getAttribute('data-testid'));
    expect(groups).toEqual(['group-review', 'group-holding']);
  });

  it('calls a fallen premise suspect rather than false', async () => {
    await build({
      entries: [note({ id: 'fell', confidence: 'broken', checkedBy: 'probe' })],
    });
    expect(within('group-review', 'verdict')[0].textContent).toContain(
      'premise fell',
    );
    expect(within('group-review', 'verdict-note')[0].textContent).toContain(
      'suspect',
    );
    expect(within('group-review', 'body')[0].textContent).toContain(
      'The API runs on it.',
    );
  });

  it('shows both sides of a disagreement and ranks neither', async () => {
    const wide = note({ id: 'wide', scopeType: 'global' });
    const narrow = note({
      id: 'narrow',
      scopeType: 'cluster',
      scopeRef: 'c-1',
      title: 'On prod it is resized',
    });
    await build({
      entries: [narrow, wide],
      delivery: delivery({
        conflicts: [
          { topic: 'master-node-scaling', entryIds: ['wide', 'narrow'] },
        ],
      }),
    });
    const shown = within('conflict', 'title').map((el) => el.textContent?.trim());
    expect(shown).toEqual(['The master is not resized', 'On prod it is resized']);
    expect(text('conflict')).toContain('Neither wins');
  });

  it('keeps the re-reading list when the disagreements cannot be read', async () => {
    await build({
      entries: [note({ id: 'fell', confidence: 'broken', checkedBy: 'probe' })],
      adviceFails: true,
    });
    expect(within('group-review', 'note').length).toBe(1);
    expect(text('conflict-count')).toBe('could not be read');
    expect(text('no-conflicts')).toContain('could not be read');
    expect(find('load-error')).toBeNull();
  });

  it('names a cluster by its name rather than by its id', async () => {
    await build({
      entries: [note({ id: 'n', scopeType: 'cluster', scopeRef: 'c-1' })],
    });
    expect(within('group-holding', 'level')[0].textContent).toContain(
      'cluster prod',
    );
  });

  it('asks both axes at once when a reader focuses on one thing', async () => {
    await build();
    const slug = find('focus-slug') as HTMLInputElement;
    slug.value = 'api';
    slug.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const cluster = find('focus-cluster') as HTMLSelectElement;
    cluster.value = cluster.options[1].value;
    cluster.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    (find('focus-apply') as HTMLButtonElement).click();
    expect(api.list).toHaveBeenCalledWith({ slug: 'api', clusterId: 'c-1' });
  });

  it('offers no way to write during the trial, and says whose job it is', async () => {
    await build({ trial: true });
    expect(find('start-writing')).toBeNull();
    expect(text('read-only-here')).toContain('whoever runs the instance');
  });

  describe('why it used to be done this way', () => {
    const openArchive = async (): Promise<void> => {
      (find('archive-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('reads nothing until somebody asks for it', async () => {
      await build();
      expect(api.retired).not.toHaveBeenCalled();
      expect(find('archive-empty')).toBeNull();
    });

    it('shows the notes that were retired, and when', async () => {
      await build({
        retired: [
          note({
            id: 'gone',
            title: 'We used to pin the master',
            archivedAt: '2026-08-01T09:00:00.000Z',
          }),
        ],
      });
      await openArchive();
      expect(within('group-archive', 'title')[0].textContent).toContain(
        'We used to pin the master',
      );
      expect(within('group-archive', 'retired').length).toBe(1);
    });

    it('offers nothing to change on a note that was withdrawn', async () => {
      await build({
        retired: [note({ id: 'gone', checkedBy: 'attestation' })],
      });
      await openArchive();
      expect(within('group-archive', 'confirm').length).toBe(0);
      expect(within('group-archive', 'reword-start').length).toBe(0);
      expect(within('group-archive', 'archive').length).toBe(0);
    });

    it('follows the same focus as the live list', async () => {
      await build();
      const slug = find('focus-slug') as HTMLInputElement;
      slug.value = 'api';
      slug.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      await openArchive();
      expect(api.retired).toHaveBeenCalledWith({
        slug: 'api',
        clusterId: undefined,
      });
    });

    it('says the archive could not be read without taking the page with it', async () => {
      await build({
        entries: [note({ id: 'holds' })],
        retiredFails: true,
      });
      await openArchive();
      expect(find('archive-error')).not.toBeNull();
      expect(find('load-error')).toBeNull();
      expect(within('group-holding', 'note').length).toBe(1);
    });

    it('is not offered during the trial', async () => {
      await build({ trial: true });
      expect(find('group-archive')).toBeNull();
    });
  });

  it('never speaks the language of permission', async () => {
    await build({
      entries: [
        note({ id: 'fell', confidence: 'broken', checkedBy: 'probe' }),
        note({ id: 'holds' }),
      ],
      delivery: delivery({
        conflicts: [
          { topic: 'master-node-scaling', entryIds: ['fell', 'holds'] },
        ],
      }),
    });
    const words = (
      (fixture.nativeElement as HTMLElement).textContent ?? ''
    ).toLowerCase();
    for (const forbidden of [
      'allowed',
      'denied',
      'blocked',
      'forbidden',
      'unauthorized',
      'not permitted',
      'restrict',
    ]) {
      expect(words).not.toContain(forbidden);
    }
  });
});
