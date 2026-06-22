import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLayoutDashboard,
  lucideServer,
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
  lucideHammer,
  lucideStore,
  lucideArchive,
  lucideGithub,
} from '@ng-icons/lucide';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
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
  BrnSidebarService,
  CollapsibleMode,
  SidebarVariant,
} from '@dawit-io/spartan-sidebar-core';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../features/service/application.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  ALL_MANAGEMENT_ITEMS,
  CLUSTER_ITEMS,
  DEPLOY_ITEMS,
  FIREWALL_ITEMS,
  INFRASTRUCTURE_ITEMS,
  MANAGEMENT_SECTION_BY_LABEL,
  SHOW_SYSTEM_APPS_KEY,
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
      lucideLayoutDashboard,
      lucideServer,
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
      lucideHammer,
      lucideStore,
      lucideArchive,
      lucideGithub,
    }),
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly sidebarVariant = input<SidebarVariant>('sidebar');
  readonly collapsibleMode = input<CollapsibleMode>('icon');

  protected readonly _sidebarService = inject(BrnSidebarService);
  protected readonly _themeService = inject(ThemeService);
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _appService = inject(ApplicationService);
  private readonly _perms = inject(PermissionService);

  readonly infrastructureItems = INFRASTRUCTURE_ITEMS;
  readonly firewallItems = FIREWALL_ITEMS;
  readonly deployItems = DEPLOY_ITEMS;
  readonly clusterItems = CLUSTER_ITEMS;
  private readonly allManagementItems = ALL_MANAGEMENT_ITEMS;

  constructor() {
    this._perms.load();
  }

  canSee(section: string): boolean {
    return this._perms.hasSection(section);
  }

  readonly visibleManagementItems = computed<SidebarNavItem[]>(() =>
    this.allManagementItems.filter((item) => {
      const section = MANAGEMENT_SECTION_BY_LABEL[item.label];
      return section ? this.canSee(section) : true;
    }),
  );

  protected readonly showSystemApps = signal<boolean>(this._readShowSystemApps());

  protected readonly _workloadsGroup = viewChild('workloadsGroup', {
    read: BrnSidebarGroupDirective,
  });

  private _readShowSystemApps(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SHOW_SYSTEM_APPS_KEY) === 'true';
  }

  toggleShowSystemApps(): void {
    const next = !this.showSystemApps();
    this.showSystemApps.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHOW_SYSTEM_APPS_KEY, String(next));
    }
  }

  protected readonly _computedHlmMenuClass = computed(() =>
    this._themeService.isDarkMode() ? 'dark w-56' : 'w-56'
  );

  protected readonly _userDisplayName = computed(() => {
    const user = this._authService.currentUser();
    return user?.name || user?.email || 'User';
  });

  protected readonly _userEmail = computed(() => {
    return this._authService.currentUser()?.email ?? '';
  });

  protected readonly _userInitials = computed(() => {
    const user = this._authService.currentUser();
    if (!user) return '';
    const source = user.name || user.email || '';
    return source
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join('');
  });

  onLogout(): void {
    this._authService.logout().subscribe({
      complete: () => this._router.navigate(['/login']),
    });
  }

  readonly workloadItems = computed<SidebarNavItem[]>(() => {
    const dbCount = this._appService.databasesCount();
    const appCount = this._appService.applicationsCount();
    const toolCount = this._appService.toolsCount();
    const sysCount = this._appService.systemKindCount();

    const items: SidebarNavItem[] = [
      {
        label: dbCount > 0 ? `Databases (${dbCount})` : 'Databases',
        link: '/apps/databases',
        routerLinkActive: 'active',
        icon: 'lucideDatabase',
      },
      {
        label: appCount > 0 ? `Applications (${appCount})` : 'Applications',
        link: '/apps/applications',
        routerLinkActive: 'active',
        icon: 'lucideContainer',
      },
      {
        label: toolCount > 0 ? `Tools (${toolCount})` : 'Tools',
        link: '/apps/tools',
        routerLinkActive: 'active',
        icon: 'lucideHammer',
      },
    ];

    if (this.showSystemApps()) {
      items.push({
        label: sysCount > 0 ? `System (${sysCount})` : 'System',
        link: '/apps/system',
        routerLinkActive: 'active',
        icon: 'lucideShield',
      });
    }

    return items;
  });
}
