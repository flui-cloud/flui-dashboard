import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlatformBackupCardComponent } from './platform-backup-card.component';
import { PlatformBackupService, PlatformHeartbeatStatus } from '../../../service/platform-backup.service';
import { BackupService } from '../../../service/backup.service';
import { ToastService } from '../../../../shared/services/toast.service';

describe('the dead-man switch on the platform backup card', () => {
  let fixture: ComponentFixture<PlatformBackupCardComponent>;

  let setPlatformConfig: jasmine.Spy;

  async function mount(heartbeat: PlatformHeartbeatStatus): Promise<void> {
    setPlatformConfig = jasmine.createSpy('setPlatformConfig').and.callFake((_id: string, input: { clearHeartbeat?: boolean }) =>
      Promise.resolve({
        id: 'p1',
        engineClass: 'platform',
        metadata: { platform: { recipient: 'age1abc', heartbeat: input.clearHeartbeat ? undefined : { set: true, host: 'hc-ping.com' } } },
      }),
    );
    await TestBed.configureTestingModule({
      imports: [PlatformBackupCardComponent],
      providers: [
        provideRouter([]),
        {
          provide: PlatformBackupService,
          useValue: {
            listPlatformPolicies: () =>
              Promise.resolve([
                { id: 'p1', engineClass: 'platform', metadata: { platform: { recipient: 'age1abc', heartbeat: { set: true, host: 'hc-ping.com' } } } },
              ]),
            lastPlatformJob: () => Promise.resolve(null),
            heartbeatStatus: () => Promise.resolve(heartbeat),
            setPlatformConfig,
          },
        },
        { provide: BackupService, useValue: { getPolicyActivity: () => Promise.reject(new Error('none')) } },
        { provide: ToastService, useValue: { showError: () => undefined, showSuccess: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlatformBackupCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string =>
    (fixture.nativeElement.querySelector('[data-testid="platform-heartbeat"]') as HTMLElement | null)?.textContent ?? '';

  afterEach(() => TestBed.resetTestingModule());

  it('says the beat is withheld and why', async () => {
    await mount({
      state: 'withheld',
      lastCheckAt: '2026-10-08T10:00:00Z',
      lastBeatAt: null,
      reasons: ['alertmanager has no running copy, so alerts would not be delivered'],
    });
    expect(text()).toContain('Withheld');
    expect(text()).toContain('alertmanager has no running copy');
  });

  it('says it is sending while all is well', async () => {
    await mount({ state: 'beating', lastCheckAt: null, lastBeatAt: new Date().toISOString(), reasons: [] });
    expect(text()).toContain('Sending');
  });

  it('says where the heartbeat goes without showing the address, and stops it on request', async () => {
    await mount({ state: 'beating', lastCheckAt: null, lastBeatAt: new Date().toISOString(), reasons: [] });
    const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    expect(el('platform-heartbeat-set')?.textContent).toContain('hc-ping.com');
    expect((fixture.nativeElement.querySelector('#platform-heartbeat-url') as HTMLInputElement).value).toBe('');

    el('platform-heartbeat-stop')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(setPlatformConfig).toHaveBeenCalledWith('p1', { recipient: 'age1abc', clearHeartbeat: true });
    expect(el('platform-heartbeat-stop')).toBeNull();
  });
});
