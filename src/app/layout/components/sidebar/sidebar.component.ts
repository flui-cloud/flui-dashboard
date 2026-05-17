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
  lucideCpu,
  lucideShieldCheck,
  lucideShieldPlus,
  lucidePackage,
  lucideBoxes,
  lucideHammer,
  lucideStore,
  lucideArchive,
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

const SHOW_SYSTEM_APPS_KEY = 'sidebar:showSystemApps';

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
      lucideCpu,
      lucideShieldCheck,
      lucideShieldPlus,
      lucidePackage,
      lucideBoxes,
      lucideHammer,
      lucideStore,
      lucideArchive,
    }),
  ],
  template: `
    <hlm-sidebar
      [variant]="sidebarVariant()"
      [collapsibleMode]="collapsibleMode()"
    >
      <hlm-sidebar-header>
        <div class="flex items-center min-w-0">
          <div
            class="flex w-full items-center"
            [class.justify-center]="!_sidebarService.isExpanded()"
          >
            <div class="flex items-center" [class.gap-2]="_sidebarService.isExpanded()">
              <div class="flex h-8 w-8 items-center justify-center">
                <img src="icons/logo.png" alt="flui.cloud logo" class="h-6 w-6 object-contain" />
              </div>
              @if (_sidebarService.isExpanded()) {
              <div class="flex min-w-0 flex-col">
                <span class="truncate text-sm font-semibold text-foreground"
                  >flui.cloud</span
                >
                <span class="truncate text-xs text-muted-foreground"
                  >EU Cloud Platform</span
                >
              </div>
              }
            </div>
          </div>
        </div>
      </hlm-sidebar-header>

      <hlm-sidebar-nav
        class="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-gray-300/30 scrollbar-track-transparent"
      >
        <!-- Dashboard -->
        <hlm-sidebar-item
          label="Home"
          routerLink="/dashboard"
          routerLinkActive="active"
          (clicked)="onNavigate('/dashboard')"
        >
          <ng-icon
            hlm
            name="lucideLayoutDashboard"
            class="h-4 w-4 text-muted-foreground"
          />
        </hlm-sidebar-item>

        <!-- Cluster Section -->
        <div hlmSidebarSectionTitle>Cluster</div>

        <div class="mx-1 rounded-lg bg-card border border-border px-1 py-1">
          <hlm-sidebar-group>
            <hlm-sidebar-group-label
              [label]="'Flui Clusters'"
              [items]="clusterItems"
            >
              <ng-icon
                hlm
                name="lucideCloud"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="clusterItems" />
          </hlm-sidebar-group>
        </div>

        <!-- Workloads Section -->
        <div hlmSidebarSectionTitle>Workloads</div>

        <div class="mx-1 rounded-lg bg-card border border-border px-1 py-1">
          <hlm-sidebar-group #workloadsGroup>
            <hlm-sidebar-group-label
              [label]="'Workloads'"
              [items]="workloadItems()"
            >
              <ng-icon
                hlm
                name="lucideContainer"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="workloadItems()" />
            @if (_sidebarService.isExpanded() && _workloadsGroup()?.isExpanded()) {
              <button
                type="button"
                (click)="toggleShowSystemApps()"
                class="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ng-icon hlm name="lucideShield" class="h-3.5 w-3.5" />
                <span>{{ showSystemApps() ? 'Hide' : 'Show' }} system</span>
              </button>
            }
          </hlm-sidebar-group>
        </div>

        <!-- Deploy Section -->
        <div hlmSidebarSectionTitle>Deploy</div>

        <div class="mx-1 rounded-lg bg-card border border-border px-1 py-1">
          <hlm-sidebar-group>
            <hlm-sidebar-group-label
              [label]="'Deploy'"
              [items]="deployItems"
            >
              <ng-icon
                hlm
                name="lucideZap"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="deployItems" />
          </hlm-sidebar-group>
        </div>

        <!-- Infrastructure Section -->
        <div hlmSidebarSectionTitle>Infrastructure</div>

        <div class="mx-1 rounded-lg bg-card border border-border px-1 py-1 space-y-1">
          <hlm-sidebar-group>
            <hlm-sidebar-group-label
              [label]="'Infrastructure'"
              [items]="infrastructureItems"
            >
              <ng-icon
                hlm
                name="lucideServer"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="infrastructureItems" />
          </hlm-sidebar-group>

          <hlm-sidebar-group>
            <hlm-sidebar-group-label
              [label]="'Firewall'"
              [items]="firewallItems"
            >
              <ng-icon
                hlm
                name="lucideShield"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="firewallItems" />
          </hlm-sidebar-group>
        </div>

        <!-- Management Section -->
        <div hlmSidebarSectionTitle>Management</div>

        <div class="mx-1 rounded-lg bg-card border border-border px-1 py-1">
          <hlm-sidebar-group>
            <hlm-sidebar-group-label
              [label]="'Management'"
              [items]="allManagementItems"
            >
              <ng-icon
                hlm
                name="lucideCloud"
                class="h-4 w-4 text-muted-foreground"
              />
            </hlm-sidebar-group-label>
            <hlm-sidebar-group-content [items]="allManagementItems" />
          </hlm-sidebar-group>
        </div>
      </hlm-sidebar-nav>

      <hlm-sidebar-footer
        [title]="_userDisplayName()"
        [subtitle]="_userEmail()"
        [initials]="_userInitials()"
        hlmMenuBarItem
        brnMenuItem
        [brnMenuTriggerFor]="menu"
      />
    </hlm-sidebar>

    <ng-template #menu>
      <hlm-menu [class]="_computedHlmMenuClass()">
        <hlm-menu-group>
          <button hlmMenuItem routerLink="/settings">
            <ng-icon hlm name="lucideUser" hlmMenuIcon />
            <span>Profile</span>
          </button>
          <button hlmMenuItem routerLink="/settings">
            <ng-icon hlm name="lucideSettings" hlmMenuIcon />
            <span>Settings</span>
          </button>
        </hlm-menu-group>
        <hlm-menu-separator />
        <button hlmMenuItem (click)="onLogout()">
          <ng-icon hlm name="lucideLogOut" hlmMenuIcon />
          <span>Log out</span>
        </button>
      </hlm-menu>
    </ng-template>
  `,
})
export class SidebarComponent {
  sidebarVariant = input<SidebarVariant>('sidebar');
  collapsibleMode = input<CollapsibleMode>('icon');

  protected readonly _sidebarService = inject(BrnSidebarService);
  protected readonly _themeService = inject(ThemeService);
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _appService = inject(ApplicationService);

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

  // Infrastructure items
  infrastructureItems: SidebarNavItem[] = [
    {
      label: 'Compute',
      link: '/infrastructure/compute',
      routerLinkActive: 'active',
      icon: 'lucideServer',
    },
    {
      label: 'Virtual Networks',
      link: '/infrastructure/vnet',
      routerLinkActive: 'active',
      icon: 'lucideNetwork',
    },
    {
      label: 'SSH Keys',
      link: '/infrastructure/keys',
      routerLinkActive: 'active',
      icon: 'lucideKeyRound',
    },
    {
      label: 'Domains',
      link: '/infrastructure/domains',
      routerLinkActive: 'active',
      icon: 'lucideGlobe',
    },
    {
      label: 'Platform',
      link: '/infrastructure/platform-components',
      routerLinkActive: 'active',
      icon: 'lucidePackage',
    },
  ];

  // Firewall items (grouped submenu)
  firewallItems: SidebarNavItem[] = [
    {
      label: 'Cluster Firewalls',
      link: '/infrastructure/firewall/clusters',
      routerLinkActive: 'active',
      icon: 'lucideShieldCheck',
    },
  ];

  // Workload items — kind-scoped entries with live badge counts
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

  // Deploy items — entry points to add new workloads
  deployItems: SidebarNavItem[] = [
    {
      label: 'App Catalog',
      link: '/apps/catalog',
      routerLinkActive: 'active',
      icon: 'lucideStore',
    },
    {
      label: 'Repositories',
      link: '/apps/repositories',
      routerLinkActive: 'active',
      icon: 'lucideGitBranch',
    },
    {
      label: 'Templates',
      link: '/apps/templates',
      routerLinkActive: 'active',
      icon: 'lucideFileText',
    },
    {
      label: 'Deploy New',
      link: '/apps/deploy/new',
      routerLinkActive: 'active',
      icon: 'lucideRocket',
    },
  ];

  // Management items (Providers + Backup + Settings)
  allManagementItems: SidebarNavItem[] = [
    {
      label: 'Providers',
      link: '/management/providers',
      routerLinkActive: 'active',
      icon: 'lucideCloud',
    },
    {
      label: 'Backup',
      link: '/management/backup',
      routerLinkActive: 'active',
      icon: 'lucideArchive',
    },
    {
      label: 'Settings',
      link: '/settings',
      routerLinkActive: 'active',
      icon: 'lucideSettings',
    },
  ];

  clusterItems: SidebarNavItem[] = [
    {
      label: 'Clusters',
      link: '/cluster',
      routerLinkActive: 'active',
      icon: 'lucideBoxes',
    },
  ];

  onNavigate(route: string) {
    // Navigation logic here
    console.log('Navigating to:', route);
  }
}
