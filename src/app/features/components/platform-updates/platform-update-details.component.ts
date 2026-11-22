import { Component, input, model } from '@angular/core';
import { PlatformUpdateStatus } from '../../service/platform-update.service';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { AlertTone, FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { changeLabel } from './platform-update-format';

const ADVISORY_TONES: Record<string, AlertTone> = {
  info: 'info',
  warning: 'warning',
  blocker: 'error',
};

@Component({
  selector: 'app-platform-update-details',
  imports: [FlPanel, FlTable, FlAlert, FlButton],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Components" [count]="status().components.length" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        {{ open() ? 'Hide details' : 'Show details' }}
      </button>

      @if (open()) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">Role</th>
                <th scope="col">Version</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              @for (component of status().components; track component.key) {
                <tr [class.text-fl-ink-muted]="!component.changed || !component.installed">
                  <td class="fl-mono font-medium">{{ component.deploymentName }}</td>
                  <td class="is-wrap text-fl-ink-secondary">
                    {{ component.role }}
                    @if (component.restartsControlPlane) {
                      · restarts once
                    }
                  </td>
                  <td>
                    @if (!component.installed) {
                      <span class="text-fl-ink-muted">Not installed</span>
                    } @else {
                      <span class="fl-mono">
                        @if (component.changed) {
                          <span class="text-fl-ink-muted">{{ component.installedVersion }}</span> →
                        }
                        <span class="font-semibold">{{
                          component.targetVersion ?? component.installedVersion ?? '—'
                        }}</span>
                      </span>
                      @if (!component.installedIsRelease && !component.changed) {
                        <span class="text-fl-caption text-fl-ink-muted"> · build</span>
                      }
                      @if (!component.observed) {
                        <span class="text-fl-caption text-fl-ink-muted">
                          · pinned, not read from the cluster</span
                        >
                      }
                    }
                  </td>
                  <td class="text-fl-ink-secondary">
                    {{ change(component, status().availableVersion) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (status().advisories.length > 0) {
          <div class="grid gap-3 border-t border-fl-border-subtle p-4 sm:grid-cols-2">
            @for (advisory of status().advisories; track advisory.title) {
              <fl-alert [tone]="advisoryTone(advisory.level)" [title]="advisory.title">
                {{ advisory.detail }}
              </fl-alert>
            }
          </div>
        }
      }
    </fl-panel>
  `,
})
export class PlatformUpdateDetailsComponent {
  readonly status = input.required<PlatformUpdateStatus>();
  readonly open = model(true);

  protected readonly change = changeLabel;

  protected advisoryTone(level: string): AlertTone {
    return ADVISORY_TONES[level] ?? 'info';
  }
}
