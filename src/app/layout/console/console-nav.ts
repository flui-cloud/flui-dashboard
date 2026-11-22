import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { PermissionService } from '../../core/services/permission.service';
import { SandboxService } from '../../core/services/sandbox.service';
import { SystemAppsPreference } from '../../core/services/system-apps-preference.service';
import { ApplicationService } from '../../features/service/application.service';
import { PlatformUpdateService } from '../../features/service/platform-update.service';
import { ProjectsService } from '../../features/service/projects.service';
import { WORKLOAD_LIST_ROUTE, openedWorkloadList } from '../../features/model/workload-list';
import { NavItem, NavSection } from '../../ui/frame/sidenav';
import { PaletteEntry } from '../../ui/frame/command-palette';
import { CONSOLE_NAV, NavCount, NavEntry } from './console-nav.config';

const OPENED_APP = /^\/apps\/(?:recap|applications)\/([0-9a-f-]{36})(?:[/?#]|$)/;

@Injectable()
export class ConsoleNav {
  private readonly perms = inject(PermissionService);
  private readonly sandbox = inject(SandboxService);
  private readonly systemApps = inject(SystemAppsPreference);
  private readonly apps = inject(ApplicationService);
  private readonly projects = inject(ProjectsService);
  private readonly updates = inject(PlatformUpdateService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly counts = computed<Record<NavCount, number>>(() => {
    const lists = this.apps.workloadListCounts();
    return {
      applications: lists.applications,
      data: lists.data,
      system: lists.system,
      projects: this.projects.projects().length,
    };
  });

  private readonly openedList = computed<string | null>(() => {
    const match = OPENED_APP.exec(this.url());
    if (!match) return null;
    const list = openedWorkloadList(
      match[1],
      this.apps.applicationGroups(),
      this.apps.applications(),
    );
    return list ? WORKLOAD_LIST_ROUTE[list] : null;
  });

  private readonly visible = computed(() =>
    CONSOLE_NAV.map((group) => ({
      label: group.label,
      entries: group.entries.filter((entry) => this.shows(entry)),
    })).filter((group) => group.entries.length > 0),
  );

  readonly sections = computed<readonly NavSection[]>(() => {
    const counts = this.counts();
    const opened = this.openedList();
    const version = this.updates.updateAvailable() ? this.updates.availableVersion() : null;
    return this.visible().map((group) => ({
      label: group.label,
      items: group.entries.map((entry) => this.toItem(entry, counts, opened, version)),
    }));
  });

  readonly paletteEntries = computed<readonly PaletteEntry[]>(() =>
    this.visible().flatMap((group) =>
      group.entries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        group: group.label ?? 'Console',
        link: entry.link,
        icon: entry.icon,
        keywords: entry.keywords,
      })),
    ),
  );

  load(): void {
    this.perms.load();
    this.projects.loadProjects();
  }

  private shows(entry: NavEntry): boolean {
    if (entry.onlyWithSystemApps && !this.systemApps.shown()) return false;
    if (entry.reads && !this.sandbox.allows('GET', entry.reads)) return false;
    if (!entry.section) return true;
    if (!this.perms.hasSection(entry.section)) return false;
    return !entry.fullAccessOnly || !this.perms.isSectionReadOnly(entry.section);
  }

  private toItem(
    entry: NavEntry,
    counts: Record<NavCount, number>,
    opened: string | null,
    version: string | null,
  ): NavItem {
    return {
      id: entry.id,
      label: entry.label,
      link: entry.link,
      icon: entry.icon,
      keywords: entry.keywords,
      count: entry.count ? counts[entry.count] : null,
      tag: entry.updateTag && version ? version : null,
      current: opened && entry.count && entry.count !== 'projects' ? entry.link === opened : null,
    };
  }
}
