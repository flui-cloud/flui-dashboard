import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideX,
  lucideMinus,
  lucideTerminal,
  lucideRefreshCw,
  lucideMonitor,
  lucideChevronRight,
  lucideMaximize2,
  lucideMinimize2,
  lucideSearch,
} from '@ng-icons/lucide';
import { QuickSshService, SshSession } from '../../service/quick-ssh.service';
import { SshTerminalComponent } from '../compute/ssh-terminal.component';
import { VirtualInstancesService } from '../../../core/api/api/virtualInstances.service';
import { MaskModeService } from '../../../core/services/mask-mode.service';
import { InstanceResponseDto } from '../../../core/api/model/instanceResponseDto';
import { InstanceWithLabels, getOwnership, getClusterInfo } from '../../model/instance.models';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

type ResizeEdge = 'top' | 'left' | 'top-left' | null;

const MIN_W = 360;
const MIN_H = 280;

@Component({
  selector: 'app-quick-ssh-overlay',
  imports: [SshTerminalComponent, FlEmptyState, FlLoadingState, FlButton, FlIcon, FlStatus],
  providers: [
    provideIcons({
      lucideX,
      lucideMinus,
      lucideTerminal,
      lucideRefreshCw,
      lucideMonitor,
      lucideChevronRight,
      lucideMaximize2,
      lucideMinimize2,
      lucideSearch,
    }),
  ],
  host: { class: 'contents' },
  template: `
    @if (sshService.isOpen()) {
      <section
        class="fl-panel fixed bottom-4 right-4 z-50 flex select-none flex-col overflow-hidden"
        aria-label="SSH terminal"
        [style.width.px]="width()"
        [style.height.px]="height()"
        [class.cursor-nw-resize]="activeEdge() === 'top-left'"
        [class.cursor-n-resize]="activeEdge() === 'top'"
        [class.cursor-w-resize]="activeEdge() === 'left'"
      >
        <div
          class="group absolute left-3 right-3 top-0 z-10 h-1.5 cursor-n-resize"
          (mousedown)="startResize($event, 'top')"
        >
          <div
            class="absolute inset-x-0 top-0.5 h-0.5 bg-fl-border opacity-0 transition-opacity group-hover:opacity-100"
          ></div>
        </div>

        <div
          class="group absolute bottom-3 left-0 top-3 z-10 w-1.5 cursor-w-resize"
          (mousedown)="startResize($event, 'left')"
        >
          <div
            class="absolute inset-y-0 left-0.5 w-0.5 bg-fl-border opacity-0 transition-opacity group-hover:opacity-100"
          ></div>
        </div>

        <div
          class="absolute left-0 top-0 z-20 h-4 w-4 cursor-nw-resize"
          (mousedown)="startResize($event, 'top-left')"
        ></div>

        <header class="fl-panel__header shrink-0 flex-nowrap">
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <fl-icon name="lucideTerminal" [size]="16" class="text-fl-ink-muted" />
            @if (sshService.activeSession(); as session) {
              <h2 class="fl-panel__title truncate">{{ session.serverName }}</h2>
              @if (session.clusterName) {
                <span class="hidden truncate text-fl-body-sm text-fl-ink-muted sm:block">
                  {{ session.clusterName }}
                </span>
              }
              <fl-status tone="success" label="Connected" />
            } @else {
              <h2 class="fl-panel__title">SSH access</h2>
            }
          </div>

          <div class="fl-panel__actions">
            @if (sshService.activeSession()) {
              <button flButton="ghost" size="sm" type="button" (click)="changeNode()">
                Change
              </button>
            }
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              [attr.aria-label]="isExpanded() ? 'Compact' : 'Expand'"
              [title]="isExpanded() ? 'Compact' : 'Expand'"
              (click)="toggleSize()"
            >
              <fl-icon [name]="isExpanded() ? 'lucideMinimize2' : 'lucideMaximize2'" />
            </button>
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              aria-label="Minimize"
              title="Minimize"
              (click)="sshService.minimize()"
            >
              <fl-icon name="lucideMinus" />
            </button>
            <button
              flButton="ghost"
              size="sm"
              [iconOnly]="true"
              type="button"
              aria-label="Close"
              title="Close"
              (click)="close()"
            >
              <fl-icon name="lucideX" />
            </button>
          </div>
        </header>

        @if (!sshService.activeSession()) {
          <div class="flex flex-1 flex-col overflow-hidden">
            <div class="flex shrink-0 flex-col gap-2 px-4 pb-2 pt-3">
              <p class="text-fl-body-sm text-fl-ink-muted">Select a running node to connect</p>
              <label class="fl-input">
                <fl-icon name="lucideSearch" [size]="14" />
                <input
                  type="text"
                  placeholder="Search nodes"
                  aria-label="Search nodes"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                />
              </label>
            </div>

            @if (isLoadingNodes()) {
              <fl-loading-state [rows]="4" />
            } @else if (filteredNodes().length === 0) {
              <fl-empty-state
                icon="lucideMonitor"
                title="No running nodes found"
                [compact]="true"
              />
            } @else {
              <ul class="flex-1 divide-y divide-fl-border-subtle overflow-y-auto">
                @for (node of filteredNodes(); track node.id) {
                  <li>
                    <button
                      type="button"
                      class="group flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-fl-surface-hover"
                      (click)="connectToNode(node)"
                    >
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span class="truncate text-fl-body-sm font-medium text-fl-ink">
                          {{ node.displayName || node.name }}
                        </span>
                        <span class="flex items-center gap-2 text-fl-caption text-fl-ink-muted">
                          @if (node.ipConfig?.v4?.ip) {
                            <span class="fl-mono">{{ node.ipConfig!.v4!.ip }}</span>
                          }
                          @if (getNodeClusterName(node)) {
                            <span>{{ getNodeClusterName(node) }}</span>
                          }
                        </span>
                      </span>
                      <span class="fl-tag shrink-0">{{ node.provider }}</span>
                      <fl-status tone="success" label="Running" />
                      <fl-icon
                        name="lucideChevronRight"
                        [size]="14"
                        class="text-fl-ink-muted opacity-0 group-hover:opacity-100"
                      />
                    </button>
                  </li>
                }
              </ul>
            }

            <div class="shrink-0 border-t border-fl-border-subtle px-4 py-2">
              <button flButton="ghost" size="sm" [block]="true" type="button" (click)="loadNodes()">
                <fl-icon name="lucideRefreshCw" />
                Refresh
              </button>
            </div>
          </div>
        }

        @if (sshService.activeSession(); as session) {
          <div class="flex-1 overflow-hidden">
            <app-ssh-terminal
              [serverId]="session.serverId"
              [serverIp]="session.serverIp"
              [clusterId]="session.clusterId"
            />
          </div>
        }
      </section>
    }
  `,
})
export class QuickSshOverlayComponent implements OnInit, OnDestroy {
  protected readonly sshService = inject(QuickSshService);
  private readonly instancesService = inject(VirtualInstancesService);
  private readonly zone = inject(NgZone);
  private readonly maskMode = inject(MaskModeService);

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
    return this.nodes().filter(
      (n) =>
        (n.displayName || n.name).toLowerCase().includes(query) ||
        n.provider.toLowerCase().includes(query) ||
        (n.ipConfig?.v4?.ip || '').includes(query) ||
        (this.getNodeClusterName(n) || '').toLowerCase().includes(query),
    );
  });

  /**
   * The node picker (real IPs) is fetched once, so a picker left open across
   * a mask-mode toggle would keep showing the pre-toggle list. Skips its own
   * first run — `ngOnInit` already loads it.
   */
  constructor() {
    let first = true;
    effect(() => {
      this.maskMode.enabled();
      if (first) {
        first = false;
        return;
      }
      this.loadNodes();
    });
  }

  ngOnInit(): void {
    this.loadNodes();
  }

  ngOnDestroy(): void {
    this.removeListeners();
  }

  startResize(event: MouseEvent, edge: ResizeEdge): void {
    event.preventDefault();
    this.edge = edge;
    this.activeEdge.set(edge);
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.width();
    this.resizeStartH = this.height();

    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    });
  }

  private doResize(event: MouseEvent): void {
    const dx = this.resizeStartX - event.clientX;
    const dy = this.resizeStartY - event.clientY;

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

  loadNodes(): void {
    this.isLoadingNodes.set(true);
    this.instancesService
      .instancesControllerFindAll(
        undefined,
        'running',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      )
      .subscribe({
        next: (response: InstanceResponseDto) => {
          const allInstances = (response.data || []) as InstanceWithLabels[];
          this.nodes.set(
            allInstances.filter((i) => getOwnership(i) === 'self' && !!i.ipConfig?.v4?.ip),
          );
          this.isLoadingNodes.set(false);
        },
        error: () => {
          this.nodes.set([]);
          this.isLoadingNodes.set(false);
        },
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
