import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditEvent } from '../../model/audit.model';
import { AuditEventListComponent } from './audit-event-list.component';

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'e1',
  at: new Date().toISOString(),
  userId: 'u1',
  email: 'owner@acme.com',
  actorKind: 'agent',
  actorKeyId: 'k1',
  action: 'GET /applications/:id',
  target: null,
  status: 200,
  outcome: 'ok',
  permission: null,
  dataAccess: false,
  ...over,
});

describe('AuditEventListComponent', () => {
  let fixture: ComponentFixture<AuditEventListComponent>;

  const build = (events: AuditEvent[]) => {
    fixture = TestBed.createComponent(AuditEventListComponent);
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [AuditEventListComponent] }));

  it('badges an API key actor by its kind', () => {
    const who = build([event({ actorKind: 'key' })]).querySelector('tbody tr td:nth-child(2)');
    expect(who?.textContent).toContain('key');
    expect(who?.textContent).not.toContain('Flui Assistant');
  });

  it('badges the in-product assistant by name instead of as a key', () => {
    const who = build([event({ actorKeyId: 'surface:assistant' })]).querySelector(
      'tbody tr td:nth-child(2)',
    );
    expect(who?.textContent).toContain('Flui Assistant');
    expect(who?.textContent).not.toContain('agent');
  });
});
