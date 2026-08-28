import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SituationAction, SituationComponent } from './situation.component';

@Component({
  standalone: true,
  imports: [SituationComponent],
  template: `
    <app-situation
      [where]="where()"
      [actions]="actions()"
      [nothingToDo]="'Nothing is required of you.'"
      testid="sit"
    />
  `,
})
class Host {
  readonly where = signal(['cx33 is down where you buy.']);
  readonly actions = signal<SituationAction[]>([]);
}

describe('where we are, and what there is to do', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const all = (testid: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testid}"]`));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('says where we are without anything being opened', () => {
    expect(fixture.nativeElement.textContent).toContain('cx33 is down where you buy.');
  });

  it('says so when there is nothing to do', () => {
    expect(find('sit-nothing-to-do')?.textContent).toContain(
      'Nothing is required of you.',
    );
    expect(all('sit-todo')).toHaveSize(0);
  });

  it('lists what could be done, with the reason when there is one', () => {
    host.actions.set([
      { does: 'Pick another region', why: 'hel1 has it now' },
      { does: 'Free prod-eu-worker-3' },
    ]);
    fixture.detectChanges();

    const items = all('sit-todo').map((el) => el.textContent?.replace(/\s+/g, ' ').trim());
    expect(items).toHaveSize(2);
    expect(items[0]).toContain('Pick another region — hel1 has it now');
    expect(find('sit-nothing-to-do')).toBeNull();
  });
});
