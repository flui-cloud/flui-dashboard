import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';

describe('SandboxBannerComponent', () => {
  const build = (hasArea: boolean, visitor = false) => {
    const keep = jasmine.createSpy('keep').and.returnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SandboxService,
          useValue: {
            inSandbox: signal(true),
            hasArea: signal(hasArea),
            visitor: signal(visitor),
            expired: signal(false),
            urgent: signal(false),
            appsKeptUntil: signal('2026-10-12T08:00:00.000Z'),
            keep,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SandboxBannerComponent);
    fixture.detectChanges();
    return { fixture, keep, el: fixture.nativeElement as HTMLElement };
  };

  it('tells a guest who is only looking around that the demo is read-only', () => {
    const { el } = build(false);
    expect(el.textContent).toContain('Demo guest');
    expect(el.textContent).toContain('read-only demo');
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('[data-testid="install-flui"]')?.getAttribute('href')).toBe(INSTALL_FLUI_URL);
  });

  it('lets a guest with a space keep their apps', () => {
    const { el, keep, fixture } = build(true);
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Keep my apps');

    button.click();
    fixture.detectChanges();

    expect(keep).toHaveBeenCalled();
    expect(button.textContent).toContain('Kept until');
  });

  it('points a visitor to installing Flui instead of signing in', () => {
    const { el } = build(false, true);
    expect(el.textContent).toContain('You are looking around a read-only demo.');
    expect(el.textContent).not.toContain('Sign in');
    const link = el.querySelector('[data-testid="install-flui"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Install Flui');
    expect(link.getAttribute('href')).toBe(INSTALL_FLUI_URL);
    expect(link.target).toBe('_blank');
  });
});
