import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivityTabComponent } from './activity-tab.component';
import { AuditService } from '../../service/audit.service';

describe('ActivityTabComponent', () => {
  let fixture: ComponentFixture<ActivityTabComponent>;
  let list: jasmine.Spy;

  beforeEach(async () => {
    list = jasmine.createSpy('list').and.returnValue(
      of([
        {
          id: 'e1',
          at: new Date().toISOString(),
          userId: null,
          email: null,
          actorKind: 'system',
          actorKeyId: null,
          action: 'ssh certificate issued',
          target: null,
          status: null,
          outcome: 'ok',
          permission: null,
          dataAccess: false,
        },
        {
          id: 'e2',
          at: new Date().toISOString(),
          userId: 'u1',
          email: 'bot@acme.com',
          actorKind: 'agent',
          actorKeyId: 'k1',
          action: 'GET /applications/:id/env',
          target: { id: 'a1' },
          status: 403,
          outcome: 'refused',
          permission: 'data:access',
          dataAccess: true,
        },
      ]),
    );
    await TestBed.configureTestingModule({
      imports: [ActivityTabComponent],
      providers: [{ provide: AuditService, useValue: { list } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivityTabComponent);
    fixture.detectChanges();
  });

  const last = () => list.calls.mostRecent().args[0];
  const text = () => fixture.nativeElement.textContent as string;

  const setInput = (id: string, value: string) => {
    const el = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const button = (label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    );

  const tick = (id: string) => {
    (fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement).click();
    fixture.detectChanges();
  };

  it('loads the last 7 days by default, with no other filter', () => {
    expect(last()).toEqual({
      email: undefined,
      period: '7d',
      dataAccessOnly: false,
      refusedOnly: false,
      before: undefined,
      limit: 51,
    });
  });

  it('builds the query from the filters', () => {
    setInput('act-person', 'bob@acme.com');
    setInput('act-period', '24h');
    tick('act-data');
    tick('act-refused');
    expect(last()).toEqual({
      email: 'bob@acme.com',
      period: '24h',
      dataAccessOnly: true,
      refusedOnly: true,
      before: undefined,
      limit: 51,
    });
  });

  it('does not query for a partial email', () => {
    const calls = list.calls.count();
    setInput('act-person', 'bob@');
    expect(list.calls.count()).toBe(calls);
    expect(text()).toContain('Enter a full email address.');
  });

  it('names the platform, badges keys and agents, and marks data access', () => {
    expect(text()).toContain('platform');
    expect(text()).toContain('agent');
    expect(text()).toContain('id=a1');
    expect(text()).toContain('refused');
    expect(text()).toContain('data');
  });

  it('shows no page controls when everything fits on one page', () => {
    expect(button('Older')).toBeUndefined();
    expect(button('Newer')).toBeUndefined();
  });

  describe('when there are more records than one page', () => {
    const rows = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `r${from + i}`,
        at: new Date().toISOString(),
        userId: null,
        email: null,
        actorKind: 'system',
        actorKeyId: null,
        action: 'ssh certificate issued',
        target: null,
        status: null,
        outcome: 'ok',
        permission: null,
        dataAccess: false,
      }));

    beforeEach(() => {
      list.and.callFake((f: { before?: string }) =>
        of(f.before === 'r50' ? rows(51, 10) : rows(1, 51)),
      );
      fixture.componentInstance.reload();
      fixture.detectChanges();
    });

    it('shows one page and asks the server for the next one after its last record', () => {
      expect(text()).toContain('1–50');
      expect(button('Newer')!.disabled).toBeTrue();
      button('Older')!.click();
      fixture.detectChanges();
      expect(last().before).toBe('r50');
      expect(text()).toContain('51–60');
      expect(button('Older')!.disabled).toBeTrue();
    });

    it('goes back to the newer page', () => {
      button('Older')!.click();
      fixture.detectChanges();
      button('Newer')!.click();
      fixture.detectChanges();
      expect(last().before).toBeUndefined();
      expect(text()).toContain('1–50');
    });

    it('starts again from the newest records when a filter changes', () => {
      button('Older')!.click();
      fixture.detectChanges();
      tick('act-refused');
      expect(last().before).toBeUndefined();
      expect(last().refusedOnly).toBeTrue();
    });
  });

  it('keeps the explanation behind a button', () => {
    expect(text()).not.toContain('Every change, every refused request');
    const info = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes('What is recorded'),
    )!;
    info.click();
    fixture.detectChanges();
    expect(text()).toContain('Every change, every refused request');
  });
});
