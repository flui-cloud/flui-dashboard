import { TestBed } from '@angular/core/testing';
import {
  ApplicationsListShowcaseComponent,
  READ_ONLY_DEMO_SHOWCASE_NOTE,
  showcaseNote,
} from './applications-list-showcase.component';

const API_WHY = 'A Flui project — read-only for you. Everything else you see in this instance is yours alone.';

describe('showcaseNote', () => {
  it('keeps the API sentence for a guest with a space of their own', () => {
    expect(showcaseNote(API_WHY, false)).toBe(API_WHY);
  });

  it('does not promise a space of their own to a visitor or a guest without one', () => {
    const note = showcaseNote(API_WHY, true);
    expect(note).toBe(READ_ONLY_DEMO_SHOWCASE_NOTE);
    expect(note).not.toContain('yours alone');
    expect(note).toContain('read-only');
  });

  it('says nothing where the API says nothing, as for an operator', () => {
    expect(showcaseNote('', true)).toBe('');
    expect(showcaseNote('', false)).toBe('');
  });
});

describe('ApplicationsListShowcaseComponent', () => {
  it('shows the note under the heading', () => {
    const fixture = TestBed.createComponent(ApplicationsListShowcaseComponent);
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('why', READ_ONLY_DEMO_SHOWCASE_NOTE);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(READ_ONLY_DEMO_SHOWCASE_NOTE);
  });
});
