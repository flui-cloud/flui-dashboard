import { TestBed, fakeAsync, flush, flushMicrotasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VisitorSignInDialogComponent } from './visitor-sign-in-dialog.component';
import { UpgradeProviders, VisitorSignInService } from '../../../core/services/visitor-sign-in.service';

describe('VisitorSignInDialogComponent', () => {
  const build = (answer: UpgradeProviders) => {
    const open = signal(true);
    const gate = {
      dialogOpen: open,
      busy: signal(false),
      providers: jasmine.createSpy('providers').and.resolveTo(answer),
      withProvider: jasmine.createSpy('withProvider').and.resolveTo(),
      withEmail: jasmine.createSpy('withEmail').and.resolveTo(),
      close: jasmine.createSpy('close').and.callFake(() => open.set(false)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: VisitorSignInService, useValue: gate }],
    });
    const fixture = TestBed.createComponent(VisitorSignInDialogComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    flush();
    const el = fixture.nativeElement as HTMLElement;
    const find = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="visitor-sign-in-${id}"]`);
    return { fixture, gate, el, find };
  };

  it('offers only the connected providers', fakeAsync(() => {
    const { el, find, gate } = build({ providers: [{ provider: 'github', name: 'GitHub' }], email: false });
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(el.textContent).toContain('Sign in to deploy');
    expect(find('github')?.textContent).toContain('Continue with GitHub');
    expect(find('google')).toBeNull();
    expect(find('email')).toBeNull();
    expect(document.activeElement).toBe(find('github'));
    find('github')!.click();
    expect(gate.withProvider).toHaveBeenCalledWith('github');
  }));

  it('falls back to email when no provider is listed', fakeAsync(() => {
    const { find, gate } = build({ providers: [], email: true });
    expect(find('email')).not.toBeNull();
    find('email')!.click();
    expect(gate.withEmail).toHaveBeenCalled();
  }));

  it('closes on Escape', fakeAsync(() => {
    const { gate, fixture, el } = build({ providers: [], email: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(gate.close).toHaveBeenCalled();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  }));
});
