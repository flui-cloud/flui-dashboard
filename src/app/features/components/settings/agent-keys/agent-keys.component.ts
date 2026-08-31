import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideLoader, lucideTriangleAlert } from '@ng-icons/lucide';
import {
  HlmCardContentDirective,
  HlmCardDescriptionDirective,
  HlmCardDirective,
  HlmCardHeaderDirective,
  HlmCardTitleDirective,
} from '@spartan-ng/ui-card-helm';
import { AuthService as ApiAuthService } from '../../../../core/api/api/auth.service';
import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { CreateApiKeyDto } from '../../../../core/api/model/createApiKeyDto';
import { CreateApiKeyResultDto } from '../../../../core/api/model/createApiKeyResultDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { sandboxFailureMessage } from '../../../../core/services/sandbox.service';
import { SandboxLevelNoticeComponent } from '../../../../shared/components/sandbox-level-notice.component';
import { AgentKeyListComponent } from './agent-key-list.component';
import { AgentKeyMintComponent, MintRequest } from './agent-key-mint.component';
import { AgentSkill, AgentSkillService } from './agent-skill.service';
import { ConnectAgentComponent } from './connect-agent.component';

@Component({
  selector: 'app-agent-keys',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmCardHeaderDirective,
    HlmCardTitleDirective,
    HlmCardDescriptionDirective,
    SandboxLevelNoticeComponent,
    AgentKeyMintComponent,
    AgentKeyListComponent,
    ConnectAgentComponent,
  ],
  providers: [provideIcons({ lucideInfo, lucideLoader, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <app-sandbox-level-notice area="agent-keys" />

      <div
        role="note"
        class="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground"
      >
        <ng-icon name="lucideInfo" class="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
        <p class="leading-relaxed" data-testid="ceiling">
          <span class="font-medium text-foreground">An agent can never do more than you can.</span>
          {{ ceiling() }}
        </p>
      </div>

      @if (loadError(); as e) {
        <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ e }}</span>
        </div>
      }

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Reading what you may hand on…
        </div>
      } @else {
        @if (!minted()) {
          <app-connect-agent
            [skill]="skill()"
            [skillError]="skillError()"
            data-testid="connect-agent-standalone"
          />
        }

        <div hlmCard>
          <div hlmCardHeader>
            <h3 hlmCardTitle>Issue a new key</h3>
            <p hlmCardDescription>
              Switch on what the agent may do, name it, and copy the key it gives you back.
            </p>
          </div>
          <div hlmCardContent>
            @if (!oidc()) {
              <p class="text-sm text-muted-foreground" data-testid="local-mode">
                This instance signs people in locally, and keys are issued in OIDC mode only.
                Existing keys are still listed below and can still be revoked.
              </p>
            } @else if (catalogue().length === 0) {
              <p class="text-sm text-muted-foreground">
                No permission groups came back, so there is nothing to hand on from here.
              </p>
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
        </div>

        <div hlmCard>
          <div hlmCardHeader>
            <h3 hlmCardTitle>Keys you have issued</h3>
            <p hlmCardDescription>
              Everything holding a credential of yours, and the gesture that takes it back.
            </p>
          </div>
          <div hlmCardContent>
            <app-agent-key-list
              [keys]="keys()"
              [catalogue]="catalogue()"
              [revoking]="revoking()"
              [currentSkillVersion]="skill()?.version ?? null"
              [updatingApplications]="updatingApplications()"
              [updateApplicationsError]="updateApplicationsError()"
              [updatingProjects]="updatingProjects()"
              [updateProjectsError]="updateProjectsError()"
              (revoke)="revokeKey($event)"
              (updateApplications)="updateApplications($event)"
              (updateProjects)="updateProjects($event)"
            />
          </div>
        </div>
      }
    </div>
  `,
})
export class AgentKeysComponent implements OnInit {
  private readonly api = inject(ApiAuthService);
  private readonly cfg = inject(AppConfigService);
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
  protected readonly skill = signal<AgentSkill | null>(null);
  protected readonly skillError = signal<string | null>(null);

  protected readonly oidc = computed(() => this.cfg.authMode === 'oidc');

  protected readonly ceiling = computed(() => {
    const all = this.catalogue();
    if (!all.length) return 'What you may hand on is decided by your own permissions.';
    const mine = all.filter((g) => g.grantable).length;
    if (mine === all.length) {
      return `All ${all.length} permission groups on this instance are yours to hand on — the switches below choose how much of that you lend out.`;
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
        this.loadError.set(
          sandboxFailureMessage(err, 'The permission groups could not be read.'),
        );
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
          this.loadError() ??
            sandboxFailureMessage(err, 'Your keys could not be read.'),
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

  protected updateApplications(event: {
    key: ApiKeyResponseDto;
    applicationIds: string[];
  }): void {
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

  protected updateProjects(event: {
    key: ApiKeyResponseDto;
    projectIds: string[];
  }): void {
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
}

function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error
    ?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}
