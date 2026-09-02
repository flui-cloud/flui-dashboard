import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisclosureComponent } from './disclosure.component';

@Component({
  standalone: true,
  imports: [DisclosureComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-disclosure
      label="Bounds"
      summary="1 floor · 3 target · 5 ceiling"
      testid="bounds"
    >
      <p>the three inputs</p>
    </app-disclosure>
  `,
})
class Host {}

describe('a section that is one line until somebody needs it', () => {
  let fixture: ComponentFixture<Host>;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('answers the common question while shut', () => {
    expect(find('bounds')).toBeNull();
    expect(find('bounds-summary')?.textContent).toContain('1 floor');
  });

  it('opens and closes', () => {
    find('bounds-toggle')!.click();
    fixture.detectChanges();
    expect(find('bounds')?.textContent).toContain('the three inputs');

    find('bounds-toggle')!.click();
    fixture.detectChanges();
    expect(find('bounds')).toBeNull();
  });

  it('says what it is and what state it is in', () => {
    const toggle = find('bounds-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(
      find('bounds')!.getAttribute('id'),
    );
  });
});
