import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChartColumn,
  lucideGlobe,
  lucideList,
  lucidePlug,
  lucideMail,
  lucideUserX,
  lucideWrench,
} from '@ng-icons/lucide';

interface MailTab {
  label: string;
  route: string;
  icon: string;
}

const TABS: MailTab[] = [
  { label: 'Overview', route: '/management/mail/overview', icon: 'lucideChartColumn' },
  { label: 'Activity', route: '/management/mail/activity', icon: 'lucideList' },
  { label: 'Domains', route: '/management/mail/domains', icon: 'lucideGlobe' },
  { label: 'Suppressions', route: '/management/mail/suppressions', icon: 'lucideUserX' },
  { label: 'Providers', route: '/management/mail/providers', icon: 'lucidePlug' },
  { label: 'Setup', route: '/management/mail/setup', icon: 'lucideWrench' },
];

@Component({
  selector: 'app-mail-section-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgIcon],
  providers: [
    provideIcons({
      lucidePlug,
      lucideChartColumn,
      lucideGlobe,
      lucideList,
      lucideMail,
      lucideUserX,
      lucideWrench,
    }),
  ],
  template: `
    <header class="mb-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <ng-icon name="lucideMail" class="h-5 w-5 text-primary" />
          <div>
            <h1 class="text-xl font-semibold text-foreground">Mail</h1>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Whether your applications' mail is arriving, and what to do when it is not.
            </p>
          </div>
        </div>
        <ng-content select="[slot=actions]" />
      </div>

      <nav class="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        @for (tab of tabs; track tab.route) {
          <a
            [routerLink]="tab.route"
            routerLinkActive
            #rla="routerLinkActive"
            class="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
            [class]="
              rla.isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            "
          >
            <ng-icon [name]="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
            @if (tab.route.endsWith('setup') && toFix() > 0) {
              <span
                class="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
              >
                {{ toFix() }}
              </span>
            }
          </a>
        }
      </nav>
    </header>
  `,
})
export class MailSectionNavComponent {
  readonly toFix = input(0);
  protected readonly tabs = TABS;
}
