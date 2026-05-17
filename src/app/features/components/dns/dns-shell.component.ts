import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideShieldCheck, lucideLock } from '@ng-icons/lucide';

interface TabItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-dns-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIconComponent],
  providers: [provideIcons({ lucideGlobe, lucideShieldCheck, lucideLock })],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">DNS Zones</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Register and manage DNS zones from your provider account.
        </p>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex -mb-px gap-1">
          @for (tab of tabs; track tab.route) {
            <a
              [routerLink]="[tab.route]"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="{ exact: true }"
              class="inline-flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors"
              [class]="rla.isActive
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'"
            >
              <ng-icon [name]="tab.icon" class="h-4 w-4" />
              {{ tab.label }}
            </a>
          }
        </nav>
      </div>

      <!-- Tab content -->
      <div class="mt-2">
        <router-outlet />
      </div>
    </div>
  `,
})
export class DnsShellComponent {
  tabs: TabItem[] = [
    { label: 'Registered Zones', route: 'zones', icon: 'lucideGlobe' },
    { label: 'Certificate Issuers', route: 'issuers', icon: 'lucideShieldCheck' },
    { label: 'Internal Hosting', route: 'internal-hosting', icon: 'lucideLock' },
  ];
}
