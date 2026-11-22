import { Component, input, signal } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { RepositoryMapDto } from '../../../core/api/model/repositoryMapDto';
import { VerdictDto } from '../../../core/api/model/verdictDto';
import { CitationChipComponent } from './citation-chip.component';
import { FirmnessBadgeComponent } from './firmness-badge.component';
import { readinessLabel, readinessOf, readinessTone, unitName } from './repo-map-view';

@Component({
  selector: 'app-repo-map-units',
  imports: [FlPanel, FlTable, FlButton, FlStatus, CitationChipComponent, FirmnessBadgeComponent],
  template: `
    <fl-panel title="What would run" [flush]="true">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-pressed]="showEvidence()"
        (click)="showEvidence.set(!showEvidence())"
      >
        {{ showEvidence() ? 'Hide evidence' : 'Show evidence' }}
      </button>
      <div class="fl-table-wrap">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Build</th>
              <th scope="col">Readiness</th>
              @if (showEvidence()) {
                <th scope="col">Evidence</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (u of map().units; track u.id) {
              <tr>
                <td class="fl-mono">{{ name(u.id) }}</td>
                <td>
                  {{ u.build.strategy }}
                  @if (u.port) {
                    <span class="fl-mono text-fl-ink-muted">:{{ u.port.value }}</span>
                  }
                </td>
                <td>
                  <span class="fl-row">
                    <fl-status [tone]="tone(u.id)" [label]="label(u.id)" />
                    @if (skipped().has(u.id)) {
                      <span class="text-fl-ink-muted">not in the flui.yaml</span>
                    }
                  </span>
                </td>
                @if (showEvidence()) {
                  <td>
                    <span class="fl-row items-start">
                      <app-firmness-badge [level]="u.confidence" />
                      <app-citation-chip [evidence]="u.evidence" [baseUrl]="fileBase()" />
                    </span>
                  </td>
                }
              </tr>
            }
            @for (s of map().services; track $index) {
              <tr>
                <td class="fl-mono">{{ s.name }}</td>
                <td>
                  @if (s.block) {
                    <span class="fl-mono">{{ s.block }}</span>
                  } @else {
                    <fl-status tone="error" label="No block" />
                  }
                </td>
                <td></td>
                @if (showEvidence()) {
                  <td>
                    <span class="fl-row items-start">
                      <app-firmness-badge [level]="s.confidence" />
                      <app-citation-chip
                        [evidence]="s.evidence"
                        [fallback]="s.source"
                        [baseUrl]="fileBase()"
                      />
                    </span>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </fl-panel>
  `,
})
export class RepoMapUnits {
  readonly map = input.required<RepositoryMapDto>();
  readonly verdict = input.required<VerdictDto>();
  readonly skipped = input<ReadonlySet<string>>(new Set());
  readonly fileBase = input<string | null>(null);

  protected readonly showEvidence = signal(false);

  protected name(id: string): string {
    return unitName(id);
  }

  protected tone(unitId: string) {
    return readinessTone(readinessOf(this.verdict(), unitId));
  }

  protected label(unitId: string): string {
    return readinessLabel(readinessOf(this.verdict(), unitId));
  }
}
