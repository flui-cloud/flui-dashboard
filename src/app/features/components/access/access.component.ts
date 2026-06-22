import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideKeyRound,
  lucideUsers,
  lucideUsersRound,
  lucideShield,
  lucideListChecks,
  lucideTrash2,
  lucideInfo,
} from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { CanDirective } from '../../../core/directives/can.directive';
import { GrantBuilderComponent } from './grant-builder.component';
import { PeopleTabComponent } from './people-tab.component';
import { GroupsTabComponent } from './groups-tab.component';
import { RolesTabComponent } from './roles-tab.component';
import { AccessBinding, AccessSelector } from '../../model/iam.model';

type TabId = 'grants' | 'people' | 'groups' | 'roles';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    CanDirective,
    GrantBuilderComponent,
    PeopleTabComponent,
    GroupsTabComponent,
    RolesTabComponent,
  ],
  providers: [
    provideIcons({
      lucideKeyRound,
      lucideUsers,
      lucideUsersRound,
      lucideShield,
      lucideListChecks,
      lucideTrash2,
      lucideInfo,
    }),
  ],
  template: `
    <div class="p-6 max-w-6xl mx-auto space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground shrink-0">
            <ng-icon name="lucideKeyRound" class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-foreground">Access</h2>
            <p class="text-sm text-muted-foreground">Who can do what, on which resources.</p>
          </div>
        </div>
        <button type="button" (click)="showHelp.set(!showHelp())"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
          <ng-icon name="lucideInfo" class="h-3.5 w-3.5" />
          How access works
        </button>
      </div>

      @if (showHelp()) {
        <div hlmCard class="border-primary/30">
          <div hlmCardContent class="pt-5 text-sm text-muted-foreground space-y-2">
            <p><span class="font-medium text-foreground">Deny by default.</span> A member starts with no access. They reach a resource only through an explicit <span class="font-medium text-foreground">grant</span> — given to them directly or via a group.</p>
            <p><span class="font-medium text-foreground">A grant = role × scope.</span> The <span class="font-medium text-foreground">role</span> (Viewer / Editor / Manager) is <em>what</em> they can do; the <span class="font-medium text-foreground">scope</span> (a project, a cluster, or everything) is <em>where</em>.</p>
            <p><span class="font-medium text-foreground">Platform admin is separate.</span> It is not a role — it's an allow-all owner of the whole installation: clusters &amp; infrastructure, cloud providers, backups, and other users. It sits above the role system and outside the grant graph, so a bad policy can't lock you out. Grant it sparingly, from the People tab.</p>
          </div>
        </div>
      }

      <!-- Tab navigation -->
      <div class="border-b border-border">
        <nav class="flex -mb-px gap-1 overflow-x-auto scrollbar-none">
          @for (t of tabs; track t.id) {
            <button type="button" (click)="selectTab(t.id)"
              class="inline-flex items-center gap-1.5 px-3 md:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              [class]="activeTab() === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'">
              <ng-icon [name]="t.icon" class="h-4 w-4" />
              <span>{{ t.label }}</span>
            </button>
          }
        </nav>
      </div>

      @switch (activeTab()) {
        @case ('grants') {
          <div class="space-y-5">
            <!-- Builder (gated) -->
            <app-grant-builder *fluiCan="'iam:assign-role'" />
            @if (!canManage()) {
              <div hlmCard>
                <div hlmCardContent class="pt-6">
                  <p class="text-sm text-muted-foreground">
                    You don't have <span class="font-mono text-xs">iam:assign-role</span> at this scope, so you can't create grants. (This block is hidden by the real builder via <span class="font-mono text-xs">*fluiCan</span>.)
                  </p>
                </div>
              </div>
            }

            <!-- Grants list -->
            <div hlmCard>
              <div hlmCardContent class="pt-6">
                <h3 class="text-sm font-semibold text-foreground mb-3">Grants ({{ iam.grants().length }})</h3>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-muted-foreground border-b border-border">
                        <th class="py-2 pr-4 font-medium">Who</th>
                        <th class="py-2 pr-4 font-medium">Role</th>
                        <th class="py-2 pr-4 font-medium">What</th>
                        <th class="py-2 pr-4 font-medium">Applies to</th>
                        <th class="py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (g of iam.grants(); track g.id) {
                        <tr class="border-b border-border/60 last:border-0">
                          <td class="py-2.5 pr-4">{{ iam.principalDisplay(g.binding.principal) }}</td>
                          <td class="py-2.5 pr-4">
                            <span hlmBadge variant="outline" class="text-xs">{{ iam.roleName(g.binding.role) }}</span>
                          </td>
                          <td class="py-2.5 pr-4 text-muted-foreground">{{ scopeText(g.binding) }}</td>
                          <td class="py-2.5 pr-4 text-muted-foreground">
                            {{ g.binding.scope.type === 'section' ? 'portal section' : matchCount(g.binding) + ' app' + (matchCount(g.binding) === 1 ? '' : 's') }}
                          </td>
                          <td class="py-2.5">
                            <button type="button" (click)="iam.removeGrant(g.id)" *fluiCan="'iam:assign-role'"
                              class="text-muted-foreground hover:text-destructive" title="Remove grant">
                              <ng-icon name="lucideTrash2" class="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      } @empty {
                        <tr><td colspan="5" class="py-6 text-center text-sm text-muted-foreground">No grants yet.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        }
        @case ('people') {
          <app-people-tab />
        }
        @case ('groups') {
          <app-groups-tab />
        }
        @case ('roles') {
          <app-roles-tab />
        }
      }
    </div>
  `,
})
export class AccessComponent implements OnInit {
  protected readonly iam = inject(IamService);
  private readonly perms = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.perms.load();
    this.iam.refresh();
  }

  readonly tabs: TabDef[] = [
    { id: 'grants', label: 'Grants', icon: 'lucideListChecks' },
    { id: 'people', label: 'People', icon: 'lucideUsers' },
    { id: 'groups', label: 'Groups', icon: 'lucideUsersRound' },
    { id: 'roles', label: 'Roles', icon: 'lucideShield' },
  ];

  readonly activeTab = toSignal(
    this.route.paramMap.pipe(map((p) => this.normalizeTab(p.get('tab')))),
    { initialValue: 'grants' satisfies TabId },
  );

  readonly showHelp = signal(false);
  readonly canManage = computed(() => this.perms.can('iam:assign-role'));

  selectTab(id: TabId): void {
    this.router.navigate(['/management/access', id]);
  }

  private normalizeTab(value: string | null): TabId {
    return this.tabs.some((t) => t.id === value) ? (value as TabId) : 'grants';
  }

  scopeText(b: AccessBinding): string {
    const s = b.scope;
    switch (s.type) {
      case 'global':
        return 'Everything';
      case 'cluster':
        return `cluster ${this.iam.clusterName(s.cluster)}`;
      case 'section':
        return `section ${this.iam.sectionName(s.section)}`;
      case 'selector':
        return this.selectorText(s.selector);
    }
  }

  private selectorText(sel: AccessSelector): string {
    if (sel.slugs?.length) {
      return sel.slugs.length === 1 ? `app ${sel.slugs[0]}` : `${sel.slugs.length} apps`;
    }
    if (sel.tags?.length) return `tagged ${sel.tags.join(', ')}`;
    if (sel.kind) return `${sel.kind.toLowerCase()} apps`;
    if (sel.project) return `project ${sel.project}`;
    if (sel.type) return `${sel.type} apps`;
    if (sel.clusterName) return `cluster ${sel.clusterName}`;
    if (sel.provider) return `provider ${sel.provider}`;
    return 'selector';
  }

  matchCount(b: AccessBinding): number {
    return this.iam.matchApps(b.scope).length;
  }
}
