import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { ApplicationResponseDto } from '../../../core/api';
import { databaseEngineOf } from '../../model/db-engine';
import { DbHaService, DatabaseHaView } from '../../service/db-ha.service';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-database-ha-card',
  imports: [
    DatePipe,
    ConfirmationDialogComponent,
    FlPanel,
    FlKeyValue,
    FlKvItem,
    FlAlert,
    FlStatus,
    FlButton,
  ],
  template: `
    @if (isPostgres() && view(); as v) {
      <fl-panel title="High availability">
        @if (!v.state || v.state.state === 'failed') {
          <button
            panelActions
            flButton="secondary"
            size="sm"
            type="button"
            (click)="dialog().open()"
          >
            Make highly available
          </button>
        }
        <div class="flex flex-col gap-3">
          <fl-status [tone]="tone()" [label]="title()" />
          <p class="text-fl-body-sm text-fl-ink-muted">{{ subtitle() }}</p>
          @if (v.state || placementLine()) {
            <fl-key-value>
              @if (v.state) {
                @if (v.state.state === 'active') {
                  <fl-kv-item key="Instances">{{ v.state.instances }}</fl-kv-item>
                }
                <fl-kv-item key="Since">{{ v.state.since | date: 'd MMM y, HH:mm' }}</fl-kv-item>
              }
              @if (placementLine()) {
                <fl-kv-item key="Placement" data-testid="database-ha-placement">{{
                  placementLine()
                }}</fl-kv-item>
              }
            </fl-key-value>
          }
          @if (error()) {
            <fl-alert tone="error" title="Could not make it highly available">{{
              error()
            }}</fl-alert>
          }
        </div>
      </fl-panel>
      <app-confirmation-dialog
        title="Make this database highly available"
        message="Flui builds an instance in each of the cluster's three locations and moves the database to them. Writes pause for a few seconds."
        confirmText="Make it highly available"
        cancelText="Not now"
        variant="info"
        [details]="details"
        (confirmed)="enable()"
      />
    }
  `,
})
export class DatabaseHaCardComponent {
  private readonly ha = inject(DbHaService);

  readonly app = input.required<ApplicationResponseDto | null>();
  readonly view = signal<DatabaseHaView | null>(null);
  readonly error = signal<string | null>(null);
  readonly dialog = viewChild.required(ConfirmationDialogComponent);

  readonly isPostgres = computed(() => databaseEngineOf(this.app()) === 'postgres');
  readonly active = computed(() => this.view()?.state?.state === 'active');

  readonly details = [
    'The copies stream from the running database until they have caught up; the application keeps working meanwhile.',
    'Then writes stop for a few seconds while the copy in a close location takes over, and the application moves to it. A write waits for whichever copy answers first.',
    'No confirmed write is lost. The single instance is kept, stopped, with its data, as the way back.',
    'The cluster must be highly available across three locations; otherwise the request is refused with the reason.',
  ];

  readonly tone = computed<StatusTone>(() => {
    const s = this.view()?.state;
    if (!s) return 'neutral';
    if (s.state === 'active') return 'success';
    if (s.state === 'copying') return 'progress';
    return 'error';
  });

  readonly title = computed(() => {
    const s = this.view()?.state;
    if (!s) return 'Single instance';
    if (s.state === 'active') return `Highly available: ${s.instances} instances, one per location`;
    if (s.state === 'copying') return 'Being made highly available';
    return 'Making it highly available stopped';
  });

  readonly subtitle = computed(() => {
    const s = this.view()?.state;
    if (!s) return 'If its server is lost, the database stops until it returns.';
    if (s.state === 'active') return 'Losing a server or a location loses no confirmed write.';
    if (s.state === 'copying') return 'The copy is catching up; the single instance still serves.';
    return s.detail ?? 'No detail recorded.';
  });

  /** Where the primary is, and how far behind each copy is. */
  readonly placementLine = computed(() => {
    const p = this.view()?.placement;
    if (!p?.primary) return '';
    const copies = p.copies.map((c) => {
      const where = c.zone ?? c.instance;
      if (!c.ready) return `${where} not ready`;
      if (!c.confirms) return `${where} not streaming`;
      return c.flushLagMs === null ? `${where} up to date` : `${where} ${c.flushLagMs} ms behind`;
    });
    return `Primary in ${p.primary.zone ?? p.primary.instance}. Copies: ${copies.join(', ')}.`;
  });

  constructor() {
    effect(() => {
      const app = this.app();
      if (app && this.isPostgres()) this.load(app.id);
    });
  }

  private load(appId: string): void {
    this.ha.get(appId).subscribe({
      next: (v) => this.view.set(v),
      error: () => this.view.set(null),
    });
  }

  enable(): void {
    const app = this.app();
    if (!app) return;
    this.error.set(null);
    this.dialog().setProcessing(true);
    this.ha.enable(app.id).subscribe({
      next: () => {
        this.dialog().close();
        this.load(app.id);
      },
      error: (e: { error?: { message?: string } }) => {
        this.dialog().close();
        this.error.set(e?.error?.message ?? 'The request was refused.');
      },
    });
  }
}
