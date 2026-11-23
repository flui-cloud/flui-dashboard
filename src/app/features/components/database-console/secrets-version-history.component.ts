import { Component, inject } from '@angular/core';
import { SecretRead } from '../../model/secrets-console.models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { SecretsConsoleStateService } from './secrets-console-state.service';

type SecretVersion = SecretRead['versions'][number];

function latest(sec: SecretRead): number {
  return Math.max(...sec.versions.map((v) => v.version));
}

@Component({
  selector: 'app-secrets-version-history',
  imports: [FlButton, FlPanel, FlStatus, FlTable],
  host: { class: 'block' },
  template: `
    @if (!s.isNew() && s.selected(); as sec) {
      @if (sec.versions.length) {
        <fl-panel title="Version history" [count]="sec.versions.length" [flush]="true">
          <div class="fl-table-wrap relative">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Created</th>
                  <th scope="col">State</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (v of reversed(sec.versions); track v.version) {
                  <tr [class.is-selected]="s.viewVersion() === v.version">
                    <td>
                      <button
                        type="button"
                        class="fl-link fl-mono"
                        [attr.aria-current]="s.viewVersion() === v.version ? 'true' : null"
                        (click)="s.changeVersion(v.version)"
                      >
                        v{{ v.version }}
                      </button>
                    </td>
                    <td class="fl-mono text-fl-ink-muted">{{ v.createdTime }}</td>
                    <td>
                      <fl-status [tone]="tone(v, sec)" [label]="label(v, sec)" />
                    </td>
                    <td class="is-fit">
                      @if (!v.destroyed && v.deleted) {
                        <button
                          flButton="ghost"
                          size="sm"
                          type="button"
                          [disabled]="s.readOnly()"
                          (click)="s.undelete(v.version)"
                        >
                          Undelete
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </fl-panel>
      }
    }
  `,
})
export class SecretsVersionHistoryComponent {
  protected readonly s = inject(SecretsConsoleStateService);

  reversed(versions: SecretRead['versions']): SecretRead['versions'] {
    return [...versions].reverse();
  }

  protected tone(v: SecretVersion, sec: SecretRead): StatusTone {
    if (v.destroyed) return 'error';
    if (v.deleted) return 'warning';
    return v.version === latest(sec) ? 'success' : 'neutral';
  }

  protected label(v: SecretVersion, sec: SecretRead): string {
    if (v.destroyed) return 'Destroyed';
    if (v.deleted) return 'Deleted';
    return v.version === latest(sec) ? 'Latest' : 'Older';
  }
}
