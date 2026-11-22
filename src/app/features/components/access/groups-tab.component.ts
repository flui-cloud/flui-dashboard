import { Component, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2, lucideX } from '@ng-icons/lucide';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlField } from '../../../ui/patterns/field';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { IamService } from '../../service/iam.service';
import { CanDirective } from '../../../core/directives/can.directive';
import { GroupRecord, UserRecord } from '../../model/iam.model';

@Component({
  selector: 'app-groups-tab',
  imports: [FlField, FlPanel, FlEmptyState, FlTable, FlButton, FlIcon, FlTag, CanDirective],
  providers: [provideIcons({ lucidePlus, lucideTrash2, lucideX })],
  host: { class: 'fl-stack' },
  template: `
    @if (showCreate()) {
      <fl-panel title="New group">
        <div class="flex flex-col gap-4">
          <div class="fl-grid-2">
            <fl-field label="Name" for="group-name" hint="Lowercase letters, digits and hyphens.">
              <div class="fl-input fl-input--lg">
                <input
                  id="group-name"
                  class="fl-mono"
                  placeholder="my-group"
                  [value]="newName()"
                  (input)="newName.set(value($event))"
                />
              </div>
            </fl-field>
            <fl-field label="Description" for="group-description">
              <div class="fl-input fl-input--lg">
                <input
                  id="group-description"
                  [value]="newDesc()"
                  (input)="newDesc.set(value($event))"
                />
              </div>
            </fl-field>
          </div>
          <div class="flex justify-end gap-2">
            <button flButton="ghost" type="button" (click)="showCreate.set(false)">Cancel</button>
            <button
              flButton="primary"
              type="button"
              [disabled]="!canCreate()"
              (click)="submitCreate()"
            >
              Create group
            </button>
          </div>
        </div>
      </fl-panel>
    }

    <fl-panel title="Groups" [count]="iam.groups().length" [flush]="true">
      <button
        *fluiCan="'iam:assign-role'"
        panelActions
        flButton
        size="sm"
        type="button"
        [attr.aria-expanded]="showCreate()"
        (click)="showCreate.set(!showCreate())"
      >
        <fl-icon name="lucidePlus" [size]="14" />
        New group
      </button>
      <p class="border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        Membership is managed in Flui, not in the identity provider.
      </p>
      @if (iam.groups().length) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col" class="is-num">Members</th>
                <th scope="col">Who is in it</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (g of iam.groups(); track g.name) {
                <tr>
                  <td class="whitespace-normal">
                    <div class="fl-cell-name flex flex-col gap-0.5">
                      <span class="fl-mono">{{ g.name }}</span>
                      @if (g.description) {
                        <span class="text-fl-caption text-fl-ink-muted">{{ g.description }}</span>
                      }
                    </div>
                  </td>
                  <td class="is-num">{{ g.members.length }}</td>
                  <td class="whitespace-normal">
                    <div class="flex flex-wrap items-center gap-1.5">
                      @for (m of g.members; track m) {
                        <fl-tag>
                          <span class="fl-mono">{{ m }}</span>
                          <button
                            *fluiCan="'iam:assign-role'"
                            type="button"
                            class="ml-1 inline-flex text-fl-ink-muted hover:text-fl-ink"
                            [attr.aria-label]="'Remove ' + m + ' from ' + g.name"
                            (click)="iam.removeGroupMember(g.name, m)"
                          >
                            <fl-icon name="lucideX" [size]="13" />
                          </button>
                        </fl-tag>
                      } @empty {
                        <span class="text-fl-ink-muted">No members yet.</span>
                      }
                      @if (nonMembers(g).length) {
                        <span class="fl-select-wrap" *fluiCan="'iam:assign-role'">
                          <select
                            class="fl-select fl-select--sm"
                            [attr.aria-label]="'Add a member to ' + g.name"
                            (change)="addMember(g.name, $event)"
                          >
                            <option value="">Add member</option>
                            @for (u of nonMembers(g); track u.id) {
                              <option [value]="u.email">{{ u.displayName }} ({{ u.email }})</option>
                            }
                          </select>
                        </span>
                      }
                    </div>
                  </td>
                  <td class="is-fit">
                    <button
                      *fluiCan="'iam:assign-role'"
                      flButton="ghost"
                      size="sm"
                      type="button"
                      [iconOnly]="true"
                      title="Delete group"
                      [attr.aria-label]="'Delete group ' + g.name"
                      (click)="confirmRemoveGroup(g)"
                    >
                      <fl-icon name="lucideTrash2" [size]="14" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state
          [compact]="true"
          title="No groups yet"
          body="A group lets one grant reach several people."
        />
      }
    </fl-panel>
  `,
})
export class GroupsTabComponent {
  protected readonly iam = inject(IamService);
  private readonly confirm = inject(ConfirmService);

  constructor() {
    if (this.iam.userKind() !== null) {
      this.iam.userKind.set(null);
      this.iam.loadUsers();
    }
  }

  readonly showCreate = signal(false);
  readonly newName = signal('');
  readonly newDesc = signal('');

  readonly canCreate = computed(() => /^[a-z][a-z0-9-]{0,62}$/.test(this.newName().trim()));

  value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  nonMembers(g: GroupRecord): UserRecord[] {
    return this.iam.users().filter((u) => !g.members.includes(u.email));
  }

  submitCreate(): void {
    if (!this.canCreate()) return;
    this.iam.createGroup(this.newName().trim(), this.newDesc().trim() || undefined);
    this.newName.set('');
    this.newDesc.set('');
    this.showCreate.set(false);
  }

  async confirmRemoveGroup(g: GroupRecord): Promise<void> {
    const consequence = g.members.length
      ? `${g.members.length} member(s) lose whatever this group granted them.`
      : 'Any access policy bound to this group stops applying.';
    const ok = await this.confirm.confirm({
      title: 'Delete group',
      body: `Delete ${g.name}? This action cannot be undone. ${consequence}`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) this.iam.removeGroup(g.name);
  }

  addMember(group: string, e: Event): void {
    const email = this.value(e);
    if (email) this.iam.addGroupMember(group, email);
  }
}
