import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService as ApiAuthService } from '../../../../core/api/api/auth.service';
import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { CreateApiKeyDto } from '../../../../core/api/model/createApiKeyDto';
import { CreateApiKeyResultDto } from '../../../../core/api/model/createApiKeyResultDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { sandboxFailureMessage } from '../../../../core/services/sandbox.service';
import { SandboxLevelNoticeComponent } from '../../../../shared/components/sandbox-level-notice.component';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { AgentKeyListComponent } from './agent-key-list.component';
import { AgentKeyMintComponent, MintRequest } from './agent-key-mint.component';
import { AgentSkill, AgentSkillService } from './agent-skill.service';
import { ConnectAgentComponent } from './connect-agent.component';

@Component({
  selector: 'app-agent-keys',
  imports: [
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlLoadingState,
    SandboxLevelNoticeComponent,
    AgentKeyMintComponent,
    AgentKeyListComponent,
    ConnectAgentComponent,
  ],
  host: { class: 'fl-stack' },
  template: `
    <app-sandbox-level-notice area="agent-keys" />

    <fl-alert tone="info" title="An agent can never do more than you can." data-testid="ceiling">
      {{ ceiling() }}
    </fl-alert>

    @if (loadError(); as e) {
      <fl-alert tone="error" title="Agent keys">{{ e }}</fl-alert>
    }

    @if (loading()) {
      <fl-panel title="Agent keys">
        <fl-loading-state />
      </fl-panel>
    } @else {
      @if (!minted()) {
        <app-connect-agent
          [skill]="skill()"
          [skillError]="skillError()"
          data-testid="connect-agent-standalone"
        />
      }

      <fl-panel title="Issue a new key">
        <div class="flex flex-col gap-4">
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">
            Switch on what the agent may do, name it, and copy the key it gives you back.
          </p>
          @if (!oidc()) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="local-mode">
              This instance signs people in locally, and keys are issued in OIDC mode only. Existing
              keys are still listed below and can still be revoked.
            </p>
          } @else if (catalogue().length === 0) {
            <fl-empty-state
              [compact]="true"
              title="Nothing to hand on"
              body="No permission groups came back, so there is nothing to hand on from here."
            />
          } @else {
            <app-agent-key-mint
              #mint
              [catalogue]="catalogue()"
              [minted]="minted()"
              [busy]="minting()"
              [error]="mintError()"
              [skill]="skill()"
              [skillError]="skillError()"
              (create)="mintKey($event)"
              (dismiss)="clearMinted()"
            />
          }
        </div>
      </fl-panel>

      <fl-panel title="Keys you have issued" [count]="keys().length" [flush]="true">
        <p class="m-0 border-b border-fl-border-subtle px-4 py-3 text-fl-body-sm text-fl-ink-muted">
          Everything holding a credential of yours, and the gesture that takes it back.
        </p>
        <app-agent-key-list
          [keys]="keys()"
          [catalogue]="catalogue()"
          [revoking]="revoking()"
          [currentSkillVersion]="skill()?.version ?? null"
          [updatingApplications]="updatingApplications()"
          [updateApplicationsError]="updateApplicationsError()"
          [updatingProjects]="updatingProjects()"
          [updateProjectsError]="updateProjectsError()"
          [updatingScopes]="updatingScopes()"
          [updateScopesError]="updateScopesError()"
          (updateScopes)="updateScopes($event)"
          (revoke)="revokeKey($event)"
          (updateApplications)="updateApplications($event)"
          (updateProjects)="updateProjects($event)"
        />
      </fl-panel>
    }
  `,
})
export class AgentKeysComponent implements OnInit {
  private readonly api = inject(ApiAuthService);
  private readonly cfg = inject(AppConfigService);
  private readonly http = inject(HttpClient);
  private readonly skills = inject(AgentSkillService);

  private readonly mint = viewChild<AgentKeyMintComponent>('mint');

  protected readonly catalogue = signal<PermissionGroupDto[]>([]);
  protected readonly keys = signal<ApiKeyResponseDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly minted = signal<CreateApiKeyResultDto | null>(null);
  protected readonly minting = signal(false);
  protected readonly mintError = signal<string | null>(null);
  protected readonly revoking = signal<string | null>(null);
  protected readonly updatingApplications = signal<string | null>(null);
  protected readonly updateApplicationsError = signal<string | null>(null);
  protected readonly updatingProjects = signal<string | null>(null);
  protected readonly updateProjectsError = signal<string | null>(null);
  protected readonly updatingScopes = signal<string | null>(null);
  protected readonly updateScopesError = signal<string | null>(null);
  protected readonly skill = signal<AgentSkill | null>(null);
  protected readonly skillError = signal<string | null>(null);

  protected readonly oidc = computed(() => this.cfg.authMode === 'oidc');

  protected readonly ceiling = computed(() => {
    const all = this.catalogue();
    if (!all.length) return 'What you may hand on is decided by your own permissions.';
    const mine = all.filter((g) => g.grantable).length;
    if (mine === all.length) {
      return `All ${all.length} permission groups on this instance are yours to hand on. The switches below choose how much of that you lend out.`;
    }
    return `${mine} of the ${all.length} permission groups on this instance are yours to hand on. The rest carry a capability your own permissions do not cover, so they stay switched off.`;
  });

  ngOnInit(): void {
    this.load();
    this.loadSkill();
  }

  private loadSkill(): void {
    this.skills.skill().subscribe({
      next: (doc) => {
        this.skill.set(doc);
        this.skillError.set(null);
      },
      error: () => {
        this.skill.set(null);
        this.skillError.set(
          'The instructions for agents could not be read from this instance. ' +
            'The key above still works; the agent will be operating without them.',
        );
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.apiKeysControllerListPermissionGroups().subscribe({
      next: (groups) => {
        this.catalogue.set(groups);
        this.loadKeys();
      },
      error: (err: unknown) => {
        this.catalogue.set([]);
        this.loadError.set(sandboxFailureMessage(err, 'The permission groups could not be read.'));
        this.loadKeys();
      },
    });
  }

  private loadKeys(): void {
    this.api.apiKeysControllerListApiKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.keys.set([]);
        this.loading.set(false);
        this.loadError.set(
          this.loadError() ?? sandboxFailureMessage(err, 'Your keys could not be read.'),
        );
      },
    });
  }

  protected mintKey(req: MintRequest): void {
    this.minting.set(true);
    this.mintError.set(null);
    const body: CreateApiKeyDto = {
      name: req.name,
      groups: req.groups as CreateApiKeyDto.GroupsEnum[],
      ...(req.expiresAt ? { expiresAt: req.expiresAt } : {}),
      ...(req.applicationIds ? { applicationIds: req.applicationIds } : {}),
      ...(req.projectIds ? { projectIds: req.projectIds } : {}),
    };
    this.api.apiKeysControllerCreateApiKey(body).subscribe({
      next: (result) => {
        this.minting.set(false);
        this.minted.set(result);
        this.mint()?.reset();
        this.loadKeys();
      },
      error: (err: unknown) => {
        this.minting.set(false);
        this.mintError.set(messageOf(err, 'The key could not be created.'));
      },
    });
  }

  protected clearMinted(): void {
    this.minted.set(null);
  }

  protected revokeKey(key: ApiKeyResponseDto): void {
    this.revoking.set(key.id);
    this.api.apiKeysControllerRevokeApiKey(key.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.loadKeys();
      },
      error: (err: unknown) => {
        this.revoking.set(null);
        this.loadError.set(messageOf(err, `${key.name} could not be revoked.`));
      },
    });
  }

  protected updateApplications(event: { key: ApiKeyResponseDto; applicationIds: string[] }): void {
    this.updatingApplications.set(event.key.id);
    this.updateApplicationsError.set(null);
    this.api
      .apiKeysControllerUpdateApiKeyApplications(event.key.id, {
        applicationIds: event.applicationIds,
      })
      .subscribe({
        next: () => {
          this.updatingApplications.set(null);
          this.loadKeys();
        },
        error: (err: unknown) => {
          this.updatingApplications.set(null);
          this.updateApplicationsError.set(
            messageOf(err, `${event.key.name}'s applications could not be updated.`),
          );
        },
      });
  }

  protected updateProjects(event: { key: ApiKeyResponseDto; projectIds: string[] }): void {
    this.updatingProjects.set(event.key.id);
    this.updateProjectsError.set(null);
    this.api
      .apiKeysControllerUpdateApiKeyProjects(event.key.id, {
        projectIds: event.projectIds,
      })
      .subscribe({
        next: () => {
          this.updatingProjects.set(null);
          this.loadKeys();
        },
        error: (err: unknown) => {
          this.updatingProjects.set(null);
          this.updateProjectsError.set(
            messageOf(err, `${event.key.name}'s projects could not be updated.`),
          );
        },
      });
  }

  protected updateScopes(event: { key: ApiKeyResponseDto; scopes: string[] }): void {
    this.updatingScopes.set(event.key.id);
    this.updateScopesError.set(null);
    this.http
      .patch<ApiKeyResponseDto>(
        `${this.cfg.apiBaseUrl}/api/v1/auth/api-keys/${encodeURIComponent(event.key.id)}/scopes`,
        { scopes: event.scopes },
      )
      .subscribe({
        next: () => {
          this.updatingScopes.set(null);
          this.loadKeys();
        },
        error: (err: unknown) => {
          this.updateScopesError.set(
            messageOf(err, `What ${event.key.name} may do could not be changed.`),
          );
          this.updatingScopes.set(null);
        },
      });
  }
}

function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
