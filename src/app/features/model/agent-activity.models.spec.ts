import {
  actorRef,
  identityNamesByAccount,
  namedActor,
  operationNote,
  underLabel,
} from './agent-activity.models';

describe('whose activity this is', () => {
  it('is the credential, whenever there is one', () => {
    expect(actorRef({ actorKeyId: 'k-1', userId: 'u-1' })).toBe('key:k-1');
  });

  it('keeps two credentials of one person apart', () => {
    const one = actorRef({ actorKeyId: 'k-1', userId: 'u-1' });
    const two = actorRef({ actorKeyId: 'k-2', userId: 'u-1' });
    expect(one).not.toBe(two);
  });

  it('falls to the account only when no credential can exist', () => {
    expect(actorRef({ actorKeyId: null, userId: 'u-bot' })).toBe(
      'account:u-bot',
    );
  });

  describe('the identity directory, indexed the only way it joins', () => {
    it('is keyed by the local account and never by the provider id', () => {
      const index = identityNamesByAccount([
        {
          userId: 'idp-77',
          userName: 'flui-agent-release',
          name: 'release-bot',
          fluiUserId: 'u-bot',
        },
      ]);
      expect(index).toEqual({ 'u-bot': 'release-bot' });
      expect(index['idp-77']).toBeUndefined();
    });

    it('leaves out an identity that has never authenticated', () => {
      expect(
        identityNamesByAccount([
          { userId: 'idp-9', userName: 'never-arrived', fluiUserId: null },
        ]),
      ).toEqual({});
    });

    it('falls back to the provider username when no name was given', () => {
      expect(
        identityNamesByAccount([
          { userId: 'idp-1', userName: 'flui-agent-x', fluiUserId: 'u-x' },
        ]),
      ).toEqual({ 'u-x': 'flui-agent-x' });
    });
  });

  describe('the name, in one place', () => {
    const row = { actorKeyId: 'k-1', actorKeyName: 'from-register', userId: 'u-1' };

    it('prefers what the register itself resolved', () => {
      expect(namedActor(row, { 'k-1': 'from-directory' }, {})).toBe(
        'from-register',
      );
    });

    it('returns nothing rather than inventing a name', () => {
      expect(
        namedActor({ actorKeyId: 'k-9', actorKeyName: null, userId: 'u-1' }, {}, {}),
      ).toBeNull();
    });

    it('never reaches the account index while a key is named', () => {
      expect(namedActor(row, {}, { 'u-1': 'wrong' })).toBe('from-register');
    });
  });
});

describe('under which permission a row happened', () => {
  const row = {
    allowed: true,
    outcome: null as string | null,
    under: null as 'concession' | 'approval' | null,
    underSentence: null as string | null,
  };

  it('names a standing grant with the words that were read', () => {
    const label = underLabel({ ...row, under: 'concession', underSentence: 'add nodes' });
    expect(label.tone).toBe('standing');
    expect(label.detail).toBe('add nodes');
  });

  it("says the kind without the wording when the wording is not the reader's", () => {
    const label = underLabel({ ...row, under: 'concession' });
    expect(label.text).toBe('standing grant');
    expect(label.detail).toContain('belongs to');
  });

  it('reads a refusal first, even with a permission stamped beside it', () => {
    expect(underLabel({ ...row, allowed: false, under: 'approval' }).tone).toBe(
      'refused',
    );
  });

  it('reads a pause before a permission, because it was not answered yet', () => {
    expect(
      underLabel({ ...row, outcome: 'input_required', under: 'concession' }).tone,
    ).toBe('asked');
  });

  it('calls a missing trace a missing trace', () => {
    const label = underLabel(row);
    expect(label.text).toBe('not traced');
    expect(label.detail).toContain('Allowed');
  });
});

describe('the operation clause', () => {
  const op = {
    id: '4c1f0000-0000-4000-8000-000000000000',
    operationType: null,
    status: 'SUCCEEDED',
    progress: 100,
    resourceType: null,
    resourceName: 'umami',
    resourceId: null,
    currentStep: null,
    startedAt: null,
    completedAt: null,
    cancelRequestedAt: null,
    grantId: null,
  };

  it('names the operation short, as the design writes it', () => {
    expect(operationNote({ operation: op, operationId: op.id })).toBe(
      'operation 4c1f, succeeded',
    );
  });

  it('keeps the two silences apart', () => {
    expect(operationNote({ operation: null, operationId: 'op-9' })).toBe(
      'started something you cannot read',
    );
    expect(operationNote({ operation: null, operationId: null })).toBeNull();
  });
});
