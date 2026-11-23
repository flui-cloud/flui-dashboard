import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideRefreshCw, lucideX } from '@ng-icons/lucide';
import { EnvVarDetectionResultDto } from '../../../core/api/model/envVarDetectionResultDto';
import { EnvVarCandidateDto } from '../../../core/api/model/envVarCandidateDto';
import { DetectedEnvVarDto } from '../../../core/api/model/detectedEnvVarDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';

@Component({
  selector: 'app-env-suggestions-panel',
  imports: [FlAlert, FlTable, FlButton, FlIcon, FlStatus],
  providers: [provideIcons({ lucideRefreshCw, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (loading()) {
      <div class="flex items-center justify-between gap-3">
        <fl-status tone="progress" label="Analyzing the repository for environment variables" />
        <button flButton="ghost" size="sm" type="button" (click)="cancelDetection.emit()">
          <fl-icon name="lucideX" />
          Stop
        </button>
      </div>
    } @else if (error()) {
      <fl-alert tone="warning" title="Variables were not detected">
        {{ error() }} Add variables manually below.
        <button alertActions flButton size="sm" type="button" (click)="reanalyze.emit()">
          <fl-icon name="lucideRefreshCw" />
          Retry
        </button>
      </fl-alert>
    } @else if (result(); as r) {
      <div class="flex items-center justify-between gap-3">
        <span class="text-fl-body-sm font-semibold">Detected variables</span>
        <button flButton size="sm" type="button" (click)="reanalyze.emit()">
          <fl-icon name="lucideRefreshCw" />
          Analyze again
        </button>
      </div>

      @if (r.isFallback) {
        <fl-alert tone="warning" title="List may be incomplete">
          Detected from the base configuration. Check it before you continue.
        </fl-alert>
      }

      @if (r.candidates.length === 0 && !r.isFallback) {
        <fl-alert tone="info" title="No variable files found">
          Add variables manually below.
        </fl-alert>
      }

      @if (r.candidates.length > 0) {
        <div class="fl-table-wrap rounded-fl-md border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Pattern</th>
                <th scope="col">Framework</th>
                <th scope="col" class="is-num">Variables</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (candidate of r.candidates; track candidate.sourceFile; let i = $index) {
                <tr [class.is-selected]="i === selectedIndex()">
                  <td class="fl-mono">
                    {{ candidate.sourceFile }}
                    @if (i === 0 && r.candidates.length > 1) {
                      <span class="font-sans text-fl-ink-muted"> (recommended)</span>
                    }
                  </td>
                  <td class="fl-mono text-fl-ink-muted">{{ candidate.detectedPattern ?? '' }}</td>
                  <td class="text-fl-ink-secondary">{{ candidate.sourceFrameworkHint ?? '' }}</td>
                  <td class="is-num">{{ candidate.vars.length }}</td>
                  <td class="is-fit">
                    @if (i === selectedIndex()) {
                      <fl-status tone="success" label="Applied" />
                    } @else {
                      <button flButton size="sm" type="button" (click)="candidateSelected.emit(i)">
                        Use these
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @let readOnlyVars = getReadOnlyVars(r.candidates[selectedIndex()]);
      @if (readOnlyVars.length > 0) {
        <span class="text-fl-body-sm font-semibold">Fixed in the Dockerfile</span>
        <div class="fl-table-wrap rounded-fl-md border border-fl-border">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Value</th>
                <th scope="col">Secret</th>
              </tr>
            </thead>
            <tbody>
              @for (v of readOnlyVars; track v.name) {
                <tr>
                  <td class="fl-mono">{{ v.name }}</td>
                  <td class="fl-mono text-fl-ink-muted">{{ v.defaultValue ?? 'Not set' }}</td>
                  <td class="text-fl-ink-muted">{{ v.sensitive ? 'Yes' : 'No' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class EnvSuggestionsPanelComponent {
  loading = input.required<boolean>();
  result = input<EnvVarDetectionResultDto | null>(null);
  error = input<string | null>(null);
  selectedIndex = input<number>(0);

  cancelDetection = output<void>();
  candidateSelected = output<number>();
  reanalyze = output<void>();

  getReadOnlyVars(candidate: EnvVarCandidateDto | undefined): DetectedEnvVarDto[] {
    if (!candidate) return [];
    return candidate.vars.filter((v) => v.readOnly);
  }
}
