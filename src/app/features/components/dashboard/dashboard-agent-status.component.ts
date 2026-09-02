import { Component, OnInit, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideBot, lucideClock } from '@ng-icons/lucide';
import {
  AgentActivityService,
  AgentIdentityActivityDto,
} from '../../../core/api';

/** How long after its last recorded tool call an identity still reads as "working" rather than merely "seen". */
const WORKING_WINDOW_MS = 3 * 60 * 1000;

type AgentHookState = 'working' | 'idle' | 'none';

@Component({
  selector: 'app-dashboard-agent-status',
  standalone: true,
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideArrowRight, lucideBot, lucideClock })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (loaded()) {
      @switch (state()) {
        @case ('working') {
          <div class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4 flex items-center gap-3">
            <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-emerald-900 dark:text-emerald-200">An agent is working</p>
              <p class="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                {{ identityLabel(working()!) }}
                @if (working()!.lastTool) {
                  · {{ working()!.lastTool }}
                }
              </p>
            </div>
            <a routerLink="/agents" class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline">
              View activity
              <ng-icon name="lucideArrowRight" class="h-3 w-3" />
            </a>
          </div>
        }
        @case ('idle') {
          <div class="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <span class="flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-muted-foreground/40"></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold">No agent working right now</p>
              <p class="text-xs text-muted-foreground truncate">
                Last seen: {{ identityLabel(mostRecent()!) }} · {{ formatTime(mostRecent()!.lastActivityAt) }}
              </p>
            </div>
            <a routerLink="/agents" class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View activity
              <ng-icon name="lucideArrowRight" class="h-3 w-3" />
            </a>
            <a routerLink="/settings" fragment="agent-keys" class="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline">
              Connect another
            </a>
          </div>
        }
        @case ('none') {
          <div class="rounded-lg border border-dashed border-border bg-card p-4 flex items-center gap-3">
            <ng-icon name="lucideBot" class="h-8 w-8 flex-shrink-0 text-muted-foreground" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold">No agent connected yet</p>
              <p class="text-xs text-muted-foreground">
                Connect a coding agent so it can operate this instance directly.
              </p>
            </div>
            <a
              routerLink="/settings"
              fragment="agent-keys"
              class="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Connect an agent
              <ng-icon name="lucideArrowRight" class="h-3 w-3" />
            </a>
          </div>
        }
      }
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
