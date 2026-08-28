import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExplainComponent } from './explain.component';

@Component({
  standalone: true,
  imports: [ExplainComponent],
  template: `
    <app-explain label="Nature" testid="nature-help">
      A practice says what is done here; a reason says why.
    </app-explain>
  `,
})
class Host {}

describe('a label with its explanation folded behind it', () => {
  let fixture: ComponentFixture<Host>;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows the label and hides the explanation', () => {
    expect(fixture.nativeElement.textContent).toContain('Nature');
    expect(find('nature-help')).toBeNull();
  });

  it('opens and closes on the button', () => {
    const toggle = find('nature-help-toggle')!;
    toggle.click();
    fixture.detectChanges();
    expect(find('nature-help')?.textContent).toContain('a reason says why');

    toggle.click();
    fixture.detectChanges();
    expect(find('nature-help')).toBeNull();
  });

  it('says what it is and what state it is in', () => {
    const toggle = find('nature-help-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('What is this?');

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(
      find('nature-help')!.getAttribute('id'),
    );
  });
});
