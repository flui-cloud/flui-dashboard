import { Component, computed, input } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { GroupDraft } from './group-draft';
import { GroupBoundsRowsComponent } from './group-bounds-rows.component';
import { GroupCatalogueRowsComponent } from './group-catalogue-rows.component';

@Component({
  selector: 'app-group-settings-table',
  imports: [FlPanel, GroupBoundsRowsComponent, GroupCatalogueRowsComponent],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Provisioning and node limits">
      <ng-container panelActions><ng-content select="[settingsActions]" /></ng-container>
      <app-group-bounds-rows [draft]="draft()" />
    </fl-panel>
    <fl-panel [title]="'What it may add on ' + provider()">
      <app-group-catalogue-rows [draft]="draft()" />
    </fl-panel>
  `,
})
export class GroupSettingsTableComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly provider = computed(() => this.draft().provider());
}
