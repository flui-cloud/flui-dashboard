import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GroupDraft } from './group-draft';
import { TABLE } from './scaling-tabs-format';
import { GroupBoundsRowsComponent } from './group-bounds-rows.component';
import { GroupCatalogueRowsComponent } from './group-catalogue-rows.component';

/**
 * The settings table: a header, and two halves of rows that each turn on a
 * different fact about the provider.
 */
@Component({
  selector: 'app-group-settings-table',
  standalone: true,
  imports: [GroupBoundsRowsComponent, GroupCatalogueRowsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="t.card">
      <div [class]="t.scroll">
        <table [class]="t.table">
          <thead>
            <tr [class]="t.headRow">
              <th scope="col" [class]="t.th">Setting</th>
              <th scope="col" [class]="t.th">Value</th>
              <th scope="col" [class]="t.th">What it means on {{ provider() }}</th>
            </tr>
          </thead>
          <tbody app-group-bounds-rows [draft]="draft()"></tbody>
          <tbody app-group-catalogue-rows [draft]="draft()"></tbody>
        </table>
      </div>
    </div>
  `,
})
export class GroupSettingsTableComponent {
  readonly draft = input.required<GroupDraft>();

  protected readonly t = TABLE;
  protected readonly provider = computed(() => this.draft().provider());
}
