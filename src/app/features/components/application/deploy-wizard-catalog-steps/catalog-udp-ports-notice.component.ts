import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRadio } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import {
  UDP_STATE_TEXT,
  udpPortsAdvice,
} from '../../../service/app-udp-ports.service';

@Component({
  selector: 'app-catalog-udp-ports-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink],
  providers: [provideIcons({ lucideRadio })],
  template: `
    @if (state.catalogUdpPorts(); as v) {
      <div
        class="mt-3 flex items-start gap-3 rounded-lg border px-4 py-3"
        [class]="
          taken()
            ? 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30'
            : allOpen()
              ? 'border-border bg-muted/30'
              : 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30'
        "
        data-testid="catalog-udp-ports"
      >
        <ng-icon name="lucideRadio" class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div class="min-w-0 text-sm">
          <div class="font-medium">This app needs public UDP ports</div>
          <ul class="mt-1 space-y-0.5 text-xs">
            @for (p of v.ports; track p.port) {
              <li>
                <span class="font-mono">{{ p.port }}</span>
                <span class="text-muted-foreground"> {{ p.name }} · </span>
                @if (p.takenBy) {
                  <span class="text-red-700 dark:text-red-300"
                    >Already used by {{ p.takenBy }} on this cluster</span
                  >
                } @else {
                  <span>{{ stateText[p.state] }}</span>
                }
              </li>
            }
          </ul>
          @if (taken()) {
            <p class="mt-1 text-xs text-muted-foreground">
              Two apps cannot share a UDP port on one cluster. Pick another cluster, or remove the other app first.
            </p>
          } @else if (advice()) {
            <p class="mt-1 text-xs text-muted-foreground">
              {{ advice() }} The app installs either way.
            </p>
          }
          @if (!taken() && v.firewallId && !allOpen()) {
            <a
              class="mt-1 inline-block text-xs font-medium underline underline-offset-2"
              [routerLink]="['/infrastructure/firewall', v.firewallId]"
              target="_blank"
            >
              Open Cluster Firewalls
            </a>
          }
        </div>
      </div>
    }
  `,
})
export class CatalogUdpPortsNoticeComponent {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly stateText = UDP_STATE_TEXT;

  protected readonly taken = computed(
    () => this.state.catalogUdpPorts()?.ports.some((p) => !!p.takenBy) ?? false,
  );
  protected readonly allOpen = computed(
    () =>
      this.state.catalogUdpPorts()?.ports.every((p) => p.state === 'open') ??
      true,
  );
  protected readonly advice = computed(() => {
    const v = this.state.catalogUdpPorts();
    return v ? udpPortsAdvice(v) : null;
  });
}
