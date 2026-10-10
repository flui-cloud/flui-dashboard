import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatTileComponent } from './stat-tile.component';
import { StatTileData } from '../chart.models';

describe('StatTileComponent note', () => {
  let fixture: ComponentFixture<StatTileComponent>;

  const render = (data: StatTileData): HTMLElement => {
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatTileComponent] }).compileComponents();
    fixture = TestBed.createComponent(StatTileComponent);
  });

  it('draws nothing extra without a note', () => {
    expect(render({ label: 'CPU', value: '10' }).querySelector('[data-testid="stat-tile-note"]')).toBeNull();
  });

  it('draws a line with its hint behind an info icon', () => {
    const el = render({ label: 'CPU', value: '10', notes: [{ text: 'Held back', hint: 'Why it matters' }] });
    const note = el.querySelector('[data-testid="stat-tile-note"]')!;
    expect(note.tagName).toBe('P');
    expect(note.textContent).toContain('Held back');
    expect(note.querySelector('[title="Why it matters"]')).not.toBeNull();
  });

  it('draws a chip with its hint on hover', () => {
    const el = render({ label: 'Replicas', value: '2/2', notes: [{ text: 'Not ready at times', hint: 'Last at 10:20', kind: 'chip' }] });
    const note = el.querySelector('[data-testid="stat-tile-note"]')!;
    expect(note.tagName).toBe('SPAN');
    expect(note.getAttribute('title')).toBe('Last at 10:20');
  });

  it('keeps note text neutral and marks its tone with a dot, several notes in order', () => {
    const el = render({
      label: 'Health checks',
      value: '3',
      notes: [{ text: 'Taken out of the route 3 times' }, { text: 'Restarted 1 times', tone: 'bad' }],
    });
    const notes = Array.from(el.querySelectorAll('[data-testid="stat-tile-note"]'));
    expect(notes.map((n) => n.textContent!.trim())).toEqual(['Taken out of the route 3 times', 'Restarted 1 times']);
    expect(notes.every((n) => n.className.includes('text-sub'))).toBeTrue();
    expect(notes[0].querySelector('[data-testid="stat-tile-note-dot"]')!.className).toContain('bg-amber-500');
    expect(notes[1].querySelector('[data-testid="stat-tile-note-dot"]')!.className).toContain('bg-destructive');
  });

  it('draws no dot for a muted note', () => {
    const el = render({ label: 'Health checks', value: '0', notes: [{ text: 'Not answering while starting', tone: 'muted' }] });
    expect(el.querySelector('[data-testid="stat-tile-note-dot"]')).toBeNull();
  });

  it('puts the hint behind an info icon next to the label', () => {
    const el = render({ label: 'Health checks', value: '0', hint: 'One line' });
    expect(el.querySelector('[data-testid="stat-tile-hint"]')!.getAttribute('title')).toBe('One line');
  });

  it('says "no history yet" only for a figure that has one to draw', () => {
    expect(render({ label: 'CPU', value: '1', spark: [] }).textContent).toContain('no history yet');
    expect(render({ label: 'Restarts', value: '0' }).textContent).not.toContain('no history yet');
  });

  it('keeps a long footnote on one line, whole in its title', () => {
    const el = render({ label: 'CPU', value: '1', footnote: '595 m / 1.5 cores' });
    const footnote = el.querySelector('[data-testid="stat-tile-footnote"]')!;
    expect(footnote.className).toContain('truncate');
    expect(footnote.getAttribute('title')).toBe('595 m / 1.5 cores');
  });
});
