import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { SecretsConsoleService } from '../../service/secrets-console.service';
import { SecretReadResult } from '../../model/secrets-console.models';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { SecretsConsoleStateService } from './secrets-console-state.service';

const REAL: SecretReadResult = {
  found: true,
  secret: {
    path: 'db',
    data: { PASSWORD: 'hunter2-real-value' },
    version: 3,
    versions: [{ version: 3, deleted: false, destroyed: false }],
  },
};

const MASKED: SecretReadResult = {
  found: true,
  secret: {
    ...REAL.secret!,
    data: { PASSWORD: '•••• hidden — mask mode is on ••••' },
  },
};

describe('SecretsConsoleStateService — mask mode refetch', () => {
  let service: SecretsConsoleStateService;
  let api: jasmine.SpyObj<SecretsConsoleService>;
  let mask: MaskModeService;

  beforeEach(() => {
    api = jasmine.createSpyObj<SecretsConsoleService>('SecretsConsoleService', [
      'read',
      'getServerInfo',
      'list',
    ]);
    api.read.and.returnValue(of(REAL));

    TestBed.configureTestingModule({
      providers: [
        SecretsConsoleStateService,
        { provide: SecretsConsoleService, useValue: api },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });

    service = TestBed.inject(SecretsConsoleStateService);
    mask = TestBed.inject(MaskModeService);
    service.appId.set('app-1');

    // Consume the effect's guarded first run, so each test below exercises a
    // genuine mask-mode change rather than construction.
    TestBed.tick();
  });

  afterEach(() => {
    try {
      localStorage.removeItem('flui-mask-mode');
    } catch {
      /* noop */
    }
  });

  it('does not refetch anything on construction, before mask mode ever changes', () => {
    expect(api.read).not.toHaveBeenCalled();
  });

  it('holds the real value fetched while mask mode was off', () => {
    service.openSecret('db');

    expect(service.rows()).toEqual([{ key: 'PASSWORD', value: 'hunter2-real-value' }]);
  });

  it('refetches the open secret the moment mask mode turns on, replacing the real value', () => {
    service.openSecret('db');
    expect(api.read).toHaveBeenCalledTimes(1);

    api.read.and.returnValue(of(MASKED));
    mask.setEnabled(true);
    TestBed.tick();

    expect(api.read).toHaveBeenCalledTimes(2);
    expect(service.rows()).toEqual([
      { key: 'PASSWORD', value: '•••• hidden — mask mode is on ••••' },
    ]);
  });

  it('does nothing when no secret is open', () => {
    mask.setEnabled(true);
    TestBed.tick();
    expect(api.read).not.toHaveBeenCalled();
  });

  it('drops an already-revealed row when mask mode turns on, in the same pass that refetches', () => {
    service.openSecret('db');
    service.toggleReveal(0);
    expect(service.isRevealed(0)).toBe(true);

    api.read.and.returnValue(of(MASKED));
    mask.setEnabled(true);
    TestBed.tick();

    expect(service.isRevealed(0)).toBe(false);
  });

  it('does not refetch a brand-new, unsaved secret — there is nothing on the server yet', () => {
    service.startNew();

    mask.setEnabled(true);
    TestBed.tick();

    expect(api.read).not.toHaveBeenCalled();
  });
});
