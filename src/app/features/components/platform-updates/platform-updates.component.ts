import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';
import { PlatformUpdateService } from '../../service/platform-update.service';
import { PlatformUpdateProgressComponent } from './platform-update-progress.component';
import { PlatformUpdateHistoryComponent } from './platform-update-history.component';
import { PlatformUpdateDetailsComponent } from './platform-update-details.component';
import { PlatformUpgradeConfirmComponent } from './platform-upgrade-confirm.component';
import { CurrentSurfaceService } from '../../../core/services/current-surface.service';
import { FlPageHeader } from '../../../ui/patterns/page-header';
import { Crumb } from '../../../ui/patterns/breadcrumb';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { checkedAgo } from './platform-update-format';
import {
  PlatformUpdatesSurfaceInput,
  PlatformUpdatesSurfaceRevision,
  buildPlatformUpdatesSurface,
  presentedContent,
} from './platform-updates-surface';

const BREADCRUMB: readonly Crumb[] = [{ label: 'Administration' }, { label: 'Updates' }];

@Component({
  selector: 'app-platform-updates',
  imports: [
    DatePipe,
    FlPageHeader,
    FlPanel,
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlStatus,
    PlatformUpdateProgressComponent,
    PlatformUpdateHistoryComponent,
    PlatformUpdateDetailsComponent,
    PlatformUpgradeConfirmComponent,
  ],
  providers: [provideIcons({ lucideRefreshCw })],
  templateUrl: './platform-updates.component.html',
})
export class PlatformUpdatesComponent implements OnInit, OnDestroy {
  protected readonly updates = inject(PlatformUpdateService);
  private readonly currentSurface = inject(CurrentSurfaceService);

  protected readonly confirming = signal(false);
  protected readonly acknowledged = signal(false);
  protected readonly detailsOpen = signal(false);
  protected readonly breadcrumb = BREADCRUMB;

  private readonly surfaceRevision = new PlatformUpdatesSurfaceRevision();

  protected readonly surface = computed(() => {
    const input: PlatformUpdatesSurfaceInput = {
      loading: this.updates.loading(),
      checking: this.updates.checking(),
      apiUnreachable: this.updates.apiUnreachable(),
      status: this.updates.status(),
      operation: this.updates.operation(),
      history: this.updates.history(),
      confirming: this.confirming(),
      acknowledged: this.acknowledged(),
    };
    return buildPlatformUpdatesSurface(input, {
      revision: this.surfaceRevision.next(presentedContent(input)),
      generatedAt: new Date().toISOString(),
    });
  });

  constructor() {
    effect(() => {
      this.currentSurface.set(this.surface());
    });
  }

  protected readonly stopped = computed(() => {
    if (this.updates.running()) return null;
    const last = this.updates.history()[0];
    return last?.schema === 2 && last.status === 'FAILED' ? last : null;
  });

  ngOnInit(): void {
    void Promise.all([this.updates.refresh(), this.updates.loadHistory()]);
  }

  ngOnDestroy(): void {
    if (!this.updates.running()) this.updates.stopPolling();
    this.currentSurface.set(null);
  }

  protected async check(): Promise<void> {
    await this.updates.check();
  }

  protected openConfirm(): void {
    this.acknowledged.set(false);
    this.confirming.set(true);
    const version = this.updates.availableVersion();
    if (version) void this.updates.plan(version);
  }

  protected async resume(operationId: string): Promise<void> {
    await this.updates.resume(operationId);
  }

  protected closeConfirm(): void {
    this.confirming.set(false);
  }

  protected readonly checkedAgo = checkedAgo;

  protected readonly headerStatus = computed<{ tone: StatusTone; label: string } | null>(() => {
    const status = this.updates.status();
    if (this.updates.running()) return { tone: 'progress', label: 'Updating' };
    if (!status) return null;
    if (this.updates.checkFailed()) return { tone: 'neutral', label: 'Not checked' };
    if (status.updateAvailable) return { tone: 'warning', label: 'Update available' };
    return { tone: 'success', label: 'Up to date' };
  });

  protected readonly releaseNotes = computed(() => this.updates.status()?.notes.join('\n') ?? '');
}
