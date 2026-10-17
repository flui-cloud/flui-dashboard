import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InstallFluiDialogComponent } from './install-flui-dialog.component';
import { InstallPromptService } from '../../../core/services/install-prompt.service';
import { INSTALL_FLUI_URL } from '../../../core/utils/install-flui';

describe('InstallFluiDialogComponent', () => {
  const build = () => {
    const open = signal(true);
    const prompt = {
      dialogOpen: open,
      close: jasmine.createSpy('close').and.callFake(() => open.set(false)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: InstallPromptService, useValue: prompt }],
    });
    const fixture = TestBed.createComponent(InstallFluiDialogComponent);
    fixture.detectChanges();
    flush();
    const el = fixture.nativeElement as HTMLElement;
    const find = (id: string) => el.querySelector<HTMLElement>(`[data-testid="install-flui-${id}"]`);
    return { fixture, prompt, el, find };
  };

  it('points to installing Flui and offers no sign-in', fakeAsync(() => {
    const { el, find } = build();
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(el.textContent).toContain('Want the full experience?');
    expect(el.textContent).toContain('This demo is read-only.');
    const link = find('link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(INSTALL_FLUI_URL);
    expect(link.target).toBe('_blank');
    expect(document.activeElement).toBe(link);
    expect(el.textContent).not.toContain('GitHub');
    expect(el.textContent).not.toContain('Sign in');
  }));

  it('lets the person keep looking around', fakeAsync(() => {
    const { find, prompt, fixture, el } = build();
    find('stay')!.click();
    fixture.detectChanges();
    expect(prompt.close).toHaveBeenCalled();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  }));

  it('closes on Escape', fakeAsync(() => {
    const { prompt } = build();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(prompt.close).toHaveBeenCalled();
  }));
});
