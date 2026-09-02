import { TestBed } from '@angular/core/testing';
import { MaskModeService } from './mask-mode.service';

describe('MaskModeService', () => {
  afterEach(() => {
    try {
      localStorage.removeItem('flui-mask-mode');
    } catch {
      /* noop */
    }
  });

  it('defaults to off — opt-in before a screen-share, not opt-out (decision 1)', () => {
    const service = TestBed.inject(MaskModeService);
    expect(service.enabled()).toBe(false);
  });

  it('persists across a fresh instance, per-browser via localStorage', () => {
    TestBed.inject(MaskModeService).setEnabled(true);

    TestBed.resetTestingModule();
    const again = TestBed.inject(MaskModeService);

    expect(again.enabled()).toBe(true);
  });

  it('toggle() flips the signal and persists the new value', () => {
    const service = TestBed.inject(MaskModeService);
    service.toggle();
    expect(service.enabled()).toBe(true);
    expect(localStorage.getItem('flui-mask-mode')).toBe('on');

    service.toggle();
    expect(service.enabled()).toBe(false);
    expect(localStorage.getItem('flui-mask-mode')).toBe('off');
  });
});
