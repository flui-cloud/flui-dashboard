import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  PlatformUpdateService,
  PlatformUpdateStatus,
  PlatformUpgradePlan,
} from '../../service/platform-update.service';
import { PlatformUpgradeConfirmComponent } from './platform-upgrade-confirm.component';

const plan = (
  blockers: PlatformUpgradePlan['blockers'],
): PlatformUpgradePlan => ({
  planId: 'p1',
  fromVersion: '0.19.0',
  targetVersion: '0.20.0',
  bootstrapRef: 'abc',
  k3sVersion: null,
  migrations: 0,
  phases: [],
  advisories: [],
  blockers,
  applicable: true,
  acknowledgement: 'Without a backup, a database migration cannot be undone.',
});

const status = {
  installedVersion: '0.19.0',
  availableVersion: '0.20.0',
  updateAvailable: true,
  applicable: true,
  migrations: 0,
  advisories: [],
} as unknown as PlatformUpdateStatus;

describe('PlatformUpgradeConfirmComponent', () => {
  let fixture: ComponentFixture<PlatformUpgradeConfirmComponent>;
  let start: jasmine.Spy;
  const planData = signal<PlatformUpgradePlan | null>(null);

  const startButton = (): HTMLButtonElement =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Start update'),
    )!;

  beforeEach(() => {
    start = jasmine.createSpy('start').and.resolveTo(undefined);
    planData.set(null);
    TestBed.configureTestingModule({
      imports: [PlatformUpgradeConfirmComponent],
      providers: [
        {
          provide: PlatformUpdateService,
          useValue: {
            status: signal(status),
            plan$: planData,
            planning: signal(false),
            starting: signal(false),
            error: signal(null),
            availableVersion: signal('0.20.0'),
            start,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PlatformUpgradeConfirmComponent);
  });

  it('keeps the start button disabled until a missing backup is acknowledged', () => {
    planData.set(
      plan([{ phase: 'backup', message: 'No backup.', overridable: true }]),
    );
    fixture.detectChanges();
    expect(startButton().disabled).toBeTrue();

    const box = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=checkbox]',
    ) as HTMLInputElement;
    box.click();
    fixture.detectChanges();
    expect(startButton().disabled).toBeFalse();
  });

  it('starts the planned update without a backup and closes', async () => {
    planData.set(
      plan([{ phase: 'backup', message: 'No backup.', overridable: true }]),
    );
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    fixture.detectChanges();
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        'input[type=checkbox]',
      ) as HTMLInputElement
    ).click();
    fixture.detectChanges();
    startButton().click();
    await fixture.whenStable();
    expect(start).toHaveBeenCalledWith('0.20.0', {
      planId: 'p1',
      withoutBackup: true,
    });
    expect(closed).toBeTrue();
  });

  it('never enables start while a hard blocker stands', () => {
    planData.set(
      plan([{ phase: 'k3s', message: 'Node down.', overridable: false }]),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Node down.');
    expect(startButton().disabled).toBeTrue();
  });
});
