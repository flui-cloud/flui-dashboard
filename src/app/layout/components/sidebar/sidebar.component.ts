import { SystemAppsPreference } from '../../../core/services/system-apps-preference.service';
import { SandboxService } from '../../../core/services/sandbox.service';
import { userBadge } from './user-badge';
import { Component, computed, inject, input, viewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLayoutDashboard,
  lucideServer,
  lucideReceipt,
  lucideHardDrive,
  lucideNetwork,
  lucideDatabase,
  lucideZap,
  lucideGitBranch,
  lucideRocket,
  lucideChartBar,
  lucideShield,
  lucideSettings,
  lucideUser,
  lucideCreditCard,
  lucideLogOut,
  lucideCircleHelp,
  lucideCloud,
  lucideActivity,
  lucideCircleAlert,
  lucideFileText,
  lucideKey,
  lucideGlobe,
  lucideScale,
  lucideCode,
  lucideContainer,
  lucideLayers,
  lucideBinoculars,
  lucideMessageCircleWarning,
  lucideKeyRound,
  lucideFolders,
  lucideCpu,
  lucideShieldCheck,
  lucideShieldPlus,
  lucidePackage,
  lucideBoxes,
  lucideChartNoAxesColumnIncreasing,
  lucideStore,
  lucideArchive,
  lucideArrowRightLeft,
  lucideDownload,
  lucideMail,
  lucideGithub,
  lucideBot,
  lucideBookOpen,
  lucideWaypoints,
} from '@ng-icons/lucide';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { WORKLOAD_LIST_LABEL, WORKLOAD_LIST_ROUTE, openedWorkloadList } from '../../../features/model/workload-list';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BrnMenuTriggerDirective } from '@spartan-ng/brain/menu';
import {
  HlmSidebarComponent,
  HlmSidebarFooterComponent,
  HlmSidebarGroupComponent,
  HlmSidebarGroupContentComponent,
  HlmSidebarGroupLabelComponent,
  HlmSidebarHeaderComponent,
  HlmSidebarItemComponent,
  HlmSidebarNavComponent,
  HlmSidebarPinnedComponent,
  HlmSidebarSearchComponent,
  HlmSidebarSectionTitleDirective,
  SidebarNavItem,
} from '@dawit-io/spartan-sidebar';
import {
  HlmMenuComponent,
  HlmMenuItemDirective,
  HlmMenuSeparatorComponent,
  HlmMenuItemIconDirective,
  HlmMenuGroupComponent,
} from '@spartan-ng/ui-menu-helm';
import {
  BrnSidebarGroupDirective,
  BrnSidebarSearchService,
  BrnSidebarService,
  CollapsibleMode,
  SidebarVariant,
} from '@dawit-io/spartan-sidebar-core';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { ApplicationService } from '../../../features/service/application.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PlatformVersionService } from '../../../features/service/platform-version.service';
import { ProjectsService } from '../../../features/service/projects.service';
import {
  ALL_MANAGEMENT_ITEMS,
  CLUSTER_ITEMS,
  DEPLOY_ITEMS,
  FIREWALL_ITEMS,
  FULL_ACCESS_ONLY_LABELS,
  READS_BY_LABEL,
  INFRASTRUCTURE_ITEMS,
  INFRASTRUCTURE_SECTION_BY_LABEL,
  MANAGEMENT_SECTION_BY_LABEL,
} from './sidebar-nav.config';

@Component({
  selector: 'sidebar',
  standalone: true,
  imports: [
    NgIcon,
    HlmSidebarComponent,
    HlmSidebarHeaderComponent,
    HlmSidebarNavComponent,
    HlmSidebarItemComponent,
    HlmSidebarGroupComponent,
    HlmSidebarGroupLabelComponent,
    HlmSidebarGroupContentComponent,
    HlmSidebarSectionTitleDirective,
    HlmSidebarFooterComponent,
    HlmSidebarSearchComponent,
    HlmSidebarPinnedComponent,
    RouterLink,
    RouterLinkActive,
    BrnMenuTriggerDirective,
    HlmMenuComponent,
    HlmMenuItemDirective,
    HlmMenuSeparatorComponent,
    HlmMenuItemIconDirective,
    HlmMenuGroupComponent,
  ],
  providers: [
    provideIcons({
      lucideDownload,
      lucideLayoutDashboard,
      lucideServer,
      lucideReceipt,
      lucideHardDrive,
      lucideNetwork,
      lucideDatabase,
      lucideZap,
      lucideGitBranch,
      lucideRocket,
      lucideChartBar,
      lucideShield,
      lucideSettings,
      lucideUser,
      lucideCreditCard,
      lucideLogOut,
      lucideCircleHelp,
      lucideCloud,
      lucideActivity,
      lucideCircleAlert,
      lucideFileText,
      lucideKey,
      lucideGlobe,
      lucideScale,
      lucideCode,
      lucideContainer,
      lucideLayers,
      lucideBinoculars,
      lucideMessageCircleWarning,
      lucideKeyRound,
      lucideFolders,
      lucideCpu,
      lucideShieldCheck,
      lucideShieldPlus,
      lucidePackage,
      lucideBoxes,
  lucideChartNoAxesColumnIncreasing,
      lucideStore,
      lucideArchive,
      lucideArrowRightLeft,
      lucideMail,
      lucideGithub,
      lucideBot,
      lucideBookOpen,
      lucideWaypoints,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  readonly sidebarVariant = input<SidebarVariant>('sidebar');
  readonly collapsibleMode = input<CollapsibleMode>('icon');

  protected readonly _sidebarService = inject(BrnSidebarService);
  private readonly _search = inject(BrnSidebarSearchService);
  protected readonly _themeService = inject(ThemeService);
  private readonly _authService = inject(AuthService);
  private readonly _maskMode = inject(MaskModeService);
  private readonly _router = inject(Router);
  private readonly _appService = inject(ApplicationService);
  private readonly _perms = inject(PermissionService);
  private readonly _sandbox = inject(SandboxService);
  private readonly _platformVersion = inject(PlatformVersionService);
  private readonly _projects = inject(ProjectsService);

  protected readonly _version = this._platformVersion.version;

  readonly firewallItems = FIREWALL_ITEMS;
  readonly deployItems = DEPLOY_ITEMS;
  readonly clusterItems = computed(() => CLUSTER_ITEMS.filter((item) => this.admitted(item)));
  private readonly allManagementItems = ALL_MANAGEMENT_ITEMS;

  // A search query hides a whole section (title + card), not just the items
  // inside it — these mirror each *Items array/signal above so the template
  // can decide section-level visibility, since hlm-sidebar-group can only
  // hide itself, not the title/card wrapper this app renders around it.
  readonly clusterHasMatch = computed(() => this.clusterItems().some((item) => this._search.matches(item)));
  readonly workloadsHasMatch = computed(() => this.workloadItems().some((item) => this._search.matches(item)));
  readonly deployHasMatch = computed(() => this.deployItems.some((item) => this._search.matches(item)));
  readonly firewallHasMatch = computed(() => this.firewallItems.some((item) => this._search.matches(item)));

  constructor() {
    this._perms.load();
    this._projects.loadProjects();
  }

  ngOnInit(): void {
    void this._platformVersion.load();
  }

  canSee(section: string): boolean {
    return this._perms.hasSection(section);
  }

  private admitted(item: SidebarNavItem): boolean {
    const reads = READS_BY_LABEL[item.label];
    return !reads || this._sandbox.allows('GET', reads);
  }

  private shows(item: SidebarNavItem, section: string | undefined): boolean {
    if (!this.admitted(item)) return false;
    if (!section) return true;
    if (!this.canSee(section)) return false;
    return (
      !FULL_ACCESS_ONLY_LABELS.has(item.label) ||
      !this._perms.isSectionReadOnly(section)
    );
  }

  readonly visibleManagementItems = computed<SidebarNavItem[]>(() =>
    this.allManagementItems.filter((item) =>
      this.shows(item, MANAGEMENT_SECTION_BY_LABEL[item.label]),
    ),
  );

  readonly managementHasMatch = computed(() =>
    this.visibleManagementItems().some((item) => this._search.matches(item)),
  );

  readonly infrastructureItems = computed<SidebarNavItem[]>(() =>
    INFRASTRUCTURE_ITEMS.filter((item) =>
      this.shows(item, INFRASTRUCTURE_SECTION_BY_LABEL[item.label]),
    ),
  );

  readonly infrastructureHasMatch = computed(() =>
    this.infrastructureItems().some((item) => this._search.matches(item)),
  );

  private readonly _systemApps = inject(SystemAppsPreference);
  protected readonly showSystemApps = this._systemApps.shown;

  protected readonly _workloadsGroup = viewChild('workloadsGroup', {
    read: BrnSidebarGroupDirective,
  });

  toggleShowSystemApps(): void {
    this._systemApps.toggle();
  }

  protected readonly _computedHlmMenuClass = computed(() =>
    this._themeService.isDarkMode() ? 'dark w-56' : 'w-56'
  );

  private readonly _userBadge = computed(() =>
    userBadge(this._authService.currentUser(), {
      masked: this._maskMode.enabled(),
      visitor: this._sandbox.visitor(),
    }),
  );
  protected readonly _visitor = computed(() => this._sandbox.visitor());
  protected readonly _userDisplayName = computed(() => this._userBadge().name);
  protected readonly _userEmail = computed(() => this._userBadge().email);
  protected readonly _userInitials = computed(() => this._userBadge().initials);

  onLogout(): void {
    this._authService.logout().subscribe({
      complete: () => this._router.navigate(['/login']),
    });
  }

  private readonly _url = toSignal(
    this._router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this._router.url },
  );

  /**
   * The list an opened app belongs to. Its recap and its detail pages live
   * under one path whatever the app is, so the address alone would light up
   * "Applications" for a data store, or nothing at all on the recap.
   */
  private readonly _openedAppList = computed<string | null>(() => {
    const match = /^\/apps\/(?:recap|applications)\/([0-9a-f-]{36})(?:[/?#]|$)/.exec(
      this._url(),
    );
    if (!match) return null;
    const list = openedWorkloadList(
      match[1],
      this._appService.applicationGroups(),
      this._appService.applications(),
    );
    return list ? WORKLOAD_LIST_ROUTE[list] : null;
  });

  readonly workloadItems = computed<SidebarNavItem[]>(() => {
    const counts = this._appService.workloadListCounts();
    const projectCount = this._projects.projects().length;
    const label = (text: string, n: number) => (n > 0 ? `${text} (${n})` : text);

    const items: SidebarNavItem[] = [
      {
        label: label('Projects', projectCount),
        link: '/apps/projects',
        routerLinkActive: 'active',
        icon: 'lucideFolders',
      },
      {
        label: label(WORKLOAD_LIST_LABEL.applications, counts.applications),
        link: WORKLOAD_LIST_ROUTE.applications,
        routerLinkActive: 'active',
        icon: 'lucideContainer',
        keywords: ['apps', 'tools', 'services'],
      },
      {
        label: label(WORKLOAD_LIST_LABEL.data, counts.data),
        link: WORKLOAD_LIST_ROUTE.data,
        routerLinkActive: 'active',
        icon: 'lucideDatabase',
        keywords: ['databases', 'cache', 'queues', 'storage', 'search'],
      },
    ];

    if (this.showSystemApps()) {
      items.push({
        label: label(WORKLOAD_LIST_LABEL.system, counts.system),
        link: WORKLOAD_LIST_ROUTE.system,
        routerLinkActive: 'active',
        icon: 'lucideShield',
      });
    }

    const opened = this._openedAppList();
    if (!opened) return items;
    return items.map((item) => markOpenedAppList(item, opened));
  });

  private readonly _homeItem: SidebarNavItem = {
    label: 'Home',
    link: '/dashboard',
    routerLinkActive: 'active',
    icon: 'lucideLayoutDashboard',
    keywords: ['dashboard', 'overview', 'home'],
  };

  readonly homeHasMatch = computed(() => this._search.matches(this._homeItem));

  private readonly _topologyItem: SidebarNavItem = {
    label: 'Topology',
    link: '/topology',
    routerLinkActive: 'active',
    icon: 'lucideWaypoints',
    keywords: ['map', 'service map', 'servers', 'replicas', 'topology'],
  };

  readonly topologyShown = computed(
    () => this.admitted(this._topologyItem) && this._search.matches(this._topologyItem),
  );

  readonly allNavItems = computed<SidebarNavItem[]>(() => [
    this._homeItem,
    ...(this.admitted(this._topologyItem) ? [this._topologyItem] : []),
    ...this.clusterItems(),
    ...this.workloadItems(),
    ...this.deployItems,
    ...this.infrastructureItems(),
    ...this.firewallItems,
    ...this.visibleManagementItems(),
  ]);
}

function markOpenedAppList(item: SidebarNavItem, opened: string): SidebarNavItem & { active?: boolean } {
  if (item.link === opened) return { ...item, active: true };
  if (item.link === WORKLOAD_LIST_ROUTE.applications) return { ...item, routerLinkActive: '' };
  return item;
}
