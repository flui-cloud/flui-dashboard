import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentKeyMintComponent } from './agent-key-mint.component';

/**
 * The button that would not turn on.
 *
 * `canSubmit` is a `computed`, and a `computed` re-runs only when a *signal* it
 * read changes. The name was a plain property bound with `[(ngModel)]`, so
 * typing it never invalidated anything: the button stayed disabled until some
 * other signal moved, and toggling a permission group was what happened to move
 * one. Reported from the dashboard as "the Create button does not enable — I had
 * to play with the sections to get it on", which is the symptom read from the
 * outside.
 */
describe('minting an agent key', () => {
  let fixture: ComponentFixture<AgentKeyMintComponent>;
  let component: AgentKeyMintComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentKeyMintComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AgentKeyMintComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('catalogue', [
      {
        key: 'apps:look',
        area: 'apps',
        depth: 'look',
        label: 'See applications',
        summary: 'Read applications',
        scopes: ['mcp:app:read'],
        grantable: true,
      },
    ]);
    fixture.detectChanges();
  });

  const canSubmit = () =>
    (component as unknown as { canSubmit: () => boolean }).canSubmit();
  const name = () =>
    (component as unknown as { name: { set: (v: string) => void } }).name;
  const toggle = (key: string) =>
    (component as unknown as { toggle: (k: string) => void }).toggle(key);

  it('stays off until there is both a name and a permission', () => {
    expect(canSubmit()).toBe(false);
    name().set('my agent');
    expect(canSubmit()).toBe(false);
  });

  /**
   * The regression itself: naming last must enable the button, with nothing
   * else touched afterwards.
   */
  it('turns on when the name is typed last', () => {
    toggle('apps:look');
    expect(canSubmit()).toBe(false);
    name().set('my agent');
    expect(canSubmit()).toBe(true);
  });

  it('turns on when the permission is picked last', () => {
    name().set('my agent');
    toggle('apps:look');
    expect(canSubmit()).toBe(true);
  });

  /**
   * The key is shown once and never again, so it must not arrive below the
   * fold. The result replaces a long form with a short block, which leaves
   * whoever pressed Create looking at the empty space beneath it.
   */
  it('brings the minted key into view when it appears', () => {
    const scrolled: unknown[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (opts?: unknown) {
      scrolled.push(opts);
    };
    try {
      fixture.componentRef.setInput('minted', {
        id: 'k1',
        name: 'my agent',
        key: 'flui_notarealkey',
        createdAt: '2026-09-20T10:00:00.000Z',
      });
      fixture.detectChanges();
      expect(scrolled.length).toBeGreaterThan(0);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('turns off again when the name is cleared', () => {
    toggle('apps:look');
    name().set('my agent');
    expect(canSubmit()).toBe(true);
    name().set('   ');
    expect(canSubmit()).toBe(false);
  });
});
