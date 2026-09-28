import { TestBed } from '@angular/core/testing';
import { MaskIdPipe } from './mask-id.pipe';
import { MaskModeService } from '../../core/services/mask-mode.service';

describe('MaskIdPipe', () => {
  let mask: MaskModeService;
  let pipe: MaskIdPipe;

  beforeEach(() => {
    localStorage.removeItem('flui-mask-mode');
    TestBed.configureTestingModule({ providers: [MaskIdPipe] });
    mask = TestBed.inject(MaskModeService);
    pipe = TestBed.runInInjectionContext(() => new MaskIdPipe());
  });

  afterEach(() => localStorage.removeItem('flui-mask-mode'));

  it('shows the id as it is while mask mode is off', () => {
    expect(pipe.transform('23080e08-0000-4000-8000-000000000001')).toBe(
      '23080e08-0000-4000-8000-000000000001',
    );
  });

  it('keeps only the last four characters while mask mode is on', () => {
    mask.setEnabled(true);
    expect(pipe.transform('23080e08-0000-4000-8000-000000000001')).toBe('••••0001');
  });

  it('shows nothing for a missing id', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});
