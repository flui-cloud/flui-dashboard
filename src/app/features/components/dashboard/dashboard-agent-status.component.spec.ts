import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AgentActivityService } from '../../../core/api';
import { DashboardAgentStatusComponent } from './dashboard-agent-status.component';

describe('DashboardAgentStatusComponent', () => {
  let fixture: ComponentFixture<DashboardAgentStatusComponent>;

  const build = async (response: unknown) => {
    await TestBed.configureTestingModule({
      imports: [DashboardAgentStatusComponent],
      providers: [
        provideRouter([]),
        { provide: AgentActivityService, useValue: { agentActivityControllerIdentities: () => response } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardAgentStatusComponent);
    fixture.detectChanges();
  };

  const card = (): HTMLElement => fixture.nativeElement.querySelector('[data-testid="agent-card"]');

  it('says when the last agent was seen and nothing is working now', async () => {
    const lastActivityAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await build(of({ identities: [{ actorKind: 'api_key', actorKeyName: 'cli', lastActivityAt }] }));
    expect(card().textContent).toContain('Agent');
    expect(card().textContent).toContain('No agent working right now');
    expect(card().textContent).toContain('Last seen: cli · 3d ago');
  });

  it('invites connecting an agent when the read fails', async () => {
    await build(throwError(() => new Error('offline')));
    expect(card().textContent).toContain('No agent connected yet');
    expect(card().textContent).toContain('Connect an agent');
  });
});
