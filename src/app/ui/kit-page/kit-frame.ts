import { Component } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeftRight,
  lucideBell,
  lucideBot,
  lucideBoxes,
  lucideChartColumn,
  lucideCircleHelp,
  lucideCloud,
  lucideContainer,
  lucideDatabase,
  lucideDownload,
  lucideEuro,
  lucideFileText,
  lucideFolder,
  lucideGitBranch,
  lucideGithub,
  lucideGlobe,
  lucideHistory,
  lucideKeyRound,
  lucideLayers,
  lucideLayoutGrid,
  lucideMail,
  lucideNetwork,
  lucidePackage,
  lucideServer,
  lucideSettings,
  lucideShield,
  lucideStore,
  lucideTerminal,
  lucideUpload,
  lucideUsers,
  lucideWorkflow,
} from '@ng-icons/lucide';
import { CONSOLE_NAV } from '../../layout/console/console-nav.config';
import { FlSidenav, NavSection } from '../frame/sidenav';
import { FlTopbar } from '../frame/topbar';
import { FlIcon } from '../primitives/icon';

const SAMPLE_COUNTS: Record<string, number> = { applications: 3, data: 1, projects: 3 };

@Component({
  selector: 'fl-kit-frame',
  imports: [FlTopbar, FlSidenav, FlIcon],
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowLeftRight,
      lucideBell,
      lucideBot,
      lucideBoxes,
      lucideChartColumn,
      lucideCircleHelp,
      lucideCloud,
      lucideContainer,
      lucideDatabase,
      lucideDownload,
      lucideEuro,
      lucideFileText,
      lucideFolder,
      lucideGitBranch,
      lucideGithub,
      lucideGlobe,
      lucideHistory,
      lucideKeyRound,
      lucideLayers,
      lucideLayoutGrid,
      lucideMail,
      lucideNetwork,
      lucidePackage,
      lucideServer,
      lucideSettings,
      lucideShield,
      lucideStore,
      lucideTerminal,
      lucideUpload,
      lucideUsers,
      lucideWorkflow,
    }),
  ],
  host: { class: 'block overflow-hidden rounded-fl-lg border border-fl-border' },
  template: `
    <fl-topbar>
      <button type="button" class="fl-topbar__icon" aria-label="SSH">
        <fl-icon name="lucideTerminal" />
      </button>
      <button type="button" class="fl-topbar__icon" aria-label="Notifications, 2 unread">
        <fl-icon name="lucideBell" /><span class="fl-topbar__dot"></span>
      </button>
      <button type="button" class="fl-topbar__icon" aria-label="Help">
        <fl-icon name="lucideCircleHelp" />
      </button>
      <button type="button" class="fl-topbar__user">
        <span class="fl-avatar">AM</span><span class="fl-topbar__username">Alex Morgan</span>
      </button>
    </fl-topbar>
    <div class="flex">
      <fl-sidenav [sections]="sections" />
      <div class="flex-1 bg-fl-page-bg p-8 text-fl-body-sm text-fl-ink-muted">Page content</div>
    </div>
  `,
})
export class KitFrame {
  protected readonly sections: readonly NavSection[] = CONSOLE_NAV.map((group) => ({
    label: group.label,
    items: group.entries
      .filter((e) => !e.onlyWithSystemApps)
      .map((e) => ({
        id: e.id,
        label: e.label,
        link: '/kit',
        icon: e.icon,
        count: e.count ? (SAMPLE_COUNTS[e.count] ?? null) : null,
        tag: e.updateTag ? '0.17.0' : null,
        current: e.id === 'applications',
      })),
  }));
}
