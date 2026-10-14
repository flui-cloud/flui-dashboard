import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PermissionService } from '../../../core/services/permission.service';
import { InferenceSettingsService } from '../../service/inference-settings.service';
import { InferenceUsageComponent } from './inference-usage.component';

describe('InferenceUsageComponent', () => {
  const build = (granted: boolean, usage: jasmine.Spy) => {
    TestBed.configureTestingModule({
      imports: [InferenceUsageComponent],
      providers: [
        { provide: InferenceSettingsService, useValue: { usage } },
        {
          provide: PermissionService,
          useValue: { isAdmin: signal(false), can: (k: string) => granted && k === 'integration:manage' },
        },
      ],
    });
    const fixture = TestBed.createComponent(InferenceUsageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows tokens and calls per kind for the last 7 days', () => {
    const usage = jasmine.createSpy('usage').and.returnValue(
      of({
        since: null,
        byModel: [],
        byPerson: [],
        byKind: [
          { kind: 'visitor', people: 3, calls: 12, tokens: 45200 },
          { kind: 'person', people: 1, calls: 4, tokens: 900 },
        ],
      }),
    );
    const el = build(true, usage);
    expect(usage).toHaveBeenCalledWith(7);
    const row = (k: string) => el.querySelector(`[data-kind="${k}"]`)?.textContent ?? '';
    expect(row('visitor')).toContain('Visitors');
    expect(row('visitor')).toContain('45.2K');
    expect(row('visitor')).toContain('12');
    expect(row('person')).toContain('900');
    expect(row('guest')).toContain('0');
    expect(el.querySelectorAll('tbody tr')).toHaveSize(4);
  });

  it('does not ask without the permission', () => {
    const usage = jasmine.createSpy('usage');
    const el = build(false, usage);
    expect(usage).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="inference-usage"]')).toBeNull();
  });

  it('stays hidden when the API fails', () => {
    const usage = jasmine.createSpy('usage').and.returnValue(throwError(() => new Error('boom')));
    const el = build(true, usage);
    expect(el.querySelector('[data-testid="inference-usage"]')).toBeNull();
  });
});
