import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  EntryNature,
  EntryReach,
  WriteContextEntry,
} from '../../model/operating-context.models';
import { OperatingContextService } from '../../service/operating-context.service';
import { ContextNoteFormComponent } from './context-note-form.component';

const reachFor = (
  scopeType: EntryReach['scopeType'],
  nature: EntryNature,
): EntryReach => ({
  audience: scopeType === 'global' ? 'installation' : 'cluster',
  scopeType,
  scopeRef: null,
  nature,
  descends: nature === 'practice',
  reachesGuests: nature === 'practice' && scopeType !== 'selector',
  sentence:
    nature === 'practice'
      ? 'Everyone who works on this installation reads this: every tenant, and the guests of the demonstration.'
      : 'Only a principal whose access covers the whole installation reads this.',
});

describe('writing a note', () => {
  let fixture: ComponentFixture<ContextNoteFormComponent>;
  let api: jasmine.SpyObj<OperatingContextService>;
  let saved: WriteContextEntry[];

  const build = async (
    reach: (
      scopeType: EntryReach['scopeType'],
      nature: EntryNature,
      scopeRef?: string | null,
    ) => ReturnType<OperatingContextService['reach']> = (t, n) =>
      of(reachFor(t, n)),
  ): Promise<void> => {
    api = jasmine.createSpyObj<OperatingContextService>('OperatingContextService', [
      'reach',
    ]);
    api.reach.and.callFake(reach);
    await TestBed.configureTestingModule({
      imports: [ContextNoteFormComponent],
      providers: [{ provide: OperatingContextService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ContextNoteFormComponent);
    saved = [];
    fixture.componentInstance.save.subscribe((body) => saved.push(body));
    await settle();
  };

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const text = (testid: string): string => find(testid)?.textContent?.trim() ?? '';

  const type = async (testid: string, value: string): Promise<void> => {
    const input = find(testid) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const pick = async (testid: string, value: string): Promise<void> => {
    const select = find(testid) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  };

  it('says who the note reaches before anything has been saved', async () => {
    await build();
    expect(api.reach).toHaveBeenCalledWith('global', 'practice', undefined);
    expect(text('reach-sentence')).toContain('every tenant');
    expect(find('reach-guests')).not.toBeNull();
  });

  it('asks again when the nature changes, because that is what reach turns on', async () => {
    await build();
    (find('nature-rationale') as HTMLButtonElement).click();
    await settle();
    expect(api.reach).toHaveBeenCalledWith('global', 'rationale', undefined);
    expect(text('reach-sentence')).toContain('covers the whole installation');
    expect(find('reach-guests')).toBeNull();
  });

  it('does not ask again for a change that cannot move the answer', async () => {
    await build();
    const before = api.reach.calls.count();
    await pick('about-axis', 'apps');
    await type('about-slugs', 'api,worker');
    expect(api.reach.calls.count()).toBe(before + 1);
  });

  it('says who it reaches while the level is still being filled in', async () => {
    await build();
    await pick('about-axis', 'apps');
    expect(api.reach).toHaveBeenCalledWith('selector', 'practice', undefined);
    expect(find('reach-sentence')).not.toBeNull();
  });

  it('says nothing at all while the shape of the level is unknown', async () => {
    await build();
    await pick('where-axis', 'cluster');
    expect(find('reach-sentence')).toBeNull();
    expect(find('reach-pending')).not.toBeNull();
  });

  it('refuses nothing when the line cannot be read', async () => {
    await build(() => throwError(() => new Error('closed')));
    expect(find('reach-error')).not.toBeNull();
    await type('topic', 'backups');
    await type('title', 'A title');
    await type('body', 'A body');
    (find('save') as HTMLButtonElement).click();
    expect(saved.length).toBe(1);
  });

  it('offers no live comparison for a note about the whole installation', async () => {
    await build();
    expect(find('no-probe-here')).not.toBeNull();
    const options = Array.from(
      (find('check-kind') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).not.toContain('probe');
  });

  it('offers it again as soon as the note names something comparable', async () => {
    await build();
    await pick('about-axis', 'apps');
    expect(find('no-probe-here')).toBeNull();
    const options = Array.from(
      (find('check-kind') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toContain('probe');
  });

  it('carries both axes into one selector rather than nesting them', async () => {
    await build();
    await pick('about-axis', 'project');
    await type('about-project', 'payments');
    await pick('where-axis', 'provider');
    await type('where-provider', 'hetzner');
    await type('topic', 'deploys');
    await type('title', 'A title');
    await type('body', 'A body');
    (find('save') as HTMLButtonElement).click();
    expect(saved[0].scopeType).toBe('selector');
    expect(saved[0].selector).toEqual({
      project: 'payments',
      provider: 'hetzner',
    });
  });

  it('will not save a note that has no words', async () => {
    await build();
    expect((find('save') as HTMLButtonElement).disabled).toBe(true);
    await type('topic', 'backups');
    await type('title', 'A title');
    expect((find('save') as HTMLButtonElement).disabled).toBe(true);
    await type('body', 'A body');
    expect((find('save') as HTMLButtonElement).disabled).toBe(false);
  });

  describe('a comparison with nothing to compare against', () => {
    const probed = async (op: string): Promise<void> => {
      await build();
      fixture.componentRef.setInput('probes', [
        { id: 'app.field', describes: 'a field of an application' },
      ]);
      await pick('about-axis', 'apps');
      await type('about-slugs', 'api');
      await type('topic', 'scaling');
      await type('title', 'A title');
      await type('body', 'A body');
      await pick('check-kind', 'probe');
      await pick('probe-id', 'app.field');
      await pick('probe-op', op);
    };

    it('will not send a comparison whose expected value was never written', async () => {
      await probed('equals');
      expect((find('save') as HTMLButtonElement).disabled).toBe(true);
      expect(text('still-needed')).toContain('equals');
    });

    it('sends it the moment the value is there', async () => {
      await probed('equals');
      await type('probe-expected', '3');
      expect((find('save') as HTMLButtonElement).disabled).toBe(false);
      (find('save') as HTMLButtonElement).click();
      expect(saved[0].probeExpected).toBe(3);
    });

    it('asks for no value when the note only says the fact is there', async () => {
      await probed('exists');
      expect((find('save') as HTMLButtonElement).disabled).toBe(false);
      expect(find('still-needed')).toBeNull();
    });

    it('asks which fact before it asks what the fact should say', async () => {
      await build();
      fixture.componentRef.setInput('probes', [
        { id: 'app.field', describes: 'a field of an application' },
      ]);
      await pick('about-axis', 'apps');
      await type('about-slugs', 'api');
      await type('topic', 'scaling');
      await type('title', 'A title');
      await type('body', 'A body');
      await pick('check-kind', 'probe');
      expect(text('still-needed')).toContain('live fact');
    });
  });

  describe('a fact that says what it wants', () => {
    const APP_FIELD = {
      id: 'app.field',
      describes: 'One readable field of an application.',
      takes: [
        { name: 'slug', required: true },
        { name: 'field', required: true, oneOf: ['status', 'replicas'] },
      ],
      answersPer: {
        param: 'field',
        types: { status: 'string', replicas: 'number' },
      },
    };

    const leaning = async (probe: unknown = APP_FIELD): Promise<void> => {
      await build();
      fixture.componentRef.setInput('probes', [probe]);
      await pick('about-axis', 'apps');
      await type('about-slugs', 'api');
      await type('topic', 'scaling');
      await type('title', 'A title');
      await type('body', 'A body');
      await pick('check-kind', 'probe');
      await pick('probe-id', 'app.field');
    };

    it('asks one question per parameter instead of an empty key/value editor', async () => {
      await leaning();
      const asked = fixture.nativeElement.querySelectorAll(
        '[data-testid="declared-param"]',
      );
      expect(asked.length).toBe(2);
      expect(find('param-name')).toBeNull();
      expect(find('add-param')).toBeNull();
      expect(find('param-slug')).not.toBeNull();
      expect(find('param-field')).not.toBeNull();
    });

    it('offers the values the fact accepts, rather than a box to mistype them into', async () => {
      await leaning();
      const options = Array.from(
        (find('param-field') as HTMLSelectElement).options,
      ).map((o) => o.value);
      expect(options).toEqual(['', 'status', 'replicas']);
    });

    it('will not send a note without a parameter the fact published as required', async () => {
      await leaning();
      await pick('param-field', 'status');
      await type('probe-expected', 'running');
      expect((find('save') as HTMLButtonElement).disabled).toBe(true);
      expect(text('still-needed')).toContain('slug');
    });

    it('sends it the moment every published parameter is answered', async () => {
      await leaning();
      await pick('param-field', 'status');
      await type('param-slug', 'api');
      await type('probe-expected', 'running');
      expect((find('save') as HTMLButtonElement).disabled).toBe(false);
      (find('save') as HTMLButtonElement).click();
      expect(saved[0].probeParams).toEqual({ slug: 'api', field: 'status' });
    });

    it('asks for the value in the type the chosen field answers', async () => {
      await leaning();
      await pick('param-field', 'replicas');
      expect((find('probe-expected') as HTMLInputElement).type).toBe('number');
      await pick('param-field', 'status');
      expect((find('probe-expected') as HTMLInputElement).type).toBe('text');
    });

    it('says a comparison could never hold against that field, before the press', async () => {
      await leaning();
      await pick('param-field', 'status');
      await type('param-slug', 'api');
      await pick('probe-op', 'atLeast');
      await type('probe-expected', '3');
      expect((find('save') as HTMLButtonElement).disabled).toBe(true);
      expect(text('still-needed')).toContain('compares numbers');
    });

    it('falls back to naming the parameters by hand when the fact never said', async () => {
      await leaning({ id: 'app.field', describes: 'says nothing' });
      expect(find('undeclared-params')).not.toBeNull();
      expect(find('param-name')).not.toBeNull();
      expect(find('declared-param')).toBeNull();
    });

    it('does not carry one fact’s answers over to another', async () => {
      await leaning();
      await pick('param-field', 'status');
      fixture.componentRef.setInput('probes', [
        APP_FIELD,
        { id: 'other.thing', describes: 'elsewhere', takes: [] },
      ]);
      await settle();
      await pick('probe-id', 'other.thing');
      await pick('probe-id', 'app.field');
      expect((find('param-field') as HTMLSelectElement).value).toBe('');
    });
  });

  it('describes what happens to a mistyped premise as it happens now', async () => {
    await build();
    await pick('about-axis', 'apps');
    await pick('check-kind', 'probe');
    expect(text('premise-hint')).toContain('refused');
    expect(text('premise-hint')).not.toContain('the note would');
  });

  it('never speaks the language of permission', async () => {
    await build();
    const words = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const forbidden of [
      'allowed',
      'denied',
      'blocked',
      'forbidden',
      'unauthorized',
      'restrict',
    ]) {
      expect(words.toLowerCase()).not.toContain(forbidden);
    }
  });
});
