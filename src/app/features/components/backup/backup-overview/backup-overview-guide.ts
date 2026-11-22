import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlTable } from '../../../../ui/patterns/table';

interface CoverRow {
  what: string;
  how: string;
  where: string;
}

const COVERS: readonly CoverRow[] = [
  {
    what: 'A cluster',
    how: 'Every app on it, new ones included: databases with their own engine, other volumes as encrypted daily snapshots.',
    where: 'Clusters, on this page',
  },
  {
    what: 'A database',
    how: 'Every change shipped off the cluster as it happens, so it can be restored to any moment in the window. Images that cannot do that get nightly dumps.',
    where: 'The database, Backup section',
  },
  {
    what: 'Flui itself',
    how: 'The control-plane database, sealed to a recipient you hold. A rebuild starts from it when the cluster running Flui is gone.',
    where: 'Flui itself, on this page',
  },
];

@Component({
  selector: 'app-backup-overview-guide',
  imports: [RouterLink, FlPanel, FlTable],
  host: { class: 'fl-grid-2' },
  template: `
    <fl-panel title="What each backup covers" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">How it is protected</th>
              <th scope="col">Set up in</th>
            </tr>
          </thead>
          <tbody>
            @for (row of covers; track row.what) {
              <tr>
                <td class="font-medium">{{ row.what }}</td>
                <td class="is-wrap text-fl-ink-muted">{{ row.how }}</td>
                <td class="whitespace-normal text-fl-ink-muted">{{ row.where }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>

    <fl-panel title="Backup setup" [flush]="true">
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">What it holds</th>
              <th scope="col" class="is-num">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a class="fl-link" routerLink="/management/backup/destinations">Destinations</a>
              </td>
              <td class="is-wrap text-fl-ink-muted">
                S3-compatible storage shared by your backup policies, {{ totalUsage() }} stored.
              </td>
              <td class="is-num">{{ destinations() }}</td>
            </tr>
            <tr>
              <td><a class="fl-link" routerLink="/management/backup/policies">Policies</a></td>
              <td class="is-wrap text-fl-ink-muted">
                One policy per app and engine, with its schedule and health.
                @if (degraded() > 0) {
                  {{ degraded() }} degraded.
                }
              </td>
              <td class="is-num">{{ policies() }}</td>
            </tr>
            <tr>
              <td><a class="fl-link" routerLink="/management/backup/jobs">Backup jobs</a></td>
              <td class="is-wrap text-fl-ink-muted">
                On-demand and scheduled runs, with the status of each copy.
              </td>
              <td class="is-num text-fl-ink-muted">—</td>
            </tr>
            <tr>
              <td><a class="fl-link" routerLink="/management/backup/restore">Restore</a></td>
              <td class="is-wrap text-fl-ink-muted">
                Database restores into a new database, and their history.
              </td>
              <td class="is-num">{{ restores() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class BackupOverviewGuide {
  readonly destinations = input(0);
  readonly policies = input(0);
  readonly degraded = input(0);
  readonly restores = input(0);
  readonly totalUsage = input('—');

  protected readonly covers = COVERS;
}
