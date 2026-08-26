import {
  ContextEntry,
  ContextProbeOption,
  EMPTY_DRAFT,
  EMPTY_LEVEL,
  EntryDraft,
  LevelDraft,
  Validity,
  PREMISE_HINT,
  conflictGroups,
  describeHand,
  describeScope,
  isSuspect,
  needsReview,
  answerTypeOf,
  declaredParamsOf,
  parseExpected,
  probeAllowedAt,
  probeParamsOf,
  prospectiveScope,
  reachIsWiderThanOwners,
  scopeOfLevel,
  suspectFirst,
  whatIsStillNeeded,
  writeBodyOf,
} from './operating-context.models';

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

const level = (over: Partial<LevelDraft> = {}): LevelDraft => ({
  ...EMPTY_LEVEL,
  ...over,
});

describe('what a note says about its own premise', () => {
  it('calls only a fallen premise suspect', () => {
    expect(isSuspect('broken')).toBe(true);
    expect(isSuspect('stale')).toBe(false);
    expect(isSuspect('unverified')).toBe(false);
    expect(isSuspect('checked')).toBe(false);
  });

  it('asks for a second look at a fallen premise and at a lapsed signature', () => {
    expect(needsReview('broken')).toBe(true);
    expect(needsReview('stale')).toBe(true);
    expect(needsReview('unverified')).toBe(false);
    expect(needsReview('checked')).toBe(false);
  });

  it('puts the fallen premises before the merely unconfirmed', () => {
    const order: Validity[] = ['checked', 'stale', 'broken', 'unverified'];
    const sorted = suspectFirst(
      order.map((confidence, i) => note({ id: `n-${i}`, confidence })),
    );
    expect(sorted.map((e) => e.confidence)).toEqual([
      'broken',
      'stale',
      'unverified',
      'checked',
    ]);
  });

  it('leaves notes of equal standing in the order the API sent them', () => {
    const sorted = suspectFirst([
      note({ id: 'a', confidence: 'stale' }),
      note({ id: 'b', confidence: 'stale' }),
      note({ id: 'c', confidence: 'stale' }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('disagreements, shown and never resolved', () => {
  it('keeps the order the API gave and never ranks by level', () => {
    const platform = note({ id: 'wide', scopeType: 'global' });
    const app = note({
      id: 'narrow',
      scopeType: 'selector',
      topic: 'master-node-scaling',
    });
    const groups = conflictGroups(
      [{ topic: 'master-node-scaling', entryIds: ['wide', 'narrow'] }],
      [app, platform],
    );
    expect(groups.length).toBe(1);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['wide', 'narrow']);
  });

  it('drops a group whose second side is not on the page', () => {
    const groups = conflictGroups(
      [{ topic: 'backups', entryIds: ['here', 'gone'] }],
      [note({ id: 'here', topic: 'backups' })],
    );
    expect(groups).toEqual([]);
  });
});

describe('naming the level of an existing note', () => {
  it('names a cluster by name when the name is known and by id when it is not', () => {
    const on = note({ scopeType: 'cluster', scopeRef: 'c-1' });
    expect(describeScope(on, (id) => (id === 'c-1' ? 'prod' : undefined))).toBe(
      'cluster prod',
    );
    expect(describeScope(on)).toBe('cluster c-1');
  });

  it('names the resources a selector note is written on', () => {
    expect(
      describeScope(
        note({
          scopeType: 'selector',
          selector: { slugs: ['api', 'worker'], provider: 'hetzner' },
        }),
      ),
    ).toBe('applications api, worker, on hetzner');
  });

  it('resolves a cluster in the selector by name, as it does for a cluster note', () => {
    expect(
      describeScope(
        note({ scopeType: 'selector', selector: { clusterId: 'c-1' } }),
        (id) => (id === 'c-1' ? 'prod' : undefined),
      ),
    ).toBe('on cluster prod');
  });

  it('never turns a note pinned to one principal into a note about everything', () => {
    const said = describeScope(
      note({ scopeType: 'selector', selector: null, pinnedToAnOwner: true }),
    );
    expect(said).toBe('owned by one principal');
    expect(said).not.toContain('installation');
  });

  it('says a principal owns it without ever putting their id on the screen', () => {
    expect(
      describeScope(
        note({ scopeType: 'selector', selector: { owner: 'user-9' } }),
      ),
    ).toBe('owned by one principal');
  });

  it('still admits it cannot name a selection the delivery left empty', () => {
    expect(describeScope(note({ scopeType: 'selector' }))).toBe(
      'a selection this delivery does not name',
    );
  });

  it('names the empty region as the whole installation', () => {
    expect(describeScope(note({ scopeType: 'global' }))).toBe(
      'the whole installation',
    );
  });
});

describe('the two axes, which are not a hierarchy', () => {
  it('reads the empty region as global', () => {
    expect(scopeOfLevel(level())).toEqual({ scopeType: 'global' });
  });

  it('reads anything-on-one-cluster as the cluster scope, not a selector', () => {
    expect(scopeOfLevel(level({ where: 'cluster', clusterId: 'c-1' }))).toEqual({
      scopeType: 'cluster',
      scopeRef: 'c-1',
    });
  });

  it('merges the two axes into one selector rather than nesting them', () => {
    const scope = scopeOfLevel(
      level({
        about: 'project',
        project: 'payments',
        where: 'cluster',
        clusterId: 'c-1',
      }),
    );
    expect(scope).toEqual({
      scopeType: 'selector',
      selector: { project: 'payments', clusterId: 'c-1' },
    });
  });

  it('lets an axis be named on its own', () => {
    expect(scopeOfLevel(level({ about: 'apps', slugs: ['api'] }))).toEqual({
      scopeType: 'selector',
      selector: { slugs: ['api'] },
    });
    expect(
      scopeOfLevel(level({ where: 'provider', provider: 'hetzner' })),
    ).toEqual({
      scopeType: 'selector',
      selector: { provider: 'hetzner' },
    });
  });

  it('is not a region while a chosen axis is still empty', () => {
    expect(scopeOfLevel(level({ about: 'apps' }))).toBeNull();
    expect(scopeOfLevel(level({ where: 'cluster' }))).toBeNull();
  });

  it('knows the shape of the level before the details are typed', () => {
    expect(prospectiveScope(level({ about: 'apps' }))).toEqual({
      scopeType: 'selector',
    });
    expect(prospectiveScope(level({ where: 'cluster' }))).toBeNull();
    expect(prospectiveScope(level())).toEqual({ scopeType: 'global' });
  });
});

describe('the value a probe is compared against', () => {
  it('types a number as a number, because the server compares with ===', () => {
    expect(parseExpected('3')).toBe(3);
    expect(parseExpected(' -2.5 ')).toBe(-2.5);
  });

  it('types the two words that are booleans', () => {
    expect(parseExpected('true')).toBe(true);
    expect(parseExpected('false')).toBe(false);
  });

  it('leaves everything else a string, and nothing at all undefined', () => {
    expect(parseExpected('RUNNING')).toBe('RUNNING');
    expect(parseExpected('  ')).toBeUndefined();
  });

  it('reads what each value accessor actually emits, not only a string', () => {
    expect(parseExpected(3)).toBe(3);
    expect(parseExpected(-2.5)).toBe(-2.5);
    expect(parseExpected(true)).toBe(true);
    expect(parseExpected(null)).toBeUndefined();
    expect(parseExpected(undefined)).toBeUndefined();
    expect(parseExpected(Number.NaN)).toBeUndefined();
  });

  it('drops parameter rows that were never named', () => {
    expect(
      probeParamsOf([
        { name: 'slug', value: 'api' },
        { name: '', value: 'ignored' },
      ]),
    ).toEqual({ slug: 'api' });
  });
});

describe('the body of the write', () => {
  it('sends nothing about a check nobody asked for', () => {
    const body = writeBodyOf({
      ...EMPTY_DRAFT,
      topic: 'backups',
      title: 'T',
      body: 'B',
    });
    expect(body).toEqual({
      scopeType: 'global',
      nature: 'practice',
      topic: 'backups',
      title: 'T',
      body: 'B',
      checkKind: 'none',
    });
  });

  it('sends the probe with a typed expected value', () => {
    const body = writeBodyOf({
      ...EMPTY_DRAFT,
      level: level({ where: 'cluster', clusterId: 'c-1' }),
      topic: 'nodes',
      title: 'T',
      body: 'B',
      checkKind: 'probe',
      probeId: 'cluster.field',
      probeParams: { clusterId: 'c-1', field: 'nodeCount' },
      probeOp: 'atLeast',
      probeExpected: '3',
    });
    expect(body?.scopeRef).toBe('c-1');
    expect(body?.probeExpected).toBe(3);
    expect(body?.probeParams).toEqual({ clusterId: 'c-1', field: 'nodeCount' });
  });

  it('sends no expected value for a comparison that takes none', () => {
    const body = writeBodyOf({
      ...EMPTY_DRAFT,
      level: level({ where: 'cluster', clusterId: 'c-1' }),
      topic: 'nodes',
      title: 'T',
      body: 'B',
      checkKind: 'probe',
      probeId: 'cluster.field',
      probeOp: 'exists',
      probeExpected: '3',
    });
    expect('probeExpected' in (body ?? {})).toBe(false);
  });

  it('sends the shelf life only for a signature', () => {
    const attested = writeBodyOf({
      ...EMPTY_DRAFT,
      topic: 't',
      title: 'T',
      body: 'B',
      checkKind: 'attestation',
      validForDays: 30,
    });
    expect(attested?.validForDays).toBe(30);
    expect(
      writeBodyOf({ ...EMPTY_DRAFT, topic: 't', title: 'T', body: 'B' })
        ?.validForDays,
    ).toBeUndefined();
  });

  it('refuses to build a body while the level is not yet a region', () => {
    expect(
      writeBodyOf({
        ...EMPTY_DRAFT,
        level: level({ about: 'apps' }),
        topic: 't',
        title: 'T',
        body: 'B',
      }),
    ).toBeNull();
  });
});

describe('the two rules the screen restates', () => {
  it('offers no live comparison for a note about the whole installation', () => {
    expect(probeAllowedAt('global')).toBe(false);
    expect(probeAllowedAt('cluster')).toBe(true);
    expect(probeAllowedAt('selector')).toBe(true);
  });

  it('emphasises the reach line only where it reaches past the owners', () => {
    const reach = (descends: boolean) => ({
      audience: 'installation' as const,
      scopeType: 'global' as const,
      scopeRef: null,
      nature: descends ? ('practice' as const) : ('rationale' as const),
      descends,
      reachesGuests: descends,
      sentence: 's',
    });
    expect(reachIsWiderThanOwners(reach(true))).toBe(true);
    expect(reachIsWiderThanOwners(reach(false))).toBe(false);
  });
});

describe('whose hand is on a note', () => {
  it('says nothing at all when the API told this reader nothing', () => {
    expect(describeHand(null)).toBeNull();
    expect(describeHand(undefined)).toBeNull();
  });

  it('says it was you, because that is the one thing worth knowing about your own', () => {
    expect(describeHand({ name: 'Ada', isYou: true })).toBe('you');
  });

  it('names the person otherwise', () => {
    expect(describeHand({ name: 'Ada', isYou: false })).toBe('Ada');
  });

  it('says so plainly when this installation records no name for them', () => {
    expect(describeHand({ name: null, isYou: false })).toBe(
      'someone this installation records no name for',
    );
  });
});

describe('what a note does not yet say', () => {
  const drafted = (over: Partial<EntryDraft> = {}): EntryDraft => ({
    ...EMPTY_DRAFT,
    level: { ...EMPTY_LEVEL, about: 'apps', slugs: ['api'] },
    topic: 'scaling',
    title: 'A title',
    body: 'A body',
    ...over,
  });

  it('finds nothing missing on a complete note', () => {
    expect(whatIsStillNeeded(writeBodyOf(drafted()))).toBeNull();
  });

  it('asks for the value a comparison compares with', () => {
    const body = writeBodyOf(
      drafted({ checkKind: 'probe', probeId: 'app.field', probeOp: 'equals' }),
    );
    expect(whatIsStillNeeded(body)).toContain('equals');
    expect(whatIsStillNeeded(body)).toContain('exists');
  });

  it('asks for nothing to compare with when the note only says the fact is there', () => {
    expect(
      whatIsStillNeeded(
        writeBodyOf(
          drafted({
            checkKind: 'probe',
            probeId: 'app.field',
            probeOp: 'exists',
          }),
        ),
      ),
    ).toBeNull();
  });

  it('asks which fact, before asking what it should say', () => {
    expect(
      whatIsStillNeeded(
        writeBodyOf(drafted({ checkKind: 'probe', probeOp: 'equals' })),
      ),
    ).toContain('live fact');
  });

  it('asks for the words when there are none', () => {
    expect(whatIsStillNeeded(writeBodyOf(drafted({ body: '' })))).toContain(
      'note itself',
    );
  });

  it('asks for the level when an axis the author picked is still empty', () => {
    expect(
      whatIsStillNeeded(
        writeBodyOf(drafted({ level: { ...EMPTY_LEVEL, about: 'apps' } })),
      ),
    ).toContain('level');
  });

  it('never says anybody is not permitted anything', () => {
    const said = [
      whatIsStillNeeded(null),
      whatIsStillNeeded(writeBodyOf(drafted({ body: '' }))),
      whatIsStillNeeded(
        writeBodyOf(
          drafted({
            checkKind: 'probe',
            probeId: 'app.field',
            probeOp: 'atLeast',
          }),
        ),
      ),
    ].join(' ');
    for (const forbidden of [
      'allowed',
      'denied',
      'blocked',
      'forbidden',
      'unauthorized',
      'restrict',
    ]) {
      expect(said.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('the words under the expected value', () => {
  it('no longer describes a mistyped premise as something that gets saved', () => {
    expect(PREMISE_HINT).not.toContain('the note would');
    expect(PREMISE_HINT).toContain('refused');
  });
});

describe('the fact a note leans on', () => {
  const appField: ContextProbeOption = {
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

  const drafted = (over: Partial<EntryDraft> = {}): EntryDraft => ({
    ...EMPTY_DRAFT,
    level: { ...EMPTY_LEVEL, about: 'apps', slugs: ['api'] },
    topic: 'scaling',
    title: 'A title',
    body: 'A body',
    checkKind: 'probe',
    probeId: 'app.field',
    probeOp: 'equals',
    probeExpected: 'running',
    ...over,
  });

  it('asks for a parameter the probe published as required', () => {
    const body = writeBodyOf(drafted({ probeParams: { field: 'status' } }));
    expect(whatIsStillNeeded(body, appField)).toContain('slug');
  });

  it('finds nothing missing once every published parameter is answered', () => {
    const body = writeBodyOf(
      drafted({ probeParams: { slug: 'api', field: 'status' } }),
    );
    expect(whatIsStillNeeded(body, appField)).toBeNull();
  });

  it('claims nothing is missing when the catalogue said nothing', () => {
    const body = writeBodyOf(drafted({ probeParams: {} }));
    expect(whatIsStillNeeded(body)).toBeNull();
  });

  it('reads the type of the field that was actually chosen', () => {
    expect(answerTypeOf(appField, { field: 'replicas' })).toBe('number');
    expect(answerTypeOf(appField, { field: 'status' })).toBe('string');
    expect(answerTypeOf(appField, {})).toBeUndefined();
  });

  it('takes a single published type whatever the parameters are', () => {
    expect(
      answerTypeOf(
        { id: 'cluster.appCount', describes: 'x', answers: 'number' },
        {},
      ),
    ).toBe('number');
  });

  it('says so when the comparison could never hold against that field', () => {
    const body = writeBodyOf(
      drafted({
        probeParams: { slug: 'api', field: 'status' },
        probeOp: 'atLeast',
        probeExpected: '3',
      }),
    );
    expect(whatIsStillNeeded(body, appField)).toContain('compares numbers');
  });

  it('is content with the same comparison against a field that answers a number', () => {
    const body = writeBodyOf(
      drafted({
        probeParams: { slug: 'api', field: 'replicas' },
        probeOp: 'atLeast',
        probeExpected: '3',
      }),
    );
    expect(whatIsStillNeeded(body, appField)).toBeNull();
  });

  it('never says anybody is not permitted anything', () => {
    const said = [
      whatIsStillNeeded(writeBodyOf(drafted({ probeParams: {} })), appField),
      whatIsStillNeeded(
        writeBodyOf(
          drafted({
            probeParams: { slug: 'api', field: 'status' },
            probeOp: 'atMost',
          }),
        ),
        appField,
      ),
    ];
    for (const sentence of said) {
      expect(sentence).not.toBeNull();
      expect(sentence?.toLowerCase()).not.toContain('allowed');
      expect(sentence?.toLowerCase()).not.toContain('permitted');
      expect(sentence?.toLowerCase()).not.toContain('cannot save');
    }
  });

  it('sends only the parameters the probe published, and drops the empty ones', () => {
    expect(
      declaredParamsOf(
        { slug: 'api', field: '', clusterId: 'left over' },
        appField.takes ?? [],
      ),
    ).toEqual({ slug: 'api' });
  });
});

describe('the hand on a retired note', () => {
  it('is read on the same terms as the other two', () => {
    expect(describeHand({ name: 'Olive Operator', isYou: false })).toBe(
      'Olive Operator',
    );
    expect(describeHand(null)).toBeNull();
  });

  it('is absent, and not blank, on a note retired before it was recorded', () => {
    expect(describeHand(note({ archivedBy: null }).archivedBy)).toBeNull();
  });
});
