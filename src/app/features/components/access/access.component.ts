import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTabs, TabLink } from '../../../ui/patterns/tabs';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { IamService } from '../../service/iam.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import {
  AccessSurfaceInput,
  AccessSurfaceRevision,
  AccessTabId,
  buildAccessSurface,
  presentedContent,
} from './access-surface';
import { AccessGrantsComponent } from './access-grants';
import { AccessPreviewDialog } from './access-preview-dialog';
import { PeopleTabComponent } from './people-tab.component';
import { GroupsTabComponent } from './groups-tab.component';
import { RolesTabComponent } from './roles-tab.component';
import { TemporaryAccessTabComponent } from './temporary-access-tab.component';
import { ActivityTabComponent } from './activity-tab.component';
import {
  AccessBinding,
  AccessDelta,
  AccessSelector,
  GrantRecord,
  accessDeltaLines,
} from '../../model/iam.model';

type TabId = AccessTabId;

interface TabDef {
  id: TabId;
  label: string;
}

@Component({
  selector: 'app-access',
  imports: [
    FlPageHeader,
    FlPanel,
    FlTabs,
    FlButton,
    FlIcon,
    AccessGrantsComponent,
    AccessPreviewDialog,
    PeopleTabComponent,
    GroupsTabComponent,
    RolesTabComponent,
    TemporaryAccessTabComponent,
    ActivityTabComponent,
  ],
  providers: [provideIcons({ lucideInfo })],
  template: `
    <div class="fl-page">
      <fl-page-header title="Access">
        <span headerMeta>Who can do what, on which resources.</span>
        <ng-container headerActions>
          <button
            flButton="ghost"
            type="button"
            [attr.aria-expanded]="showHelp()"
            (click)="showHelp.set(!showHelp())"
          >
            <fl-icon name="lucideInfo" />
            How access works
          </button>
        </ng-container>
        <fl-tabs [tabs]="tabLinks" label="Access sections" />
      </fl-page-header>

      @if (showHelp()) {
        <fl-panel title="How access works">
          <div class="flex flex-col gap-2 text-fl-body-sm text-fl-ink-secondary">
            <p>
              <span class="font-medium text-fl-ink">Deny by default.</span> A member starts with no
              access. They reach a resource only through an explicit
              <span class="font-medium text-fl-ink">grant</span>, given to them directly or through
              a group.
            </p>
            <p>
              <span class="font-medium text-fl-ink">A grant is a role on a scope.</span> The
              <span class="font-medium text-fl-ink">role</span> (Viewer, Operator, Maintainer,
              Owner) is <em>what</em> they can do, and each step contains the one below it. The
              <span class="font-medium text-fl-ink">scope</span> (a project, a cluster, or
              everything) is <em>where</em>.
            </p>
            <p>
              <span class="font-medium text-fl-ink">Owner is the top of the ladder.</span> It
              carries everything, everywhere, including who else may run this installation, and only
              an owner may confer or revoke it. A maintainer can hand out the other three and no
              more.
            </p>
            @if (identityProvider) {
              <p>
                <span class="font-medium text-fl-ink">This list is what Flui grants.</span> A rung
                can also be conferred in your identity provider. It counts at sign-in but is held
                there, so it is neither listed nor revocable here, and a preview of what a change
                takes away cannot see it either.
              </p>
            }
            <p>
              <span class="font-medium text-fl-ink">Platform admin is a separate flag,</span>
              older than the roles and outside the grant graph. It still governs a handful of
              screens, such as creating and disabling accounts and projects, so it is what those
              buttons check. It is not a grant and does not appear in the list below.
            </p>
          </div>
        </fl-panel>
      }

      @switch (activeTab()) {
        @case ('grants') {
          <app-access-grants
            [identityProvider]="identityProvider"
            [canManage]="canManage()"
            [readOnly]="readOnly()"
            [scopeText]="scopeTextFn"
            (remove)="askRemove($event)"
          />
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
        @case ('temporary') {
          <app-temporary-access-tab [scopeText]="scopeTextFn" (revoke)="askRemove($event)" />
        }
        @case ('activity') {
          <app-activity-tab />
        }
      }

      <app-access-preview-dialog
        #revokeDialog
        title="Remove this grant"
        confirmLabel="Remove"
        [message]="revokeMessage()"
        [details]="revokeDetails()"
        (confirmed)="onRemoveConfirmed()"
        (cancelled)="onRemoveCancelled()"
      />
    </div>
  `,
})
export class AccessComponent implements OnInit, OnDestroy {
  protected readonly iam = inject(IamService);
  private readonly perms = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly appConfig = inject(AppConfigService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  /**
   * Decision 111: the screen listed `iam_role_bindings` and read as exhaustive.
   * It stops being exhaustive the moment a rung can arrive from the provider
   * (decision 101), which only happens in `oidc` mode — both local strategies
   * hand the guards an empty `roles` claim, so in `local` mode the list really
   * is everything and the caveat would be noise.
   */
  protected readonly identityProvider = this.appConfig.authMode === 'oidc';

  private readonly surfaceRevision = new AccessSurfaceRevision();

  readonly surface = computed(() => {
    const input: AccessSurfaceInput = {
      activeTab: this.activeTab() as AccessTabId,
      grants: this.iam.grants(),
      users: this.iam.users(),
      usersError: this.iam.usersError(),
      groups: this.iam.groups(),
      roles: this.iam.roles(),
      roleName: (role) => this.iam.roleName(role),
      scopeText: (binding) => this.scopeText(binding),
    };
    const content = presentedContent(input);
    return buildAccessSurface(input, {
      revision: this.surfaceRevision.next(content),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  ngOnInit(): void {
    this.perms.load();
    this.iam.refresh();
  }

  ngOnDestroy(): void {
    this.currentSurface.set(null);
  }

  readonly tabs: TabDef[] = [
    { id: 'grants', label: 'Grants' },
    { id: 'people', label: 'People' },
    { id: 'groups', label: 'Groups' },
    { id: 'roles', label: 'Roles' },
    { id: 'temporary', label: 'Temporary access' },
    { id: 'activity', label: 'Activity' },
  ];

  protected readonly tabLinks: readonly TabLink[] = this.tabs.map((t) => ({
    label: t.label,
    link: ['/management/access', t.id],
  }));

  readonly activeTab = toSignal(
    this.route.paramMap.pipe(map((p) => this.normalizeTab(p.get('tab')))),
    { initialValue: 'grants' satisfies TabId },
  );

  readonly showHelp = signal(false);
  readonly canManage = computed(() => this.perms.can('iam:assign-role'));
  protected readonly readOnly = computed(() => this.perms.isSectionReadOnly('access'));

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

  readonly scopeTextFn = (b: AccessBinding): string => this.scopeText(b);

  private readonly revokeDialog = viewChild.required<AccessPreviewDialog>('revokeDialog');

  readonly pendingRevoke = signal<GrantRecord | null>(null);
  private readonly revokeDelta = signal<AccessDelta | null>(null);
  private readonly revokeUnknown = signal(false);

  readonly revokeMessage = computed(() => {
    if (this.revokeUnknown()) {
      return 'What this grant reaches could not be read, so what its holder loses is not known. Do not read that as "nothing".';
    }
    return this.revokeDelta()?.summary ?? 'Checking what this takes away…';
  });

  readonly revokeDetails = computed(() => {
    const delta = this.revokeDelta();
    return delta ? accessDeltaLines(delta, { identityProvider: this.identityProvider }) : [];
  });

  askRemove(grant: GrantRecord): void {
    this.pendingRevoke.set(grant);
    this.revokeDelta.set(null);
    this.revokeUnknown.set(false);
    this.revokeDialog().open();
    this.iam.revocationPreview(grant.id).subscribe((delta) => {
      if (this.pendingRevoke()?.id !== grant.id) return;
      this.revokeDelta.set(delta);
      this.revokeUnknown.set(!delta);
    });
  }

  onRemoveConfirmed(): void {
    const grant = this.pendingRevoke();
    if (grant) this.iam.removeGrant(grant.id);
    this.revokeDialog().close();
    this.pendingRevoke.set(null);
  }

  onRemoveCancelled(): void {
    this.pendingRevoke.set(null);
  }
}
