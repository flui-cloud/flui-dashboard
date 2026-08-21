import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReadOnlySectionDirective } from './read-only-section.directive';
import { PermissionService } from '../../core/services/permission.service';
import { SandboxService } from '../../core/services/sandbox.service';

@Component({
  standalone: true,
  imports: [ReadOnlySectionDirective],
  template: `
    <button id="one" appReadOnlySection="clusters">section only</button>
    <button id="both" [appReadOnlySection]="['clusters', 'cluster']">both</button>
  `,
})
class HostComponent {}

const setUp = (opts: { readOnlySections?: string[]; areaLevels?: Record<string, string> }) => {
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
});
