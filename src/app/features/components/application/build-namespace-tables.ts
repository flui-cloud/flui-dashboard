import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuildNamespaceResourcesResponseDto } from '../../../core/api/model/buildNamespaceResourcesResponseDto';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlStatus } from '../../../ui/primitives/status';
import { formatAge, jobStatus, podStatus, queuedStatus } from './build-namespace-format';

@Component({
  selector: 'app-build-namespace-tables',
  imports: [RouterLink, FlPanel, FlTable, FlEmptyState, FlStatus],
  host: { class: 'fl-stack' },
  template: `
    @let res = resources();
    <fl-panel title="Queue" [count]="res.queuedBuilds.length" [flush]="true">
      <span panelActions class="text-fl-body-sm text-fl-ink-muted">No worker allocated yet</span>
      @if (res.queuedBuilds.length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="build-queue-table">
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col">Branch</th>
                <th scope="col">Commit</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-num">Waiting for</th>
              </tr>
            </thead>
            <tbody>
              @for (q of res.queuedBuilds; track q.buildId) {
                @let st = queuedState(q.status);
                <tr>
                  <td class="fl-cell-name">
                    <a class="fl-link" [routerLink]="['/apps/applications', q.applicationId]">{{
                      q.appSlug ?? q.applicationId
                    }}</a>
                  </td>
                  <td class="fl-mono">{{ q.branch }}</td>
                  <td class="fl-mono">{{ q.commitSha ? q.commitSha.substring(0, 7) : '—' }}</td>
                  <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                  <td class="is-num fl-mono">{{ age(q.ageMinutes) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state [compact]="true" title="Queue is empty" />
      }
    </fl-panel>

    <fl-panel title="Build tasks" [count]="res.jobs.length" [flush]="true">
      @if (res.jobs.length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="build-tasks-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Application or type</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-num">Running for</th>
                <th scope="col" class="is-num">CPU</th>
                <th scope="col" class="is-num">Memory</th>
              </tr>
            </thead>
            <tbody>
              @for (job of res.jobs; track job.name) {
                @let st = jobState(job.status);
                <tr>
                  <td class="fl-mono">{{ job.buildId ?? job.name }}</td>
                  <td>
                    @if (job.appSlug) {
                      {{ job.appSlug }}
                    } @else if (job.purpose) {
                      <span class="fl-mono text-fl-ink-muted">{{ job.purpose }}</span>
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                  <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                  <td class="is-num fl-mono">{{ age(job.ageMinutes) }}</td>
                  <td class="is-num fl-mono">{{ job.cpuRequest }}</td>
                  <td class="is-num fl-mono">{{ job.memoryRequest }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state [compact]="true" title="No active build tasks" />
      }
    </fl-panel>

    <fl-panel title="Build workers" [count]="res.pods.length" [flush]="true">
      @if (res.pods.length > 0) {
        <div class="fl-table-wrap">
          <table flTable density="dense" data-testid="build-workers-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Application</th>
                <th scope="col">Status</th>
                <th scope="col" class="is-num">Running for</th>
                <th scope="col">Processes</th>
              </tr>
            </thead>
            <tbody>
              @for (pod of res.pods; track pod.name) {
                @let st = podState(pod.phase);
                <tr>
                  <td class="fl-mono">{{ pod.buildId ?? pod.name }}</td>
                  <td>{{ pod.appSlug ?? '—' }}</td>
                  <td><fl-status [tone]="st.tone" [label]="st.label" /></td>
                  <td class="is-num fl-mono">{{ age(pod.ageMinutes) }}</td>
                  <td>
                    <div class="fl-row">
                      @for (c of pod.containers; track c.name) {
                        <fl-status [tone]="c.ready ? 'success' : 'error'" [label]="c.name" />
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state [compact]="true" title="No active workers" />
      }
    </fl-panel>
  `,
})
export class BuildNamespaceTables {
  readonly resources = input.required<BuildNamespaceResourcesResponseDto>();

  protected readonly age = formatAge;
  protected readonly queuedState = queuedStatus;
  protected readonly jobState = jobStatus;
  protected readonly podState = podStatus;
}
