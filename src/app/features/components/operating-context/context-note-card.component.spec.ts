import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContextEntry } from '../../model/operating-context.models';
import { ContextNoteCardComponent } from './context-note-card.component';

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
  ...over,
});

describe('one note, read back', () => {
  let fixture: ComponentFixture<ContextNoteCardComponent>;

  const build = async (
    entry: ContextEntry,
    readOnly = false,
  ): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ContextNoteCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ContextNoteCardComponent);
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  it('offers a signature where a signature is what checks it', async () => {
    await build(note({ checkedBy: 'attestation', confidence: 'stale' }));
    expect(find('confirm')).not.toBeNull();
  });

  it('offers no signature on a note the platform checks', async () => {
    await build(note({ checkedBy: 'probe', confidence: 'broken' }));
    expect(find('confirm')).toBeNull();
  });

  it('offers no signature on a note nothing checks', async () => {
    await build(note({ checkedBy: 'none' }));
    expect(find('confirm')).toBeNull();
  });

  it('says who a note reaches when the delivery carried the line', async () => {
    await build(
      note({
        reaches: {
          audience: 'installation',
          scopeType: 'global',
          scopeRef: null,
          nature: 'practice',
          descends: true,
          reachesGuests: true,
          sentence: 'Everyone who works on this installation reads this.',
        },
      }),
    );
    expect(find('reaches')?.textContent).toContain('Everyone who works');
  });

  it('says nothing about reach when the delivery did not carry it', async () => {
    await build(note());
    expect(find('reaches')).toBeNull();
  });

  it('offers nothing to change during the trial', async () => {
    await build(note({ checkedBy: 'attestation' }), true);
    expect(find('confirm')).toBeNull();
    expect(find('reword-start')).toBeNull();
    expect(find('archive')).toBeNull();
  });

  it('rewords a note without ever moving its level', async () => {
    await build(note());
    const emitted: Array<{ id: string; edit: { title?: string } }> = [];
    fixture.componentInstance.reword.subscribe((e) => emitted.push(e));
    (find('reword-start') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const title = find('reword')?.querySelector('input') as HTMLInputElement;
    title.value = 'Reworded';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (find('reword-save') as HTMLButtonElement).click();
    expect(emitted[0].id).toBe('n-1');
    expect(emitted[0].edit.title).toBe('Reworded');
    expect(Object.keys(emitted[0].edit)).not.toContain('scopeType');
  });

  describe('whose hand is on it', () => {
    it('names the person who wrote it', async () => {
      await build(note({ writtenBy: { name: 'Ada', isYou: false } }));
      expect(find('written-by')?.textContent).toContain('Ada');
    });

    it('says it was you when the API said so', async () => {
      await build(note({ writtenBy: { name: 'Ada', isYou: true } }));
      expect(find('written-by')?.textContent).toContain('you');
    });

    it('names who last put their name to it, separately from who wrote it', async () => {
      await build(
        note({
          writtenBy: { name: 'Ada', isYou: false },
          confirmedBy: { name: 'Grace', isYou: false },
        }),
      );
      expect(find('confirmed-by')?.textContent).toContain('Grace');
    });

    it('says nothing at all when the delivery withheld the hand', async () => {
      await build(note({ writtenBy: null, confirmedBy: null }));
      expect(find('written-by')).toBeNull();
      expect(find('confirmed-by')).toBeNull();
    });

    it('says so plainly when the installation records no name for them', async () => {
      await build(note({ writtenBy: { name: null, isYou: false } }));
      expect(find('written-by')?.textContent).toContain('no name');
    });
  });

  describe('a note that was retired', () => {
    it('says when it was withdrawn', async () => {
      await build(
        note({ archivedAt: '2026-08-01T09:00:00.000Z' }),
        true,
      );
      expect(find('retired')).not.toBeNull();
    });

    it('says nothing of the kind about a note still in force', async () => {
      await build(note({ archivedAt: null }));
      expect(find('retired')).toBeNull();
    });

    it('says who withdrew it, by name and never by id', async () => {
      await build(
        note({
          archivedAt: '2026-08-01T09:00:00.000Z',
          archivedBy: { name: 'Olive Operator', isYou: false },
        }),
        true,
      );
      expect(find('retired-by')?.textContent).toContain('Olive Operator');
    });

    it('says it was yours when it was', async () => {
      await build(
        note({
          archivedAt: '2026-08-01T09:00:00.000Z',
          archivedBy: { name: 'Olive Operator', isYou: true },
        }),
        true,
      );
      expect(find('retired-by')?.textContent).toContain('you');
    });

    it('shows no line at all when there is nobody to name', async () => {
      await build(
        note({ archivedAt: '2026-08-01T09:00:00.000Z', archivedBy: null }),
        true,
      );
      expect(find('retired-by')).toBeNull();
    });
  });

  it('names the resources a selector note is written on', async () => {
    await build(
      note({
        scopeType: 'selector',
        scopeRef: null,
        selector: { slugs: ['api'], clusterId: 'c-1' },
      }),
    );
    expect(find('level')?.textContent).toContain('api');
  });
});
