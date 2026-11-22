import { Component, computed, inject, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { IamService } from '../../service/iam.service';
import {
  ALL_SECTION_KEYS,
  AccessRole,
  SECTION_LABELS,
  sectionsForPermissions,
} from '../../model/iam.model';

type AccessMode = 'global' | 'project' | 'group';

@Component({
  selector: 'app-people-invite-dialog',
  imports: [FlField, FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideX })],
  template: `
    <div
      class="fl-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      (click)="closed.emit()"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="fl-dialog fl-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-invite-title"
        (click)="$event.stopPropagation()"
      >
        <header class="fl-dialog__header">
          <h2 class="fl-dialog__title" id="people-invite-title">Invite user</h2>
          <button type="button" class="fl-dialog__close" aria-label="Close" (click)="closed.emit()">
            <fl-icon name="lucideX" />
          </button>
        </header>
        <div class="fl-dialog__body">
          <fl-field label="Email" for="pt-email">
            <div class="fl-input fl-input--lg">
              <input
                id="pt-email"
                type="email"
                placeholder="person@company.com"
                [value]="email()"
                (input)="email.set(value($event))"
              />
            </div>
          </fl-field>
          <div class="fl-grid-2">
            <fl-field label="First name" for="pt-first">
              <div class="fl-input fl-input--lg">
                <input id="pt-first" [value]="firstName()" (input)="firstName.set(value($event))" />
              </div>
            </fl-field>
            <fl-field label="Last name" for="pt-last">
              <div class="fl-input fl-input--lg">
                <input id="pt-last" [value]="lastName()" (input)="lastName.set(value($event))" />
              </div>
            </fl-field>
          </div>

          <fieldset class="fl-fieldset">
            <legend>Account type</legend>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="pt-account-type"
                [checked]="!isAdminAccount()"
                (change)="isAdminAccount.set(false)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Member</span>
                <span class="fl-radiocard__desc"
                  >Gets only the access you grant below. The role is what they can do; the scope is
                  where.</span
                >
              </span>
            </label>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="pt-account-type"
                [checked]="isAdminAccount()"
                (change)="isAdminAccount.set(true)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">Platform admin</span>
                <span class="fl-radiocard__desc"
                  >Sees and controls everything, beyond any role: clusters, infrastructure,
                  providers, backups and other users. Use sparingly.</span
                >
              </span>
            </label>
          </fieldset>

          @if (!isAdminAccount()) {
            <div class="fl-grid-2">
              <fl-field label="Role" for="pt-role">
                <span class="fl-select-wrap">
                  <select id="pt-role" class="fl-select" (change)="onRoleSelect($event)">
                    @for (r of iam.grantableRoles(); track r.key) {
                      <option [value]="r.key" [selected]="role() === r.key">{{ r.name }}</option>
                    }
                  </select>
                </span>
              </fl-field>
              <fl-field label="Applies to" for="pt-applies">
                <span class="fl-select-wrap">
                  <select id="pt-applies" class="fl-select" (change)="onModeSelect($event)">
                    <option value="project" [selected]="accessMode() === 'project'">
                      A project
                    </option>
                    <option value="group" [selected]="accessMode() === 'group'">A group</option>
                    <option value="global" [selected]="accessMode() === 'global'">
                      Everything (global)
                    </option>
                  </select>
                </span>
              </fl-field>
            </div>

            @if (accessMode() === 'project') {
              @if (iam.projects().length) {
                <fl-field label="Project" for="pt-project">
                  <span class="fl-select-wrap">
                    <select
                      id="pt-project"
                      class="fl-select"
                      (change)="projectSlug.set(value($event))"
                    >
                      <option value="" [selected]="!projectSlug()">Select a project</option>
                      @for (p of iam.projects(); track p.slug) {
                        <option [value]="p.slug" [selected]="projectSlug() === p.slug">
                          {{ p.name }}
                        </option>
                      }
                    </select>
                  </span>
                </fl-field>
              } @else {
                <p class="text-fl-body-sm text-fl-ink-muted">
                  No projects yet. Create one, or grant a group or global access.
                </p>
              }
            }

            @if (accessMode() === 'group') {
              @if (iam.groups().length) {
                <fl-field label="Group" for="pt-group">
                  <span class="fl-select-wrap">
                    <select id="pt-group" class="fl-select" (change)="groupName.set(value($event))">
                      <option value="" [selected]="!groupName()">Select a group</option>
                      @for (g of iam.groups(); track g.name) {
                        <option [value]="g.name" [selected]="groupName() === g.name">
                          {{ g.name }}
                        </option>
                      }
                    </select>
                  </span>
                </fl-field>
              } @else {
                <p class="text-fl-body-sm text-fl-ink-muted">
                  No groups yet. Create one in the Groups tab, or grant a project or global access.
                </p>
              }
            }
          }

          <div class="flex flex-col gap-2">
            <span class="text-fl-body-sm text-fl-ink-secondary">
              This user will see {{ previewSections().length }} section{{
                previewSections().length === 1 ? '' : 's'
              }}
            </span>
            <div class="flex flex-wrap gap-1.5">
              @for (s of previewSections(); track s) {
                <fl-tag>{{ sectionLabel(s) }}</fl-tag>
              }
            </div>
          </div>

          <label class="fl-check">
            <input
              type="checkbox"
              [checked]="sendInvite()"
              (change)="sendInvite.set(checked($event))"
            />
            <span>Invite with a link, otherwise set a temporary password</span>
          </label>
        </div>
        <footer class="fl-dialog__footer">
          <button flButton="ghost" type="button" (click)="closed.emit()">Cancel</button>
          <button flButton="primary" type="button" [disabled]="!canInvite()" (click)="submit()">
            {{ sendInvite() ? 'Create and get link' : 'Create user' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class PeopleInviteDialog {
  protected readonly iam = inject(IamService);
  readonly closed = output<void>();

  readonly email = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly role = signal<AccessRole>('viewer');
  readonly sendInvite = signal(true);
  readonly isAdminAccount = signal(false);
  readonly accessMode = signal<AccessMode>('project');
  readonly projectSlug = signal('');
  readonly groupName = signal('');

  private rolePermissions(role: AccessRole): string[] {
    return this.iam.roles().find((r) => r.key === role)?.permissions ?? [];
  }

  private groupSections(name: string): string[] {
    const keys = new Set<string>(['home', 'settings']);
    for (const g of this.iam.grants()) {
      if (g.binding.principal.type !== 'group' || g.binding.principal.ref !== name) continue;
      const perms = this.rolePermissions(g.binding.role);
      const isGlobal = g.binding.scope.type === 'global';
      for (const s of sectionsForPermissions(perms, isGlobal)) keys.add(s);
    }
    return ALL_SECTION_KEYS.filter((k) => keys.has(k));
  }

  readonly previewSections = computed<string[]>(() => {
    if (this.isAdminAccount()) return ALL_SECTION_KEYS;
    if (this.accessMode() === 'group') {
      return this.groupName() ? this.groupSections(this.groupName()) : ['home', 'settings'];
    }
    return sectionsForPermissions(
      this.rolePermissions(this.role()),
      this.accessMode() === 'global',
    );
  });

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

  protected sectionLabel(key: string): string {
    return SECTION_LABELS[key] ?? key;
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  protected onRoleSelect(e: Event): void {
    this.role.set(this.value(e) as AccessRole);
  }

  protected onModeSelect(e: Event): void {
    const v = this.value(e);
    this.accessMode.set(v === 'project' || v === 'group' ? v : 'global');
  }

  submit(): void {
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
    this.closed.emit();
  }
}
