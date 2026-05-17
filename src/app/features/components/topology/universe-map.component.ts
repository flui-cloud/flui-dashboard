import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyDashboardService, TopologyEvent } from '../../service/topology.service';
import { UniverseOverlayService } from '../../service/universe-overlay.service';
import { ScrambleTextComponent } from './scramble-text.component';
import { FluiUniverseRenderer } from './universe-map.renderer';
import { AppNode, GalaxyNode, LabelMode, ServerNode, ShowMode, ZoomLevel } from './universe-map.types';

@Component({
  selector: 'app-universe-map',
  standalone: true,
  imports: [CommonModule, RouterLink, ScrambleTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #container class="universe-host" (mouseleave)="onContainerLeave()">
      <canvas #canvas></canvas>

      <header class="overlay top-left">
        <div class="breadcrumb">⸻ flui.universe</div>
        <div class="title">{{ headerTitle() }}</div>
      </header>

      <div class="overlay top-right toolbar">
        <div class="tb-group">
          <span class="label">labels</span>
          @for (m of labelModes; track m) {
            <button
              type="button"
              [class.active]="labelMode() === m"
              (click)="setLabelMode(m)"
            >{{ m }}</button>
          }
        </div>
        <div class="tb-group">
          <span class="label">show</span>
          <button type="button" [class.active]="showMode() === 'all'" (click)="setShowMode('all')">all</button>
          <button type="button" [class.active]="showMode() === 'user'" (click)="setShowMode('user')">user only</button>
        </div>
        <button type="button" class="reset-btn" (click)="reset()">reset</button>
        <button type="button" class="reset-btn close-btn" (click)="closeOverlay()" title="Close (Esc)">×</button>
      </div>

      @if (stats(); as s) {
        <button type="button" class="overlay alert-counter" (click)="focusFirstError()">
          <span class="errors">⌀ {{ s.errorCount }} errors</span>
          <span class="warns">⚠ {{ s.warningCount }} warnings</span>
        </button>
      }

      <aside class="overlay legend">
        <div class="hd">categories</div>
        @for (c of categoryLegend; track c.label) {
          <div class="row"><span class="dot" [style.background]="c.color"></span>{{ c.label }}</div>
        }
        <div class="hd">status</div>
        <div class="row"><span class="dot" style="background:#5DCAA5"></span>running</div>
        <div class="row"><span class="dot" style="background:#FFD86B"></span>warning</div>
        <div class="row"><span class="dot" style="background:#FF5A6E"></span>error</div>
        <div class="row"><span class="dot" style="background:#555"></span>stopped</div>
      </aside>

      @if (hoveredApp(); as a) {
        <aside class="overlay info-panel">
          <div class="iname"><app-scramble-text [text]="a.raw.displayName || a.raw.name" /></div>
          <div class="imeta">
            <div><span class="cat-dot" [style.background]="a.color"></span>{{ a.category }} · <span class="dim">{{ a.kind }}</span></div>
            <div>replicas: <strong><app-scramble-text mode="digit" [text]="a.replicaCount + ''" /></strong>
              @if (a.raw.scalingNote) { <span class="dim"> · {{ a.raw.scalingNote }}</span> }
            </div>
            <div>on: {{ replicaList(a) }}</div>
            <div>ram per replica: <app-scramble-text mode="digit" [text]="formatRam(a.ramRequestMB)" /></div>
            <div>ram total: <app-scramble-text mode="digit" [text]="formatRam(a.ramRequestMB * a.replicaCount)" /></div>
            <div>cluster: {{ a.galaxy.displayName }}</div>
            <div>status: <span [style.color]="statusColor(a.status)">{{ a.status }}</span>
              @if (a.raw.statusReason) { <span class="dim"> · {{ a.raw.statusReason }}</span> }
            </div>
            <div class="hint">single click → focus · double click → open</div>
          </div>
        </aside>
      }
      @if (!hoveredApp() && hoveredServer(); as s) {
        <aside class="overlay info-panel">
          <div class="iname"><app-scramble-text [text]="s.raw.displayName || s.name" /></div>
          <div class="imeta">
            <div><span class="cat-dot" style="background:#FFC57A"></span>star · {{ s.role }}</div>
            <div>cluster: {{ s.galaxy.displayName }}</div>
            <div>apps on this node: <strong><app-scramble-text mode="digit" [text]="serverApps(s).length + ''" /></strong></div>
            <div>ram total: <app-scramble-text mode="digit" [text]="formatRam(serverRamMB(s))" /></div>
            <div>cpu: <app-scramble-text mode="digit" [text]="s.raw.specs.cpuCores + ''" /> cores</div>
            <div>memory: <app-scramble-text mode="digit" [text]="formatRam(s.raw.specs.memoryMB)" /></div>
            <div>storage: <app-scramble-text mode="digit" [text]="s.raw.specs.storageGB + ''" /> GB</div>
            <div>status: <span [style.color]="nodeStatusColor(s.raw.status)">{{ s.raw.status }}</span></div>
            @if (serverErrors(s); as ec) {
              @if (ec > 0) {
                <div style="color:#FF5A6E">⌀ {{ ec }} error{{ ec === 1 ? '' : 's' }}</div>
              }
            }
            @if (serverWarnings(s); as wc) {
              @if (wc > 0) {
                <div style="color:#FFD86B">⚠ {{ wc }} warning{{ wc === 1 ? '' : 's' }}</div>
              }
            }
            <div class="hint">single click → focus · double click → open cluster</div>
          </div>
        </aside>
      }

      <footer class="overlay bottom-left zoom-label">
        zoom: <strong>{{ zoomLabel() }}</strong>
      </footer>

      @if (loading()) {
        <div class="overlay loading-overlay">
          <div class="spinner"></div>
          <div>Loading topology…</div>
        </div>
      }

      @if (error(); as err) {
        <div class="overlay error-overlay">
          <div class="title">Could not load topology</div>
          <div class="msg">{{ err }}</div>
          <button type="button" (click)="retry()">Retry</button>
        </div>
      }
    </div>

    @if (selectedApp(); as a) {
      <div class="dialog-backdrop" (click)="closeAppDialog()"></div>
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <div class="dialog-title">{{ a.raw.displayName || a.raw.name }}</div>
          <button type="button" class="dialog-close" (click)="closeAppDialog()" aria-label="Close">×</button>
        </div>
        <div class="dialog-body">
          <div class="row"><span class="k">Category</span><span class="v"><span class="cat-dot" [style.background]="a.color"></span>{{ a.category }} · {{ a.kind }}</span></div>
          <div class="row"><span class="k">Status</span><span class="v" [style.color]="statusColor(a.status)">{{ a.status }}@if (a.raw.statusReason) { <span class="dim"> · {{ a.raw.statusReason }}</span> }</span></div>
          <div class="row"><span class="k">Cluster</span><span class="v">{{ a.galaxy.displayName }}</span></div>
          <div class="row"><span class="k">Namespace</span><span class="v">{{ a.raw.namespace }}</span></div>
          <div class="row"><span class="k">Scaling</span><span class="v">{{ a.raw.scalingMode }}@if (a.raw.scalingNote) { <span class="dim"> · {{ a.raw.scalingNote }}</span> }</span></div>
          <div class="row"><span class="k">Replicas</span><span class="v">{{ a.replicaCount }} on {{ replicaList(a) }}</span></div>
          <div class="row"><span class="k">CPU req/limit</span><span class="v">{{ a.raw.cpuRequestM }}m / {{ a.raw.cpuLimitM }}m</span></div>
          <div class="row"><span class="k">RAM req/limit</span><span class="v">{{ formatRam(a.raw.ramRequestMB) }} / {{ formatRam(a.raw.ramLimitMB) }}</span></div>
          <div class="row"><span class="k">Primary node</span><span class="v">{{ a.primaryServer.name }}</span></div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn-ghost" (click)="closeAppDialog()">Cancel</button>
          <a class="btn-primary" [routerLink]="['/apps/applications', a.id]" (click)="navigateAway()">Open application →</a>
        </div>
      </div>
    }

    @if (selectedCluster(); as g) {
      <div class="dialog-backdrop" (click)="closeClusterDialog()"></div>
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <div class="dialog-title">{{ g.displayName }}</div>
          <button type="button" class="dialog-close" (click)="closeClusterDialog()" aria-label="Close">×</button>
        </div>
        <div class="dialog-body">
          <div class="row"><span class="k">Name</span><span class="v">{{ g.name }}</span></div>
          <div class="row"><span class="k">Stars</span><span class="v">{{ g.servers.length }} node{{ g.servers.length === 1 ? '' : 's' }}</span></div>
          <div class="row"><span class="k">Apps</span><span class="v">{{ g.apps.length }} ({{ countByKind(g, 'user') }} user · {{ countByKind(g, 'system') }} system)</span></div>
          <div class="row"><span class="k">Replicas</span><span class="v">{{ totalReplicas(g) }}</span></div>
          <div class="row"><span class="k">Total RAM</span><span class="v">{{ formatRam(totalRam(g)) }}</span></div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn-ghost" (click)="closeClusterDialog()">Cancel</button>
          <a class="btn-primary" [routerLink]="['/cluster', g.id]" (click)="navigateAway()">Open cluster →</a>
        </div>
      </div>
    }
  `,
  styleUrl: './universe-map.component.scss',
})
export class UniverseMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLElement>;

  private readonly topology = inject(TopologyDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly universeOverlay = inject(UniverseOverlayService);

  private renderer?: FluiUniverseRenderer;
  private resizeObs?: ResizeObserver;

  data = this.topology.data;
  stats = computed(() => this.data()?.stats ?? null);
  hoveredApp = signal<AppNode | null>(null);
  hoveredServer = signal<ServerNode | null>(null);
  selectedApp = signal<AppNode | null>(null);
  selectedCluster = signal<GalaxyNode | null>(null);
  zoomLabel = signal<ZoomLevel>('galaxy');
  labelMode = signal<LabelMode>('auto');
  showMode = signal<ShowMode>('all');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  readonly labelModes: LabelMode[] = ['auto', 'all', 'off'];

  readonly categoryLegend = [
    { label: 'database', color: '#FF6B9D' },
    { label: 'cache', color: '#FFC75F' },
    { label: 'storage', color: '#845EC2' },
    { label: 'automation', color: '#00C9A7' },
    { label: 'media', color: '#F9A84B' },
    { label: 'monitoring', color: '#4FC3F7' },
    { label: 'web', color: '#9FE1CB' },
    { label: 'business', color: '#D85A30' },
    { label: 'infra', color: '#7F77DD' },
  ];

  headerTitle = computed(() => {
    const s = this.stats();
    if (!s) return '';
    return `${s.totalClusters} galaxies · ${s.totalServers} stars · ${s.totalApps} apps · ${s.totalReplicas} replicas`;
  });

  constructor() {
    effect(() => this.renderer?.setLabelMode(this.labelMode()));
    effect(() => this.renderer?.setShowMode(this.showMode()));
    effect(() => {
      const d = this.data();
      if (d && this.renderer) this.renderer.updateData(d);
    });
  }

  ngAfterViewInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.topology.load();
      this.renderer = new FluiUniverseRenderer(
        this.canvasRef.nativeElement,
        this.containerRef.nativeElement,
        {
          onAppHover: (a) => this.hoveredApp.set(a),
          onServerHover: (s) => this.hoveredServer.set(s),
          onAppDoubleClick: (a) => this.selectedApp.set(a),
          onServerDoubleClick: (s) => this.selectedCluster.set(s.galaxy),
          onZoomChange: (z) => this.zoomLabel.set(z),
        },
      );
      this.renderer.mount(data);
      this.resizeObs = new ResizeObserver(() => this.renderer?.handleResize());
      this.resizeObs.observe(this.containerRef.nativeElement);

      this.topology.events$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((evt) => this.applyEvent(evt));
      this.topology.startStream();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    this.renderer?.destroy();
    this.topology.stopStream();
  }

  reset(): void {
    this.renderer?.reset();
  }
  closeOverlay(): void {
    this.universeOverlay.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedApp()) {
      this.closeAppDialog();
      return;
    }
    if (this.selectedCluster()) {
      this.closeClusterDialog();
      return;
    }
    this.closeOverlay();
  }
  setLabelMode(m: LabelMode): void {
    this.labelMode.set(m);
    this.renderer?.setLabelMode(m);
  }
  setShowMode(m: ShowMode): void {
    this.showMode.set(m);
    this.renderer?.setShowMode(m);
  }
  focusFirstError(): void {
    this.renderer?.focusFirstError();
  }
  closeAppDialog(): void {
    this.selectedApp.set(null);
  }
  closeClusterDialog(): void {
    this.selectedCluster.set(null);
  }
  navigateAway(): void {
    this.selectedApp.set(null);
    this.selectedCluster.set(null);
    this.universeOverlay.close();
  }
  countByKind(g: GalaxyNode, kind: 'user' | 'system'): number {
    return g.apps.filter((a) => a.kind === kind).length;
  }
  totalReplicas(g: GalaxyNode): number {
    return g.apps.reduce((s, a) => s + a.replicaCount, 0);
  }
  totalRam(g: GalaxyNode): number {
    return g.apps.reduce((s, a) => s + a.ramRequestMB * a.replicaCount, 0);
  }
  retry(): void {
    void this.bootstrap();
  }
  onContainerLeave(): void {
    this.hoveredApp.set(null);
    this.hoveredServer.set(null);
  }

  serverApps(s: ServerNode): AppNode[] {
    return s.galaxy.apps.filter(
      (a) => a.primaryServer.id === s.id || a.replicaServers.some((rs) => rs.server.id === s.id),
    );
  }
  serverRamMB(s: ServerNode): number {
    return this.serverApps(s).reduce((sum, a) => {
      const here = a.replicaServers.find((rs) => rs.server.id === s.id);
      return sum + a.ramRequestMB * (here?.count ?? 0);
    }, 0);
  }
  serverErrors(s: ServerNode): number {
    return this.serverApps(s).filter((a) => a.status === 'error').length;
  }
  serverWarnings(s: ServerNode): number {
    return this.serverApps(s).filter((a) => a.status === 'warning').length;
  }

  formatRam(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  }

  replicaList(a: AppNode): string {
    return a.replicaServers
      .map((rs) => (rs.count > 1 ? `${rs.server.name} ×${rs.count}` : rs.server.name))
      .join(', ');
  }

  statusColor(st: TopologyAppDto.StatusEnum): string {
    switch (st) {
      case 'error': return '#FF5A6E';
      case 'warning': return '#FFD86B';
      case 'stopped': return '#888';
      default: return '#5DCAA5';
    }
  }
  nodeStatusColor(st: string): string {
    switch (st) {
      case 'down': return '#FF5A6E';
      case 'degraded': return '#FFD86B';
      default: return '#5DCAA5';
    }
  }

  private applyEvent(evt: TopologyEvent): void {
    if (!this.renderer) return;
    switch (evt.event) {
      case 'app.status_changed':
        this.renderer.patchApp(evt.data.appId, {
          status: evt.data.status,
          statusReason: evt.data.statusReason,
        });
        break;
      case 'app.scaled':
        this.renderer.patchApp(evt.data.appId, {
          replicas: evt.data.replicas,
          replicaCount: evt.data.replicaCount,
          scalingNote: evt.data.scalingNote ?? null,
        });
        break;
      case 'app.deployed':
      case 'app.removed':
      case 'server.added':
      case 'server.removed':
        // Cheap recovery for structural changes: refetch full snapshot
        void this.topology.load();
        break;
      case 'heartbeat':
        break;
    }
  }
}
