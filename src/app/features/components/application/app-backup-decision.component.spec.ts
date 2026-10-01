import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BackupsService } from '../../../core/api/api/backups.service';
import type { AppCoverageRow } from '../../service/fleet.service';
import { AppBackupDecisionComponent } from './app-backup-decision.component';
import type { DecisionSource } from './app-backup-decision';

const coverage = (over: Partial<AppCoverageRow> = {}): AppCoverageRow => ({
  applicationId: 'a-1',
  name: 'pg-bgs-pitr',
  slug: 'postgresql-c653b7-qsx6du',
  kind: 'DATABASE',
  category: 'user',
  clusterId: 'c-1',
  clusterName: 'wc-2',
  holdsData: true,
  dataReasons: ['database'],
  coverage: 'unprotected',
  reason: 'no_policy',
  alarm: true,
  policy: null,
  coveringPolicies: 0,
  lastSuccessAt: null,
  protectedUntil: null,
  protectPath: null,
  pending: { outcome: 'waiting', reason: 'the database is not running yet', at: '', protectHelps: false },
  decision: null,
  ...over,
});

describe('AppBackupDecisionComponent', () => {
  let fixture: ComponentFixture<AppBackupDecisionComponent>;
  let api: { appProtectionControllerSetBackupDecision: jasmine.Spy };

  const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(async () => {
    api = { appProtectionControllerSetBackupDecision: jasmine.createSpy('set').and.returnValue(of({})) };
    await TestBed.configureTestingModule({
      imports: [AppBackupDecisionComponent],
      providers: [provideRouter([]), { provide: BackupsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AppBackupDecisionComponent);
    fixture.componentRef.setInput('appId', 'a-1');
  });

  const show = (source: DecisionSource) => {
    fixture.componentRef.setInput('protection', source);
    fixture.detectChanges();
  };

  it('says why the app is not protected and offers no Protect that would not help', () => {
    show({ coverage: coverage(), policies: [] });
    expect(q('backup-decision-why')!.textContent).toContain('The database is not running yet.');
    expect(q('backup-decision-protect')).toBeNull();
    expect(q('backup-decision-skip')).not.toBeNull();
  });

  it('asks for the protection below when protecting would help', () => {
    let asked = 0;
    fixture.componentInstance.protect.subscribe(() => asked++);
    show({ coverage: coverage({ pending: null, protectPath: '/management/backup/policies/new?x=1' }), policies: [] });
    q('backup-decision-protect')!.click();
    expect(asked).toBe(1);
  });

  it('confirms with an optional note, then stores the decision', async () => {
    let changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    show({ coverage: coverage(), policies: [] });
    q('backup-decision-skip')!.click();
    fixture.detectChanges();
    const input = q('backup-decision-confirm')!.querySelector('input')!;
    input.value = '  scratch copy  ';
    input.dispatchEvent(new Event('input'));
    q('backup-decision-confirm-skip')!.click();
    await fixture.whenStable();
    expect(api.appProtectionControllerSetBackupDecision).toHaveBeenCalledWith('a-1', {
      notBackedUp: true,
      note: 'scratch copy',
    });
    expect(changed).toBe(1);
  });

  it('shows the decision and backs the app up again on request', async () => {
    show({
      coverage: coverage({
        coverage: 'not_backed_up_by_choice',
        reason: 'not_backed_up_by_choice',
        pending: null,
        decision: {
          notBackedUp: true,
          note: 'scratch copy',
          decidedBy: 'u-1',
          decidedByName: 'Dawit',
          decidedAt: '2026-10-01T09:12:00.000Z',
        },
      }),
      policies: [{ policyId: 'p-1', name: 'pg-continuous', enabled: true }],
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Not backed up by choice');
    expect(q('backup-decision-note')!.textContent).toContain('scratch copy');
    expect(text).toContain('Dawit · 1 Oct 2026');
    expect(q('backup-decision-running')!.querySelector('a')!.getAttribute('href')).toBe('/management/backup/policies/p-1');
    q('backup-decision-undo')!.click();
    await fixture.whenStable();
    expect(api.appProtectionControllerSetBackupDecision).toHaveBeenCalledWith('a-1', { notBackedUp: false });
  });

  it('says so when the decision could not be saved', async () => {
    api.appProtectionControllerSetBackupDecision.and.returnValue(throwError(() => ({ error: { message: 'Refused' } })));
    show({ coverage: coverage(), policies: [] });
    q('backup-decision-skip')!.click();
    fixture.detectChanges();
    q('backup-decision-confirm-skip')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Refused');
  });

  it('shows nothing for a protected app', () => {
    show({ coverage: coverage({ coverage: 'protected' }), policies: [] });
    expect(q('backup-decision')).toBeNull();
  });
});
