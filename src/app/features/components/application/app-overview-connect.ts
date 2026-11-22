import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { accessOf } from '../../model/app-access';
import { Application } from '../../model/application.models';
import { databaseEngineOf } from '../../model/db-engine';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { AppDbConnectCardComponent } from './app-db-connect-card.component';
import { AppRecapStore } from './app-recap-store';

@Component({
  selector: 'app-overview-connect',
  imports: [RouterLink, FlPanel, FlButton, AppDbConnectCardComponent],
  template: `
    <fl-panel title="Connect" data-testid="overview-connect">
      @if (!readOnly()) {
        <app-db-connect-card [app]="app()" [connInfo]="connInfo()" variant="block" />
      } @else if (sqlReader()) {
        <a flButton [routerLink]="['/db-console', app().id]">Open SQL console</a>
      } @else {
        <p class="text-fl-body-sm text-fl-ink-muted">Read-only access: no connection details.</p>
      }
    </fl-panel>
  `,
})
export class AppOverviewConnect {
  private readonly store = inject(AppRecapStore);
  readonly app = input.required<Application>();

  protected readonly readOnly = computed(() => !!accessOf(this.app())?.readOnly);
  protected readonly sqlReader = computed(() => databaseEngineOf(this.app()) === 'postgres');
  protected readonly connInfo = computed(() => this.store.connInfo()[this.app().id] ?? null);
  private readonly id = computed(() => this.app().id);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.requestConnInfo([id]));
    });
  }
}
