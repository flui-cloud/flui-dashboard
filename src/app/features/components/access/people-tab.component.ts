import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideUserPlus } from '@ng-icons/lucide';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlTag } from '../../../ui/primitives/tag';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { CanDirective } from '../../../core/directives/can.directive';
import {
  AccessDelta,
  AccessRole,
  UserKind,
  UserRecord,
  UserStatus,
  accessDeltaLines,
} from '../../model/iam.model';
import { AccessPreviewDialog } from './access-preview-dialog';
import { PeopleInviteDialog } from './people-invite-dialog';
import { PeopleInviteResult } from './people-invite-result';

const STATUS_TONE: Record<UserStatus, StatusTone> = {
  active: 'success',
  invited: 'warning',
  disabled: 'error',
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  disabled: 'Disabled',
};

@Component({
  selector: 'app-people-tab',
  imports: [
    FlActionsMenu,
    FlAlert,
    FlPanel,
    FlEmptyState,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    FlTag,
    CanDirective,
    AccessPreviewDialog,
    PeopleInviteDialog,
    PeopleInviteResult,
  ],
  providers: [provideIcons({ lucideUserPlus })],
  host: { class: 'fl-stack' },
  templateUrl: './people-tab.component.html',
})
export class PeopleTabComponent {
  protected readonly iam = inject(IamService);
  protected readonly perms = inject(PermissionService);
  private readonly appConfig = inject(AppConfigService);
  private readonly confirm = inject(ConfirmService);

  /** Decision 111 — see the note on the same signal in AccessComponent. */
  protected readonly identityProvider = this.appConfig.authMode === 'oidc';

  readonly showInvite = signal(false);

  protected readonly kindFilters: ReadonlyArray<{ label: string; kind: UserKind | null }> = [
    { label: 'All', kind: null },
    { label: 'People', kind: 'person' },
    { label: 'Visitors', kind: 'visitor' },
  ];

  showKind(kind: UserKind | null): void {
    if (this.iam.userKind() === kind) return;
    this.iam.userKind.set(kind);
    this.iam.loadUsers();
  }

  protected statusTone(s: UserStatus): StatusTone {
    return STATUS_TONE[s];
  }

  protected statusLabel(s: UserStatus): string {
    return STATUS_LABEL[s];
  }

  protected readonly rowActions = computed(() => {
    const manage = this.perms.can('iam:manage-users');
    const map = new Map<string, MenuAction[]>();
    for (const u of this.iam.users()) map.set(u.id, this.actionsFor(u, manage));
    return map;
  });

  private actionsFor(u: UserRecord, manage: boolean): MenuAction[] {
    if (!manage || u.isBootstrapAdmin || u.isSystemUser) return [];
    const items: MenuAction[] = [];
    if (u.kind !== 'visitor') items.push({ id: 'invite-link', label: 'Generate invite link' });
    if (u.isAdmin) {
      items.push({ id: 'revoke-admin', label: 'Revoke platform admin', danger: true });
    } else if (u.status === 'disabled') {
      items.push({ id: 'enable', label: 'Enable: let them sign in again' });
    } else {
      items.push({
        id: 'disable',
        label: 'Disable: refuse every request and end their demo space',
        danger: true,
        separatorBefore: items.length > 0,
      });
    }
    return items;
  }

  protected onRowAction(u: UserRecord, id: string): void {
    switch (id) {
      case 'invite-link':
        this.iam.createInviteLink(u.id, u.email);
        return;
      case 'revoke-admin':
        void this.toggleAdmin(u);
        return;
      case 'enable':
      case 'disable':
        void this.toggleStatus(u);
        return;
    }
  }

  readonly pendingGlobals = signal<Record<string, 'none' | AccessRole>>({});

  currentGlobal(u: UserRecord): 'none' | AccessRole {
    return this.iam.globalGrantOf(u.email)?.binding.role ?? 'none';
  }

  pendingGlobal(u: UserRecord): 'none' | AccessRole {
    return this.pendingGlobals()[u.id] ?? this.currentGlobal(u);
  }

  canEditGlobal(u: UserRecord): boolean {
    const current = this.currentGlobal(u);
    return current === 'none' || this.iam.isGrantable(current);
  }

  globalRoleName(u: UserRecord): string {
    const current = this.currentGlobal(u);
    return current === 'none' ? 'No global access' : this.iam.roleName(current);
  }

  isDirty(u: UserRecord): boolean {
    const p = this.pendingGlobals()[u.id];
    return p != null && p !== this.currentGlobal(u);
  }

  onRowGlobalChange(id: string, e: Event): void {
    const value = (e.target as HTMLSelectElement).value as 'none' | AccessRole;
    this.pendingGlobals.update((m) => ({ ...m, [id]: value }));
  }

  private readonly roleDialog = viewChild.required<AccessPreviewDialog>('roleDialog');

  readonly pendingRoleUser = signal<UserRecord | null>(null);
  private readonly roleDelta = signal<AccessDelta | null>(null);
  private readonly roleUnknown = signal(false);

  readonly roleDialogMessage = computed(() => {
    if (this.roleUnknown()) {
      return 'What this person reaches could not be read, so what this change takes away is not known. Do not read that as "nothing".';
    }
    return this.roleDelta()?.summary ?? 'Working out what this changes…';
  });

  readonly roleDialogDetails = computed(() => {
    const delta = this.roleDelta();
    return delta ? accessDeltaLines(delta, { identityProvider: this.identityProvider }) : [];
  });

  readonly roleDialogDestructive = computed(
    () => !(this.roleDelta()?.losesNothing && !this.roleUnknown()),
  );

  askSaveGlobal(u: UserRecord): void {
    const value = this.pendingGlobals()[u.id];
    if (value == null || value === this.currentGlobal(u)) return;
    this.pendingRoleUser.set(u);
    this.roleDelta.set(null);
    this.roleUnknown.set(false);
    this.roleDialog().open();

    const existing = this.iam.globalGrantOf(u.email);
    this.iam
      .accessPreview({
        principalType: 'user',
        principalRef: u.email,
        removeGrantIds: existing ? [existing.id] : [],
        add: value === 'none' ? [] : [{ role: value, scopeType: 'global' }],
      })
      .subscribe((delta) => {
        if (this.pendingRoleUser()?.id !== u.id) return;
        this.roleDelta.set(delta);
        this.roleUnknown.set(!delta);
      });
  }

  onRoleChangeConfirmed(): void {
    const u = this.pendingRoleUser();
    if (u) this.saveGlobal(u);
    this.roleDialog().close();
    this.pendingRoleUser.set(null);
  }

  onRoleChangeCancelled(): void {
    this.pendingRoleUser.set(null);
  }

  saveGlobal(u: UserRecord): void {
    const value = this.pendingGlobals()[u.id];
    if (value == null || value === this.currentGlobal(u)) return;
    this.iam.setUserGlobalRole(u.email, value === 'none' ? null : value);
  }

  async toggleAdmin(u: UserRecord): Promise<void> {
    const ok = await this.confirm.confirm(
      u.isAdmin
        ? {
            title: 'Revoke platform admin',
            body: `Revoke platform admin from ${u.email}? They keep only their explicit grants.`,
            confirmLabel: 'Revoke',
            destructive: true,
          }
        : {
            title: 'Make platform admin',
            body: `Make ${u.email} a platform admin? They will see and control everything, beyond any role.`,
            confirmLabel: 'Make admin',
            destructive: true,
          },
    );
    if (ok) this.iam.setUserAdmin(u.id, !u.isAdmin);
  }

  async toggleStatus(u: UserRecord): Promise<void> {
    if (u.status !== 'disabled') {
      const ok = await this.confirm.confirm({
        title: 'Disable this user',
        body: `${u.email} can no longer sign in. Every request they make is refused and their demo space ends.`,
        confirmLabel: 'Disable',
        destructive: true,
      });
      if (!ok) return;
    }
    this.iam.setUserStatus(u.id, u.status === 'disabled' ? 'active' : 'disabled');
  }
}
