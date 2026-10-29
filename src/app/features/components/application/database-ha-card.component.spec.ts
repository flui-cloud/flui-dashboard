import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationResponseDto } from '../../../core/api';
import { DatabaseHaView, DbHaService } from '../../service/db-ha.service';
import { DatabaseHaCardComponent } from './database-ha-card.component';

const postgres = {
  id: 'db-1',
  labels: {
    'flui.cloud/app-type': 'building-block',
    'flui.cloud/db-engine': 'postgres',
  },
} as unknown as ApplicationResponseDto;

const view = (state: DatabaseHaView['state']): DatabaseHaView => ({
  appId: 'db-1',
  highlyAvailable: state?.state === 'active',
  state,
});

const ha = (s: 'copying' | 'active' | 'failed', detail?: string) => ({
  cluster: 'db-1-ha',
  durability: 'required' as const,
  instances: 3,
  state: s,
  since: '2026-10-28T17:25:00Z',
  ...(detail ? { detail } : {}),
});

describe('DatabaseHaCardComponent', () => {
  let fixture: ComponentFixture<DatabaseHaCardComponent>;
  let get: jasmine.Spy;
  let enable: jasmine.Spy;

  function render(app: ApplicationResponseDto, current: DatabaseHaView) {
    get = jasmine.createSpy('get').and.returnValue(of(current));
    enable = jasmine
      .createSpy('enable')
      .and.returnValue(of({ operationId: 'op-1' }));
    TestBed.configureTestingModule({
      imports: [DatabaseHaCardComponent],
      providers: [{ provide: DbHaService, useValue: { get, enable } }],
    });
    fixture = TestBed.createComponent(DatabaseHaCardComponent);
    fixture.componentRef.setInput('app', app);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers to make a single Postgres highly available', () => {
    const el = render(postgres, view(null));
    expect(el.textContent).toContain('Single instance');
    expect(el.textContent).toContain('Make highly available');
    expect(fixture.componentInstance.active()).toBeFalse();
  });

  it('says how many copies protect it once active, and offers nothing', () => {
    const el = render(postgres, view(ha('active')));
    expect(el.textContent).toContain(
      'Highly available: 3 instances, one per location',
    );
    expect(el.textContent).not.toContain('Make highly available');
    expect(fixture.componentInstance.active()).toBeTrue();
  });

  it('says where the primary is and how far behind each copy is', () => {
    const el = render(postgres, {
      ...view(ha('active')),
      placement: {
        readAt: '2026-10-29T10:00:00Z',
        primary: {
          instance: 'db-1-ha-1',
          node: 'm',
          zone: 'fsn1',
          ready: true,
        },
        copies: [
          {
            instance: 'db-1-ha-2',
            node: 'w1',
            zone: 'nbg1',
            ready: true,
            confirms: true,
            flushLagMs: 3.1,
            replayLagMs: 3.4,
          },
          {
            instance: 'db-1-ha-3',
            node: 'w3',
            zone: 'hel1',
            ready: false,
            confirms: false,
            flushLagMs: null,
            replayLagMs: null,
          },
        ],
      },
    });
    expect(
      el.querySelector('[data-testid="database-ha-placement"]')!.textContent,
    ).toContain('Primary in fsn1. Copies: nbg1 3.1 ms behind, hel1 not ready.');
  });

  it('shows why the last attempt stopped, and lets it be tried again', () => {
    const el = render(
      postgres,
      view(ha('failed', 'The copy did not catch up in time')),
    );
    expect(el.textContent).toContain('The copy did not catch up in time');
    expect(el.textContent).toContain('Make highly available');
  });

  it('shows nothing and asks nothing for a database that is not Postgres', () => {
    const redis = {
      id: 'r-1',
      labels: {
        'flui.cloud/app-type': 'building-block',
        'flui.cloud/db-engine': 'redis',
      },
    } as unknown as ApplicationResponseDto;
    const el = render(redis, view(null));
    expect(el.textContent?.trim()).toBe('');
    expect(get).not.toHaveBeenCalled();
  });

  it('asks for no confirmed write lost', () => {
    render(postgres, view(null));
    fixture.componentInstance.enable();
    expect(enable).toHaveBeenCalledWith('db-1');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
