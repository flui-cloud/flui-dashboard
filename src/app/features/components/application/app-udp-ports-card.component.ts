import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideRadio } from '@ng-icons/lucide';
import { ApplicationResponseDto } from '../../../core/api';
import {
  AppUdpPortsService,
  UDP_STATE_TEXT,
  UdpPortsView,
  udpPortsAdvice,
  udpPortsOf,
} from '../../service/app-udp-ports.service';

@Component({
  selector: 'app-udp-ports-card',
  standalone: true,
  imports: [NgIconComponent, RouterLink],
  providers: [provideIcons({ lucideRadio })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      @if (v.ports.length) {
        <div
          class="flex items-start gap-3 rounded-lg border px-4 py-2.5"
          [class]="allOpen() ? 'border-border bg-muted/30' : 'border-amber-200 bg-amber-50/70'"
          data-testid="app-udp-ports"
        >
          <ng-icon name="lucideRadio" class="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div class="min-w-0 text-sm">
            <div class="font-medium">Public UDP ports</div>
            <ul class="mt-1 space-y-0.5 text-xs">
              @for (p of v.ports; track p.port) {
                <li>
                  <span class="font-mono">{{ p.port }}</span>
                  <span class="text-muted-foreground"> {{ p.name }} · </span>
                  <span [class]="p.state === 'open' ? '' : 'text-amber-700'">{{
                    stateText[p.state]
                  }}</span>
                </li>
              }
            </ul>
            @if (advice()) {
              <p class="mt-1 text-xs text-muted-foreground">{{ advice() }}</p>
            }
            @if (showFirewallLink()) {
              <a
                class="mt-1 inline-block text-xs font-medium underline underline-offset-2"
                [routerLink]="['/infrastructure/firewall', v.firewallId]"
              >
                Open Cluster Firewalls
              </a>
            }
          </div>
        </div>
      }
    }
  `,
})
export class AppUdpPortsCardComponent {
  private readonly udpPorts = inject(AppUdpPortsService);

  readonly app = input.required<ApplicationResponseDto | null>();
  readonly view = signal<UdpPortsView | null>(null);
  readonly stateText = UDP_STATE_TEXT;

  readonly allOpen = computed(() => this.view()?.ports.every((p) => p.state === 'open') ?? true);
  readonly advice = computed(() => {
    const v = this.view();
    return v ? udpPortsAdvice(v) : null;
  });
  readonly showFirewallLink = computed(() => {
    const v = this.view();
    return !!v?.firewallId && v.ports.some((p) => p.state === 'closed' || p.state === 'pending');
  });

  constructor() {
    effect(() => {
      const app = this.app();
      if (!app || !udpPortsOf(app).length) {
        this.view.set(null);
        return;
      }
      this.udpPorts.forApp(app.id).subscribe({
        next: (v) => this.view.set(v),
        error: () => this.view.set(null),
      });
    });
  }
}
