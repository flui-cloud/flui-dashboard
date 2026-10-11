import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { accessOf } from '../../model/app-access';
import { RouterLink } from '@angular/router';
import { Application } from '../../model/application.models';
import { AppEndpointsService } from '../../service/app-endpoints.service';
import { AppRuntimeService } from '../../service/app-runtime.service';
import { AppVariablesService } from '../../service/app-variables.service';
import { ApplicationMonitoringService } from '../../service/application-monitoring.service';
import { Tone } from '../dashboard/home-state';
import { endpointCountsOf, plural, replicasTone } from './app-overview-view';
import { TONE_DOT, TONE_TEXT } from './app-recap-view';
import { replicaCountsOf } from './replica-counts';
import { placementOf, replicaPodsOf } from './replica-pods';

@Component({
  selector: 'app-overview-facts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2" [class.lg:grid-cols-4]="showDns()" [class.lg:grid-cols-3]="!showDns()" data-testid="overview-facts">
      <div class="flex min-w-0 flex-col">
        <p class="text-label">Replicas</p>
        <p class="mt-1 text-base font-semibold tabular-nums" [class]="text[replicaTone()]">
          {{ replicas().ready }} / {{ replicas().desired }} ready
        </p>
        @if (pods().current.length || pods().older) {
          <ul class="mt-1 space-y-0.5 text-xs" data-testid="replica-nodes">
            @for (pod of pods().current; track pod.name) {
              <li class="flex min-w-0 items-center gap-1.5">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full" [class]="dot[pod.ready ? 'ok' : 'warn']"></span>
                @if (pod.node) {
                  <span class="truncate font-mono text-foreground" [title]="pod.name">{{ pod.node }}</span>
                  <span class="shrink-0 text-muted-foreground">{{ placement(pod) }}</span>
                } @else {
                  <span class="text-amber-700 dark:text-amber-400" [title]="pod.name">waiting for a node</span>
                }
              </li>
            }
            @if (pods().older) {
              <li class="text-muted-foreground" data-testid="replica-older">
                {{ plural(pods().older, 'older pod') }} ending
              </li>
            }
          </ul>
        }
        @if (!readOnly()) {<a [routerLink]="['../resources']" class="mt-2 text-xs font-medium text-primary hover:underline">Edit</a>}
      </div>

      <div class="flex min-w-0 flex-col">
        <p class="text-label">Resources</p>
        @if (container(); as c) {
          <p class="mt-1 truncate text-base font-semibold text-foreground" [title]="'CPU request / limit'">
            CPU {{ c.requests.cpu ?? '—' }} / {{ c.limits.cpu ?? '—' }}
          </p>
          <p class="truncate text-sm font-medium text-foreground" [title]="'Memory request / limit'">
            Mem {{ c.requests.memory ?? '—' }} / {{ c.limits.memory ?? '—' }}
          </p>
          <p class="text-xs text-muted-foreground">request / limit</p>
        } @else {
          <p class="mt-1 text-base font-semibold text-muted-foreground">—</p>
        }
        @if (!readOnly()) {<a [routerLink]="['../resources']" class="mt-2 text-xs font-medium text-primary hover:underline">Edit</a>}
      </div>

      <div class="flex min-w-0 flex-col">
        <p class="text-label">Configuration</p>
        @if (valuesHidden()) {
          <p class="mt-1 text-base font-semibold text-foreground tabular-nums">{{ plural(app().env?.length ?? 0, 'env var') }}</p>
          <p class="text-xs text-muted-foreground">Values not shown</p>
        } @else if (variables.loading()) {
          <p class="mt-1 text-sm text-muted-foreground">Loading…</p>
        } @else {
          <p class="mt-1 text-base font-semibold text-foreground tabular-nums">{{ plural(varCount(), 'env var') }}</p>
          <p class="text-xs text-muted-foreground">{{ plural(secretCount(), 'secret') }}</p>
        }
        @if (!readOnly()) {<a [routerLink]="['../configuration']" class="mt-2 text-xs font-medium text-primary hover:underline">Manage</a>}
      </div>

      @if (showDns()) {
        @let e = endpoints();
        <div class="flex min-w-0 flex-col">
          <p class="text-label">DNS endpoints</p>
          @if (endpointsService.loading()) {
            <p class="mt-1 text-sm text-muted-foreground">Loading…</p>
          } @else {
            <p class="mt-1 text-base font-semibold tabular-nums" [class]="text[dnsTone()]">{{ plural(e.count, 'endpoint') }}</p>
            @if (e.primary; as ep) {
              <p class="truncate font-mono text-xs text-foreground" [title]="ep.fqdn">{{ ep.fqdn }}</p>
            }
            @if (e.count > 0) {
              <p class="text-xs text-muted-foreground">
                <span class="text-green-700 dark:text-green-400">{{ e.synced }} in sync</span>
                @if (e.drift > 0) {
                  · <span class="text-amber-700 dark:text-amber-400">{{ e.drift }} drift</span>
                }
              </p>
            }
          }
          @if (!readOnly()) {<a [routerLink]="['../dns']" class="mt-2 text-xs font-medium text-primary hover:underline">Manage</a>}
        </div>
      }
    </div>
  `,
})
export class AppOverviewFactsComponent {
  private readonly runtimeService = inject(AppRuntimeService);
  private readonly monitoring = inject(ApplicationMonitoringService);
  protected readonly variables = inject(AppVariablesService);
  protected readonly endpointsService = inject(AppEndpointsService);

  readonly app = input.required<Application>();
  readonly showDns = input(false);
  protected readonly readOnly = computed(() => accessOf(this.app())?.readOnly === true);
  protected readonly valuesHidden = computed(() => accessOf(this.app())?.dataAccess === false);

  protected readonly text = TONE_TEXT;
  protected readonly dot = TONE_DOT;
  protected readonly plural = plural;
  protected readonly placement = placementOf;

  protected readonly replicas = computed(() =>
    replicaCountsOf(this.runtimeService.runtime(), this.monitoring.statusMetrics(), this.app().replicas),
  );
  protected readonly replicaTone = computed(() => replicasTone(this.replicas().ready, this.replicas().desired));
  protected readonly pods = computed(() => replicaPodsOf(this.runtimeService.runtime()?.pods, this.replicas().desired));
  protected readonly container = computed(() => this.runtimeService.runtime()?.containers?.[0] ?? null);

  protected readonly varCount = computed(() => Object.keys(this.variables.plainData()).length);
  protected readonly secretCount = computed(() => this.variables.sensitiveKeys().length);

  protected readonly endpoints = computed(() => endpointCountsOf(this.endpointsService.endpoints(), this.app().id));
  protected readonly dnsTone = computed<Tone>(() => {
    const e = this.endpoints();
    if (e.count === 0) return 'muted';
    if (e.drift > 0) return 'warn';
    return e.synced === e.count ? 'ok' : 'info';
  });
}
