import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUsersRound,
  lucidePlus,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { IamService } from '../../service/iam.service';
import { CanDirective } from '../../../core/directives/can.directive';
import { GroupRecord, UserRecord } from '../../model/iam.model';

const FIELD =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

@Component({
  selector: 'app-groups-tab',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    CanDirective,
  ],
  providers: [provideIcons({ lucideUsersRound, lucidePlus, lucideTrash2, lucideX })],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-muted-foreground">
          {{ iam.groups().length }} groups · membership is managed in Flui (not the IdP)
        </p>
        <button *fluiCan="'iam:assign-role'" type="button" (click)="showCreate.set(!showCreate())"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 whitespace-nowrap">
          <ng-icon name="lucidePlus" class="h-4 w-4" /> New group
        </button>
      </div>

      @if (showCreate()) {
        <div hlmCard>
          <div hlmCardContent class="pt-5 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <input [class]="fieldClass" placeholder="my-group"
                  [value]="newName()" (input)="newName.set(value($event))" />
                <p class="mt-1 text-[11px] text-muted-foreground">lowercase letters, digits, hyphens</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input [class]="fieldClass" [value]="newDesc()" (input)="newDesc.set(value($event))" />
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="showCreate.set(false)"
                class="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button type="button" (click)="submitCreate()" [disabled]="!canCreate()"
                class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">Create group</button>
            </div>
          </div>
        </div>
      }

      <div class="grid gap-4 md:grid-cols-2">
        @for (g of iam.groups(); track g.name) {
          <div hlmCard>
            <div hlmCardContent class="pt-5 space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <ng-icon name="lucideUsersRound" class="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 class="text-base font-semibold text-foreground truncate">{{ g.name }}</h3>
                    <span hlmBadge variant="outline" class="text-[11px]">{{ g.members.length }}</span>
                  </div>
                  @if (g.description) {
                    <p class="text-sm text-muted-foreground mt-0.5">{{ g.description }}</p>
                  }
                </div>
                <button *fluiCan="'iam:assign-role'" type="button" (click)="iam.removeGroup(g.name)"
                  class="text-muted-foreground hover:text-destructive shrink-0" title="Delete group">
                  <ng-icon name="lucideTrash2" class="h-4 w-4" />
                </button>
              </div>

              <div class="flex flex-wrap gap-1.5">
                @for (m of g.members; track m) {
                  <span class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                    {{ m }}
                    <button *fluiCan="'iam:assign-role'" type="button" (click)="iam.removeGroupMember(g.name, m)"
                      class="text-muted-foreground hover:text-destructive">
                      <ng-icon name="lucideX" class="h-3 w-3" />
                    </button>
                  </span>
                } @empty {
                  <span class="text-xs text-muted-foreground">No members yet.</span>
                }
              </div>

              @if (nonMembers(g).length) {
                <div *fluiCan="'iam:assign-role'">
                  <select [class]="selectClass" (change)="addMember(g.name, $event)">
                    <option value="">Add member…</option>
                    @for (u of nonMembers(g); track u.id) {
                      <option [value]="u.email">{{ u.displayName }} ({{ u.email }})</option>
                    }
                  </select>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class GroupsTabComponent {
  protected readonly iam = inject(IamService);
  protected readonly fieldClass = FIELD;
  protected readonly selectClass = FIELD + ' h-9 pr-8 appearance-none';

  readonly showCreate = signal(false);
  readonly newName = signal('');
  readonly newDesc = signal('');

  readonly canCreate = computed(() =>
    /^[a-z][a-z0-9-]{0,62}$/.test(this.newName().trim()),
  );

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

  addMember(group: string, e: Event): void {
    const email = this.value(e);
    if (email) this.iam.addGroupMember(group, email);
  }
}
