import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { FLUI_CORE_REPO_URL, INSTALL_FLUI_URL } from '../../../core/utils/install-flui';

describe('SandboxBannerComponent', () => {
  const build = (hasArea: boolean, visitor = false, inSandbox = true) => {
    const keep = jasmine.createSpy('keep').and.returnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SandboxService,
          useValue: {
            inSandbox: signal(inSandbox),
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

  const star = (el: HTMLElement) => el.querySelector('[data-testid="star-on-github"]') as HTMLAnchorElement | null;

  it('invites a visitor to star flui-core, in a new tab, without asking GitHub for a count', () => {
    const { el } = build(false, true);
    const link = star(el)!;
    expect(link.getAttribute('href')).toBe(FLUI_CORE_REPO_URL);
    expect(FLUI_CORE_REPO_URL).toBe('https://github.com/flui-cloud/flui-core');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.textContent).toContain('Star');
    expect(link.getAttribute('aria-label')).toBe('Star Flui on GitHub');
    expect(link.textContent).not.toMatch(/\d/);
  });

  it('shows the star beside Install Flui to a demo guest, and to a guest with a space', () => {
    expect(star(build(false).el)).not.toBeNull();
    TestBed.resetTestingModule();
    expect(star(build(true).el)).not.toBeNull();
  });

  it('shows nothing to an operator', () => {
    const { el } = build(false, false, false);
    expect(star(el)).toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });
});
