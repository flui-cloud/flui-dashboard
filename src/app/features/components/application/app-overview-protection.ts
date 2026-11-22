import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Application } from '../../model/application.models';
import { ApplicationService } from '../../service/application.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { statusToneOf } from '../dashboard/home-state';
import { AppRecapBackupBandComponent } from './app-recap-backup-band.component';
import { AppRecapStore } from './app-recap-store';
import { availabilityFact, backupBand } from './app-recap-view';

@Component({
  selector: 'app-overview-protection',
  imports: [FlPanel, FlStatus, AppRecapBackupBandComponent],
  template: `
    <fl-panel title="Protection" data-testid="overview-protection">
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1">
          <span class="text-fl-caption text-fl-ink-muted">If a node is lost</span>
          <fl-status [tone]="availabilityTone()" [label]="availability().value" />
          @if (availability().sub) {
            <span class="text-fl-body-sm text-fl-ink-muted">{{ availability().sub }}</span>
          }
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-fl-caption text-fl-ink-muted">Backups</span>
          <app-recap-backup-band
            [band]="band()"
            [protectionLoaded]="store.protectionLoaded()"
            [runState]="store.runState()"
            [appId]="app().id"
            recapPath=""
            (backUp)="store.backUpNow($event)"
          />
        </div>
      </div>
    </fl-panel>
  `,
})
export class AppOverviewProtection {
  private readonly applications = inject(ApplicationService);
  protected readonly store = inject(AppRecapStore);
  readonly app = input.required<Application>();

  private readonly group = computed(() => {
    const id = this.app().id;
    return this.applications.applicationGroups().find((g) => g.components.some((c) => c.id === id));
  });

  protected readonly availability = computed(() =>
    availabilityFact(this.store.availability()[this.app().id]),
  );
  protected readonly availabilityTone = computed<StatusTone>(() =>
    statusToneOf(this.availability().tone),
  );
  protected readonly band = computed(() => backupBand(this.store.protection()[this.app().id]));

  private readonly key = computed(() => `${this.app().id}:${this.group()?.id ?? ''}`);

  constructor() {
    effect(() => {
      this.key();
      untracked(() => {
        const group = this.group();
        if (group) void this.store.load(group, this.app());
      });
    });
  }
}
