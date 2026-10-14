import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { SandboxService } from '../../../core/services/sandbox.service';
import { VisitorSignInService } from '../../../core/services/visitor-sign-in.service';

describe('SandboxBannerComponent', () => {
  const build = (hasArea: boolean, visitor = false) => {
    const keep = jasmine.createSpy('keep').and.returnValue(of(true));
    const signIn = jasmine.createSpy('signIn');
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
        { provide: VisitorSignInService, useValue: { signIn } },
      ],
    });
    const fixture = TestBed.createComponent(SandboxBannerComponent);
    fixture.detectChanges();
    return { fixture, keep, signIn, el: fixture.nativeElement as HTMLElement };
  };

  it('tells a guest who is only looking around how to get a space', () => {
    const { el } = build(false);
    expect(el.textContent).toContain('Demo guest');
    expect(el.querySelector('button')).toBeNull();
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

  it('offers a visitor the way to sign in', () => {
    const { el, signIn } = build(false, true);
    expect(el.textContent).toContain('as a visitor');
    (el.querySelector('[data-testid="visitor-sign-in"]') as HTMLButtonElement).click();
    expect(signIn).toHaveBeenCalled();
  });
});
