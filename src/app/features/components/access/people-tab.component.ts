import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUserPlus,
  lucideBan,
  lucideRotateCcw,
  lucideLink,
  lucideCopy,
  lucideCheck,
  lucideX,
  lucideShield,
  lucideShieldCheck,
  lucideShieldPlus,
  lucideInfo,
} from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { CanDirective } from '../../../core/directives/can.directive';
import {
  AccessRole,
  ALL_SECTION_KEYS,
  SECTION_LABELS,
  UserRecord,
  UserStatus,
  sectionsForPermissions,
} from '../../model/iam.model';

const FIELD =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

@Component({
  selector: 'app-people-tab',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    CanDirective,
    ConfirmationDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideUserPlus,
      lucideBan,
      lucideRotateCcw,
      lucideLink,
      lucideCopy,
      lucideCheck,
      lucideX,
      lucideShield,
      lucideShieldCheck,
      lucideShieldPlus,
      lucideInfo,
    }),
  ],
  templateUrl: './people-tab.component.html',
})
export class PeopleTabComponent {
  protected readonly iam = inject(IamService);
  protected readonly perms = inject(PermissionService);
  protected readonly fieldClass = FIELD;
  protected readonly selectClass = FIELD + ' pr-8 appearance-none';
  protected readonly rowSelectClass =
    'h-9 w-40 rounded-md border border-input bg-background pl-3 pr-8 text-sm ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-2 appearance-none';

  readonly showInvite = signal(false);
  readonly email = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly role = signal<AccessRole>('viewer');
  readonly sendInvite = signal(true);
  readonly copied = signal(false);

  readonly isAdminAccount = signal(false);
  readonly accessMode = signal<'global' | 'project' | 'group'>('project');
  readonly projectSlug = signal('');
  readonly groupName = signal('');

  private rolePermissions(role: AccessRole): string[] {
    return this.iam.roles().find((r) => r.key === role)?.permissions ?? [];
  }

  private groupSections(name: string): string[] {
    const keys = new Set<string>(['home', 'settings']);
    for (const g of this.iam.grants()) {
      if (g.binding.principal.type !== 'group' || g.binding.principal.ref !== name)
        continue;
      const perms = this.rolePermissions(g.binding.role);
      const isGlobal = g.binding.scope.type === 'global';
      for (const s of sectionsForPermissions(perms, isGlobal)) keys.add(s);
    }
    return ALL_SECTION_KEYS.filter((k) => keys.has(k));
  }

  readonly previewSections = computed<string[]>(() => {
    if (this.isAdminAccount()) return ALL_SECTION_KEYS;
    if (this.accessMode() === 'group') {
      return this.groupName()
        ? this.groupSections(this.groupName())
        : ['home', 'settings'];
    }
    return sectionsForPermissions(
      this.rolePermissions(this.role()),
      this.accessMode() === 'global',
    );
  });

  sectionLabel(key: string): string {
    return SECTION_LABELS[key] ?? key;
  }

  segClass(active: boolean): string {
    return active
      ? 'rounded px-3 py-1.5 bg-primary text-primary-foreground'
      : 'rounded px-3 py-1.5 text-muted-foreground hover:text-foreground';
  }

  readonly pendingGlobals = signal<Record<string, 'none' | AccessRole>>({});

  currentGlobal(u: UserRecord): 'none' | AccessRole {
    return this.iam.globalGrantOf(u.email)?.binding.role ?? 'none';
  }

  pendingGlobal(u: UserRecord): 'none' | AccessRole {
    return this.pendingGlobals()[u.id] ?? this.currentGlobal(u);
  }

  isDirty(u: UserRecord): boolean {
    const p = this.pendingGlobals()[u.id];
    return p != null && p !== this.currentGlobal(u);
  }

  private accessComplete(): boolean {
    if (this.isAdminAccount()) return true;
    switch (this.accessMode()) {
      case 'global':
        return true;
      case 'project':
        return this.projectSlug().length > 0;
      case 'group':
        return this.groupName().length > 0;
    }
  }

  readonly canInvite = computed(
    () =>
      /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(this.email().trim()) &&
      this.firstName().trim().length > 0 &&
      this.lastName().trim().length > 0 &&
      this.accessComplete(),
  );

  value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  selectAll(e: Event): void {
    (e.target as HTMLInputElement).select();
  }

  async copy(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard unavailable; field stays selectable for manual copy */
    }
  }

  onRoleSelect(e: Event): void {
    this.role.set(this.value(e) as AccessRole);
  }

  onRowGlobalChange(id: string, e: Event): void {
    const value = this.value(e) as 'none' | AccessRole;
    this.pendingGlobals.update((m) => ({ ...m, [id]: value }));
  }

  saveGlobal(u: UserRecord): void {
    const value = this.pendingGlobals()[u.id];
    if (value == null || value === this.currentGlobal(u)) return;
    this.iam.setUserGlobalRole(u.email, value === 'none' ? null : value);
  }

  @ViewChild('adminDialog')
  private readonly adminDialog!: ConfirmationDialogComponent;
  readonly pendingAdminUser = signal<UserRecord | null>(null);

  readonly adminDialogTitle = computed(() =>
    this.pendingAdminUser()?.isAdmin
      ? 'Revoke platform admin'
      : 'Make platform admin',
  );
  readonly adminDialogCta = computed(() =>
    this.pendingAdminUser()?.isAdmin ? 'Revoke' : 'Make admin',
  );
  readonly adminDialogMessage = computed(() => {
    const u = this.pendingAdminUser();
    if (!u) return '';
    return u.isAdmin
      ? `Revoke platform admin from ${u.email}? They keep only their explicit grants.`
      : `Make ${u.email} a platform admin? They will see and control everything — beyond any role.`;
  });

  toggleAdmin(u: UserRecord): void {
    this.pendingAdminUser.set(u);
    this.adminDialog.open();
  }

  onAdminConfirmed(): void {
    const u = this.pendingAdminUser();
    if (u) this.iam.setUserAdmin(u.id, !u.isAdmin);
    this.adminDialog.close();
    this.pendingAdminUser.set(null);
  }

  toggleStatus(id: string, current: UserStatus): void {
    this.iam.setUserStatus(id, current === 'disabled' ? 'active' : 'disabled');
  }

  submitInvite(): void {
    if (!this.canInvite()) return;
    this.iam.inviteUser({
      email: this.email().trim(),
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      sendInvite: this.sendInvite(),
      admin: this.isAdminAccount(),
      access: this.isAdminAccount()
        ? undefined
        : {
            mode: this.accessMode(),
            role: this.role(),
            project: this.projectSlug() || undefined,
            group: this.groupName() || undefined,
          },
    });
    this.email.set('');
    this.firstName.set('');
    this.lastName.set('');
    this.role.set('viewer');
    this.sendInvite.set(true);
    this.isAdminAccount.set(false);
    this.accessMode.set('project');
    this.projectSlug.set('');
    this.groupName.set('');
    this.showInvite.set(false);
  }
}
