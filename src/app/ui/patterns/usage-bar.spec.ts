import { TestBed } from '@angular/core/testing';
import { FlUsageBar } from './usage-bar';

function render(percent: number, warnAt = 80, criticalAt = 90): HTMLElement {
  const fixture = TestBed.createComponent(FlUsageBar);
  fixture.componentRef.setInput('percent', percent);
  fixture.componentRef.setInput('label', 'Memory');
  fixture.componentRef.setInput('warnAt', warnAt);
  fixture.componentRef.setInput('criticalAt', criticalAt);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FlUsageBar', () => {
  it('shows the value with one decimal and no warning below the threshold', () => {
    const el = render(12.44);
    expect(el.textContent).toContain('12.4%');
    expect(el.classList.contains('fl-usage--warning')).toBeFalse();
  });

  it('warns from the warning threshold and turns critical from the critical one', () => {
    expect(render(80).classList.contains('fl-usage--warning')).toBeTrue();
    expect(render(95).classList.contains('fl-usage--critical')).toBeTrue();
  });

  it('keeps the meter within 0 to 100', () => {
    const meter = render(140).querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuenow')).toBe('100');
  });
});
