import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { ReadOnlySectionDirective } from './read-only-section.directive';
import { PermissionService } from '../../core/services/permission.service';
import { SandboxService } from '../../core/services/sandbox.service';

@Component({
  standalone: true,
  imports: [ReadOnlySectionDirective],
  template: `
    <button id="one" appReadOnlySection="clusters">section only</button>
    <button id="both" [appReadOnlySection]="['clusters', 'cluster']">both</button>
    <button id="derived" appReadOnlySection>area from the route</button>
  `,
})
class HostComponent {}

const setUp = (opts: {
  readOnlySections?: string[];
  areaLevels?: Record<string, string>;
  url?: string;
}) => {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      {
        provide: PermissionService,
        useValue: {
          isSectionReadOnly: (key: string) =>
            (opts.readOnlySections ?? []).includes(key),
        },
      },
      {
        provide: SandboxService,
        useValue: {
          levelOf: (key: string) => opts.areaLevels?.[key] ?? 'full',
        },
      },
      {
        provide: Router,
        useValue: { events: EMPTY, url: opts.url ?? '/dashboard' },
      },
    ],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`#${id}`);
};

describe('ReadOnlySectionDirective', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('leaves a control alone when nothing limits it', () => {
    const el = setUp({});
    expect(el('one').classList).not.toContain('pointer-events-none');
  });

  it('draws a control off when the section is open read-only', () => {
    const el = setUp({ readOnlySections: ['clusters'] });
    expect(el('one').classList).toContain('pointer-events-none');
    expect(el('one').getAttribute('aria-disabled')).toBe('true');
  });

  it('misses a guest when only the section name is given', () => {
    const el = setUp({ areaLevels: { cluster: 'view' } });
    expect(el('one').classList).not.toContain('pointer-events-none');
  });

  it('catches the guest when the control names both', () => {
    const el = setUp({ areaLevels: { cluster: 'view' } });
    expect(el('both').classList).toContain('pointer-events-none');
  });

  it('still catches the operator side when the control names both', () => {
    const el = setUp({ readOnlySections: ['clusters'] });
    expect(el('both').classList).toContain('pointer-events-none');
  });

  describe('with no key, taking the area from the route', () => {
    it('draws the command off where the trial does not open the area', () => {
      const el = setUp({
        url: '/infrastructure/keys',
        areaLevels: { keys: 'closed' },
      });
      expect(el('derived').classList).toContain('pointer-events-none');
      expect(el('derived').getAttribute('aria-disabled')).toBe('true');
    });

    it('leaves it alone where the area is the guest’s own', () => {
      const el = setUp({
        url: '/infrastructure/keys',
        areaLevels: { keys: 'full' },
      });
      expect(el('derived').classList).not.toContain('pointer-events-none');
    });

    it('leaves it alone on a route no area claims', () => {
      const el = setUp({ url: '/dashboard', areaLevels: { keys: 'closed' } });
      expect(el('derived').classList).not.toContain('pointer-events-none');
    });

    it('catches the stand-in level too, not only the closed one', () => {
      const el = setUp({
        url: '/infrastructure/domains',
        areaLevels: { 'dns-zones': 'stand-in' },
      });
      expect(el('derived').classList).toContain('pointer-events-none');
    });
  });
});
