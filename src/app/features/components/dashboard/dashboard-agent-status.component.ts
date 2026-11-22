import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus } from '../../../ui/primitives/status';
import { AgentActivityService, AgentIdentityActivityDto } from '../../../core/api';

/** How long after its last recorded tool call an identity still reads as "working" rather than merely "seen". */
const WORKING_WINDOW_MS = 3 * 60 * 1000;

type AgentHookState = 'working' | 'idle' | 'none';

@Component({
  selector: 'app-dashboard-agent-status',
  imports: [RouterLink, FlPanel, FlStatus],
  template: `
    @if (loaded()) {
      <fl-panel title="Agents" data-testid="agent-card">
        @if (state() !== 'none') {
          <a panelActions routerLink="/agents" class="fl-link text-fl-body-sm">View activity</a>
        }
        @switch (state()) {
          @case ('working') {
            <div class="flex flex-col gap-1">
              <fl-status tone="progress" label="An agent is working" />
              <p class="truncate text-fl-caption text-fl-ink-muted">
                {{ identityLabel(working()!) }}
                @if (working()!.lastTool) {
                  · {{ working()!.lastTool }}
                }
              </p>
            </div>
          }
          @case ('idle') {
            <div class="flex flex-col gap-1">
              <fl-status tone="neutral" label="No agent working right now" />
              <p class="truncate text-fl-caption text-fl-ink-muted">
                Last seen: {{ identityLabel(mostRecent()!) }} ·
                {{ formatTime(mostRecent()!.lastActivityAt) }}
              </p>
              <a routerLink="/settings" fragment="agent-keys" class="fl-link mt-2 text-fl-body-sm"
                >Connect another</a
              >
            </div>
          }
          @case ('none') {
            <div class="flex flex-col gap-2">
              <p class="text-fl-body-sm text-fl-ink-muted">No agent connected.</p>
              <a routerLink="/settings" fragment="agent-keys" class="fl-link text-fl-body-sm"
                >Connect an agent</a
              >
            </div>
          }
        }
      </fl-panel>
    }
  `,
})
export class DashboardAgentStatusComponent implements OnInit {
  private readonly api = inject(AgentActivityService);

  private readonly identities = signal<AgentIdentityActivityDto[]>([]);
  readonly loaded = signal(false);

  /**
   * `actorKind: 'user'` is a browser session, not an agent — the sidebar,
   * form edits and every click a person makes would otherwise read as "an
   * agent is working" and this hook exists specifically to answer that
   * question about agents, not about the person looking at it.
   */
  private readonly agentIdentities = computed(() =>
    this.identities().filter((i) => i.actorKind !== 'user'),
  );

  readonly mostRecent = computed<AgentIdentityActivityDto | null>(() => {
    const sorted = [...this.agentIdentities()].sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );
    return sorted[0] ?? null;
  });

  readonly working = computed<AgentIdentityActivityDto | null>(() => {
    const latest = this.mostRecent();
    if (!latest) return null;
    const age = Date.now() - new Date(latest.lastActivityAt).getTime();
    return age <= WORKING_WINDOW_MS ? latest : null;
  });

  readonly state = computed<AgentHookState>(() => {
    if (!this.mostRecent()) return 'none';
    return this.working() ? 'working' : 'idle';
  });

  ngOnInit(): void {
    this.api.agentActivityControllerIdentities().subscribe({
      next: (page) => {
        this.identities.set(page.identities);
        this.loaded.set(true);
      },
      error: () => {
        // Unknown beats wrong: read as "none" rather than leaving the
        // section — the one the platform's ambition says can't be
        // hidden — silently absent from the page.
        this.identities.set([]);
        this.loaded.set(true);
      },
    });
  }

  identityLabel(i: AgentIdentityActivityDto): string {
    if (i.actorKeyName) return i.actorKeyName;
    return i.actorKind === 'agent' ? 'Agent identity' : 'Connected agent';
  }

  formatTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  }
}
