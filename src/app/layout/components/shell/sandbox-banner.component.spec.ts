import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SandboxBannerComponent } from './sandbox-banner.component';
import { SandboxService } from '../../../core/services/sandbox.service';

describe('SandboxBannerComponent', () => {
  const build = (hasArea: boolean) => {
    const keep = jasmine.createSpy('keep').and.returnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SandboxService,
          useValue: {
            inSandbox: signal(true),
            hasArea: signal(hasArea),
            expired: signal(false),
            urgent: signal(false),
            keep,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SandboxBannerComponent);
    fixture.detectChanges();
    return { fixture, keep, el: fixture.nativeElement as HTMLElement };
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
    expect(button.textContent).toContain('Kept');
  });
});
