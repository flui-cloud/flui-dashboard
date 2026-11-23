import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { ConfirmService } from '../../../../ui/overlays/confirm';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlEmptyState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlStatus } from '../../../../ui/primitives/status';
import { FlTag } from '../../../../ui/primitives/tag';
import { AgentKeyApplicationsService } from './agent-key-applications.service';
import { AgentKeyProjectsService } from './agent-key-projects.service';
import { AgentKeyPermissionsEditorComponent } from './agent-key-permissions-editor.component';
import { AgentKeyReachEditor } from './agent-key-reach-editor';
import { EditTarget, KeyRow, keyRows, reachLine, revokeQuestion } from './agent-key-rows';

@Component({
  selector: 'app-agent-key-list',
  imports: [
    DatePipe,
    FlAlert,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
    AgentKeyPermissionsEditorComponent,
    AgentKeyReachEditor,
  ],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  template: `
    @if (rows().length === 0) {
      <fl-empty-state
        [compact]="true"
        title="No keys yet"
        body="Nothing is holding a credential of yours."
        data-testid="no-keys"
      />
    } @else {
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Reach</th>
              <th scope="col">Last contact</th>
              <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.key.id) {
              @let id = row.key.id;
              @let edit = editing()?.keyId === id ? editing()!.field : null;
              <tr [attr.data-testid]="'key-' + id">
                <td class="is-wrap">
                  <div class="flex flex-col gap-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ row.key.name }}</span>
                      @if (row.key.revoked) {
                        <fl-status tone="neutral" label="Revoked" />
                      } @else if (row.expired) {
                        <fl-status tone="neutral" label="Expired" />
                      }
                      @if (row.warn) {
                        <fl-status
                          tone="warning"
                          label="Wider than its name"
                          data-testid="beyond-groups"
                        />
                      }
                      @if (row.key.current) {
                        <fl-tag data-testid="current-key">You are signed in with this</fl-tag>
                      }
                    </div>
                    <span class="text-fl-ink-muted" [attr.data-testid]="'headline-' + id">{{
                      row.surface.headline
                    }}</span>
                    @if (row.surface.groups.length) {
                      <span class="flex flex-wrap gap-1">
                        @for (g of row.surface.groups; track g.key) {
                          <fl-tag [title]="g.summary">{{ g.label }}</fl-tag>
                        }
                      </span>
                    }
                    <button
                      type="button"
                      class="fl-link inline-flex items-center gap-1 self-start text-fl-caption"
                      [attr.aria-expanded]="isOpen(id)"
                      (click)="toggleDetails(id)"
                    >
                      <fl-icon
                        [name]="isOpen(id) ? 'lucideChevronDown' : 'lucideChevronRight'"
                        [size]="13"
                      />
                      Details
                    </button>
                  </div>
                </td>
                <td class="is-wrap text-fl-ink-muted" [attr.data-testid]="'apps-' + id">
                  {{ reach(row) }}
                </td>
                <td class="is-wrap">
                  <div class="flex flex-col gap-1">
                    <span class="text-fl-ink-muted" [attr.data-testid]="'when-' + id">
                      Created {{ row.key.createdAt | date: 'medium' }}
                      @if (row.key.expiresAt) {
                        · {{ row.expired ? 'expired' : 'expires' }}
                        {{ row.key.expiresAt | date: 'medium' }}
                      } @else {
                        · no expiry
                      }
                      · {{ row.connection.seen }}
                    </span>
                    <span [attr.data-testid]="'connection-' + id">
                      @if (row.connection.outOfDate) {
                        <fl-status tone="warning" [label]="connectionText(row)" />
                      } @else {
                        <span class="text-fl-ink-muted">{{ connectionText(row) }}</span>
                      }
                    </span>
                  </div>
                </td>
                <td class="is-fit">
                  @if (!row.key.revoked) {
                    <span class="flex items-center gap-1">
                      @if (row.key.scopes?.length) {
                        <button
                          flButton="ghost"
                          size="sm"
                          type="button"
                          [attr.aria-pressed]="edit === 'permissions'"
                          [attr.data-testid]="'edit-permissions-' + id"
                          (click)="toggleEdit(row.key, 'permissions')"
                        >
                          Permissions
                        </button>
                      }
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [attr.aria-pressed]="edit === 'applications'"
                        [attr.data-testid]="'edit-applications-' + id"
                        (click)="toggleEdit(row.key, 'applications')"
                      >
                        Applications
                      </button>
                      <button
                        flButton="ghost"
                        size="sm"
                        type="button"
                        [attr.aria-pressed]="edit === 'projects'"
                        [attr.data-testid]="'edit-projects-' + id"
                        (click)="toggleEdit(row.key, 'projects')"
                      >
                        Projects
                      </button>
                      <button
                        flButton="danger"
                        size="sm"
                        type="button"
                        [attr.data-testid]="'revoke-' + id"
                        [disabled]="revoking() === id"
                        (click)="ask(row.key)"
                      >
                        {{ revoking() === id ? 'Revoking…' : 'Revoke' }}
                      </button>
                    </span>
                  }
                </td>
              </tr>
              <tr [hidden]="!isOpen(id) && !edit">
                <td colspan="4" class="whitespace-normal">
                  <div class="flex flex-col gap-3 py-1">
                    <div class="flex flex-col gap-2" [class.hidden]="!isOpen(id)">
                      @if (row.surface.caution; as caution) {
                        <fl-alert
                          tone="warning"
                          title="Does more than its name"
                          [attr.data-testid]="'caution-' + id"
                          >{{ caution }}</fl-alert
                        >
                      }
                      <p class="m-0 fl-mono fl-muted break-all">{{ row.scopes }}</p>
                    </div>
                    @if (edit === 'permissions') {
                      <app-agent-key-permissions-editor
                        [attr.data-testid]="'edit-permissions-panel-' + id"
                        [catalogue]="catalogue()"
                        [scopes]="row.key.scopes ?? []"
                        [saving]="updatingScopes() === id"
                        [error]="updateScopesError()"
                        (save)="saveScopes(row.key, $event)"
                        (cancelled)="editing.set(null)"
                      />
                    } @else if (edit === 'applications') {
                      <app-agent-key-reach-editor
                        field="applications"
                        [attr.data-testid]="'edit-applications-panel-' + id"
                        [keyId]="id"
                        [selected]="row.key.applicationIds ?? undefined"
                        [saving]="updatingApplications() === id"
                        [error]="updateApplicationsError()"
                        (picked)="editPicked.set($event)"
                        (save)="saveApplications(row.key)"
                        (cancelled)="editing.set(null)"
                      />
                    } @else if (edit === 'projects') {
                      <app-agent-key-reach-editor
                        field="projects"
                        [attr.data-testid]="'edit-projects-panel-' + id"
                        [keyId]="id"
                        [selected]="row.key.projectIds ?? undefined"
                        [saving]="updatingProjects() === id"
                        [error]="updateProjectsError()"
                        (picked)="editPicked.set($event)"
                        (save)="saveProjects(row.key)"
                        (cancelled)="editing.set(null)"
                      />
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AgentKeyListComponent {
  readonly keys = input.required<ApiKeyResponseDto[]>();
  readonly catalogue = input.required<PermissionGroupDto[]>();
  readonly revoking = input<string | null>(null);
  readonly currentSkillVersion = input<string | null>(null);
  readonly updatingApplications = input<string | null>(null);
  readonly updateApplicationsError = input<string | null>(null);
  readonly updatingProjects = input<string | null>(null);
  readonly updateProjectsError = input<string | null>(null);
  readonly updatingScopes = input<string | null>(null);
  readonly updateScopesError = input<string | null>(null);

  readonly revoke = output<ApiKeyResponseDto>();
  readonly updateApplications = output<{
    key: ApiKeyResponseDto;
    applicationIds: string[];
  }>();
  readonly updateProjects = output<{
    key: ApiKeyResponseDto;
    projectIds: string[];
  }>();
  readonly updateScopes = output<{ key: ApiKeyResponseDto; scopes: string[] }>();

  private readonly confirmService = inject(ConfirmService);
  private readonly appsService = inject(AgentKeyApplicationsService);
  private readonly projectsService = inject(AgentKeyProjectsService);
  protected readonly editing = signal<EditTarget | null>(null);
  private readonly openRows = signal<ReadonlySet<string>>(new Set());
  protected readonly editPicked = signal<string[]>([]);
  private readonly appNamesById = signal<Map<string, string>>(new Map());
  private readonly projectNamesById = signal<Map<string, string>>(new Map());

  constructor() {
    let saving: string | null = null;
    effect(() => {
      const now = this.updatingScopes();
      if (saving && !now && !this.updateScopesError()) this.editing.set(null);
      saving = now;
    });
    this.appsService.list().subscribe((apps) => {
      this.appNamesById.set(new Map(apps.map((a) => [a.id, a.name])));
    });
    this.projectsService.list().subscribe((projects) => {
      this.projectNamesById.set(new Map(projects.map((p) => [p.id, p.name])));
    });
  }

  protected readonly rows = computed<KeyRow[]>(() =>
    keyRows(
      this.keys(),
      this.catalogue(),
      this.appNamesById(),
      this.projectNamesById(),
      this.currentSkillVersion(),
    ),
  );

  protected isOpen(id: string): boolean {
    return this.openRows().has(id);
  }

  protected toggleDetails(id: string): void {
    const next = new Set(this.openRows());
    if (!next.delete(id)) next.add(id);
    this.openRows.set(next);
  }

  protected reach(row: KeyRow): string {
    return reachLine(row);
  }

  protected connectionText(row: KeyRow): string {
    const never = row.connection.everUsed ? '' : 'Never spoken to this instance. ';
    return `${never}${row.connection.skill}`;
  }

  protected toggleEdit(key: ApiKeyResponseDto, field: EditTarget['field']): void {
    const current = this.editing();
    if (current?.keyId === key.id && current.field === field) {
      this.editing.set(null);
      return;
    }
    if (field !== 'permissions') {
      this.editPicked.set((field === 'applications' ? key.applicationIds : key.projectIds) ?? []);
    }
    this.editing.set({ keyId: key.id, field });
  }

  protected saveApplications(key: ApiKeyResponseDto): void {
    this.updateApplications.emit({ key, applicationIds: this.editPicked() });
    this.editing.set(null);
  }

  protected saveScopes(key: ApiKeyResponseDto, scopes: string[]): void {
    this.updateScopes.emit({ key, scopes });
  }

  protected saveProjects(key: ApiKeyResponseDto): void {
    this.updateProjects.emit({ key, projectIds: this.editPicked() });
    this.editing.set(null);
  }

  protected async ask(key: ApiKeyResponseDto): Promise<void> {
    const ok = await this.confirmService.confirm(
      revokeQuestion(key, this.catalogue(), this.currentSkillVersion()),
    );
    if (ok) this.revoke.emit(key);
  }
}
