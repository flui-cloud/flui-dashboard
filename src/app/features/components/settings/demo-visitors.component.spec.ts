import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SandboxSignInService, VisitorStats } from '../../service/sandbox-sign-in.service';
import { DemoVisitorsComponent, refusalLabel } from './demo-visitors.component';

const STATS: VisitorStats = {
  entranceOpen: true,
  visitorsNow: 7,
  poolReady: 2,
  poolMin: 3,
  upgraded: 4,
  merged: 1,
  last24h: {
    created: 20,
    refused: 5,
    refusedByReason: [
      { reason: 'limit-ip', count: 3 },
      { reason: 'challenge', count: 2 },
      { reason: 'closed', count: 0 },
    ],
  },
};

describe('DemoVisitorsComponent', () => {
  const build = (visitorStats: jasmine.Spy) => {
    TestBed.configureTestingModule({
      imports: [DemoVisitorsComponent],
      providers: [{ provide: SandboxSignInService, useValue: { visitorStats } }],
    });
    const fixture = TestBed.createComponent(DemoVisitorsComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const tile = (el: HTMLElement, label: string) =>
    el.querySelector(`[data-tile="${label}"]`)?.textContent ?? '';

  it('shows the entrance, the counts and the pool', () => {
    const el = build(jasmine.createSpy('visitorStats').and.returnValue(of(STATS)));
    expect(el.querySelector('[data-testid="entrance"]')?.textContent).toContain('Entrance open');
    expect(tile(el, 'Visitors now')).toContain('7');
    expect(tile(el, 'Ready ahead of time')).toContain('2 / 3');
    expect(tile(el, 'New in 24 h')).toContain('20');
    expect(tile(el, 'Refused in 24 h')).toContain('5');
    expect(tile(el, 'Became accounts')).toContain('4');
    expect(tile(el, 'Added to accounts')).toContain('1');
  });

  it('lists only the reasons that happened, in plain words', () => {
    const el = build(jasmine.createSpy('visitorStats').and.returnValue(of(STATS)));
    const line = el.querySelector('[data-testid="refused-reasons"]')?.textContent ?? '';
    expect(line).toContain('Per-address limit 3');
    expect(line).toContain('Browser check failed 2');
    expect(line).not.toContain('Entrance closed');
  });

  it('says when the entrance is closed', () => {
    const el = build(
      jasmine.createSpy('visitorStats').and.returnValue(of({ ...STATS, entranceOpen: false })),
    );
    expect(el.querySelector('[data-testid="entrance"]')?.textContent).toContain('Entrance closed');
  });

  it('stays hidden when the API fails', () => {
    const el = build(jasmine.createSpy('visitorStats').and.returnValue(throwError(() => new Error('x'))));
    expect(el.querySelector('[data-testid="demo-visitors"]')).toBeNull();
  });

  it('keeps an unknown reason readable', () => {
    expect(refusalLabel('something-new')).toBe('something-new');
  });
});
