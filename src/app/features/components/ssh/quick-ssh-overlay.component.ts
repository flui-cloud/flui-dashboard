import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideMinus,
  lucideTerminal,
  lucideRefreshCw,
  lucideMonitor,
  lucideChevronRight,
  lucideMaximize2,
  lucideMinimize2,
} from '@ng-icons/lucide';
import { QuickSshService, SshSession } from '../../service/quick-ssh.service';
import { SshTerminalComponent } from '../compute/ssh-terminal.component';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { InstanceResponseDto } from '../../../core/api/model/instanceResponseDto';
import { InstanceWithLabels, getOwnership, getClusterInfo } from '../../model/instance.models';

type ResizeEdge = 'top' | 'left' | 'top-left' | null;

const MIN_W = 360;
const MIN_H = 280;

@Component({
  selector: 'app-quick-ssh-overlay',
  standalone: true,
  imports: [CommonModule, NgIcon, SshTerminalComponent],
  providers: [provideIcons({ lucideX, lucideMinus, lucideTerminal, lucideRefreshCw, lucideMonitor, lucideChevronRight, lucideMaximize2, lucideMinimize2 })],
  template: `
    @if (sshService.isOpen()) {
      <div
        class="fixed z-50 flex flex-col shadow-2xl rounded-xl border border-border bg-background overflow-hidden select-none"
        [style.width.px]="width()"
        [style.height.px]="height()"
        [style.bottom.px]="16"
        [style.right.px]="16"
        [class.cursor-nw-resize]="activeEdge() === 'top-left'"
        [class.cursor-n-resize]="activeEdge() === 'top'"
        [class.cursor-w-resize]="activeEdge() === 'left'">

        <!-- Resize handle: top edge -->
        <div
          class="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize z-10 group"
          (mousedown)="startResize($event, 'top')">
          <div class="absolute inset-x-0 top-0.5 h-0.5 rounded bg-border opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        <!-- Resize handle: left edge -->
        <div
          class="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize z-10 group"
          (mousedown)="startResize($event, 'left')">
          <div class="absolute inset-y-0 left-0.5 w-0.5 rounded bg-border opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        <!-- Resize handle: top-left corner -->
        <div
          class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20"
          (mousedown)="startResize($event, 'top-left')">
        </div>

        <!-- Panel header -->
        <div class="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border flex-shrink-0">
          <ng-icon name="lucideTerminal" class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

          @if (sshService.activeSession(); as session) {
            <span class="text-xs font-medium text-foreground truncate flex-1">
              {{ session.serverName }}
            </span>
            @if (session.clusterName) {
              <span class="text-xs text-muted-foreground truncate hidden sm:block">
                {{ session.clusterName }}
              </span>
            }
            <div class="flex items-center gap-0.5 ml-1">
              <div class="h-1.5 w-1.5 rounded-full bg-green-500"></div>
              <span class="text-xs text-green-500 font-medium">SSH</span>
            </div>
            <button
              (click)="changeNode()"
              class="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors ml-1 flex-shrink-0">
              Change
            </button>
          } @else {
            <span class="text-xs font-medium text-foreground flex-1">SSH Access</span>
          }

          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              (click)="toggleSize()"
              class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              [title]="isExpanded() ? 'Compact' : 'Expand'">
              <ng-icon [name]="isExpanded() ? 'lucideMinimize2' : 'lucideMaximize2'" class="h-3.5 w-3.5" />
            </button>
            <button
              (click)="sshService.minimize()"
              class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Minimize">
              <ng-icon name="lucideMinus" class="h-3.5 w-3.5" />
            </button>
            <button
              (click)="close()"
              class="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Close">
              <ng-icon name="lucideX" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <!-- Node picker view -->
        @if (!sshService.activeSession()) {
          <div class="flex flex-col flex-1 overflow-hidden">
            <div class="px-3 pt-3 pb-2 flex-shrink-0">
              <p class="text-xs text-muted-foreground mb-2">Select a running node to connect</p>
              <input
                type="text"
                placeholder="Search nodes..."
                [value]="searchQuery()"
                (input)="searchQuery.set($any($event.target).value)"
                class="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>

            @if (isLoadingNodes()) {
              <div class="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
                <ng-icon name="lucideRefreshCw" class="h-4 w-4 animate-spin" />
                <span class="text-xs">Loading nodes...</span>
              </div>
            } @else if (filteredNodes().length === 0) {
              <div class="flex flex-col items-center justify-center flex-1 gap-1 text-muted-foreground">
                <ng-icon name="lucideMonitor" class="h-8 w-8 opacity-30" />
                <span class="text-xs">No running nodes found</span>
              </div>
            } @else {
              <div class="flex-1 overflow-y-auto px-2 pb-2">
                @for (node of filteredNodes(); track node.id) {
                  <button
                    (click)="connectToNode(node)"
                    class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted transition-colors mb-1 border border-transparent hover:border-border group">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
                      <span class="text-xs font-medium text-foreground truncate flex-1">
                        {{ node.displayName || node.name }}
                      </span>
                      <span class="text-xs text-muted-foreground uppercase flex-shrink-0">{{ node.provider }}</span>
                      <ng-icon name="lucideChevronRight" class="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <div class="flex items-center gap-2 mt-0.5 pl-3.5">
                      @if (node.ipConfig?.v4?.ip) {
                        <span class="text-xs text-muted-foreground font-mono">{{ node.ipConfig!.v4!.ip }}</span>
                      }
                      @if (getNodeClusterName(node)) {
                        <span class="text-xs text-muted-foreground">· {{ getNodeClusterName(node) }}</span>
                      }
                    </div>
                  </button>
                }
              </div>
            }

            <div class="px-3 pb-2 flex-shrink-0">
              <button
                (click)="loadNodes()"
                class="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 rounded hover:bg-muted transition-colors">
                <ng-icon name="lucideRefreshCw" class="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
        }

        <!-- Terminal view -->
        @if (sshService.activeSession(); as session) {
          <div class="flex-1 overflow-hidden">
            <app-ssh-terminal
              [serverId]="session.serverId"
              [serverIp]="session.serverIp"
              [clusterId]="session.clusterId"
            />
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class QuickSshOverlayComponent implements OnInit, OnDestroy {
  protected readonly sshService = inject(QuickSshService);
  private readonly instancesService = inject(VirtualInstancesService);
  private readonly zone = inject(NgZone);

  protected readonly isLoadingNodes = signal(false);
  protected readonly nodes = signal<InstanceWithLabels[]>([]);
  protected readonly searchQuery = signal('');

  protected readonly width = signal(780);
  protected readonly height = signal(460);
  protected readonly activeEdge = signal<ResizeEdge>(null);
  protected readonly isExpanded = signal(false);

  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;
  private edge: ResizeEdge = null;

  private readonly onMouseMove = (e: MouseEvent) => this.doResize(e);
  private readonly onMouseUp = () => this.stopResize();

  protected readonly filteredNodes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.nodes();
    return this.nodes().filter(n =>
      (n.displayName || n.name).toLowerCase().includes(query) ||
      n.provider.toLowerCase().includes(query) ||
      (n.ipConfig?.v4?.ip || '').includes(query) ||
      (this.getNodeClusterName(n) || '').toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadNodes();
  }

  ngOnDestroy(): void {
    this.removeListeners();
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  startResize(event: MouseEvent, edge: ResizeEdge): void {
    event.preventDefault();
    this.edge = edge;
    this.activeEdge.set(edge);
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.width();
    this.resizeStartH = this.height();

    // Run outside Angular zone for performance during drag
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    });
  }

  private doResize(event: MouseEvent): void {
    const dx = this.resizeStartX - event.clientX; // panel grows left → dx positive = wider
    const dy = this.resizeStartY - event.clientY; // panel grows up → dy positive = taller

    const maxW = window.innerWidth - 32;
    const maxH = window.innerHeight - 32;

    let newW = this.resizeStartW;
    let newH = this.resizeStartH;

    if (this.edge === 'left' || this.edge === 'top-left') {
      newW = Math.min(maxW, Math.max(MIN_W, this.resizeStartW + dx));
    }
    if (this.edge === 'top' || this.edge === 'top-left') {
      newH = Math.min(maxH, Math.max(MIN_H, this.resizeStartH + dy));
    }

    this.zone.run(() => {
      this.width.set(newW);
      this.height.set(newH);
    });
  }

  private stopResize(): void {
    this.edge = null;
    this.zone.run(() => this.activeEdge.set(null));
    this.removeListeners();
  }

  private removeListeners(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  toggleSize(): void {
    const expanded = !this.isExpanded();
    this.isExpanded.set(expanded);
    this.width.set(expanded ? 1000 : 780);
    this.height.set(expanded ? 600 : 460);
  }

  // ── Nodes ────────────────────────────────────────────────────────────────────

  loadNodes(): void {
    this.isLoadingNodes.set(true);
    this.instancesService.instancesControllerFindAll(
      undefined, 'running', undefined, undefined, undefined, undefined, undefined, undefined, true
    ).subscribe({
      next: (response: InstanceResponseDto) => {
        const allInstances = (response.data || []) as InstanceWithLabels[];
        // Only this installation's own nodes are reachable over SSH; nodes from
        // a parallel installation sharing the provider account are hidden.
        this.nodes.set(allInstances.filter(i => getOwnership(i) === 'self' && !!i.ipConfig?.v4?.ip));
        this.isLoadingNodes.set(false);
      },
      error: () => {
        this.nodes.set([]);
        this.isLoadingNodes.set(false);
      }
    });
  }

  connectToNode(node: InstanceWithLabels): void {
    const ip = node.ipConfig?.v4?.ip || '';
    const clusterInfo = getClusterInfo(node);
    const session: SshSession = {
      serverId: node.providerId || node.id,
      serverIp: ip,
      serverName: node.displayName || node.name,
      clusterId: clusterInfo?.clusterId,
      clusterName: clusterInfo?.clusterName,
    };
    this.sshService.setSession(session);
  }

  changeNode(): void {
    this.sshService.clearSession();
  }

  close(): void {
    this.sshService.close();
  }

  getNodeClusterName(node: InstanceWithLabels): string | undefined {
    return getClusterInfo(node)?.clusterName;
  }
}
