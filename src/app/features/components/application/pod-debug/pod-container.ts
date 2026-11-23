import { Component, computed, input } from '@angular/core';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlTable } from '../../../../ui/patterns/table';
import { FlStatus } from '../../../../ui/primitives/status';
import { ContainerDebugInfo, Probe } from '../../../model/pod-debug.models';

export function containerStateSummary(c: ContainerDebugInfo): string {
  if (c.state.running) {
    const since = c.state.running.startedAt
      ? ' since ' + new Date(c.state.running.startedAt).toLocaleString('en-GB')
      : '';
    return `Running${since}`;
  }
  if (c.state.waiting) {
    const reason = c.state.waiting.reason ?? 'Waiting';
    return c.state.waiting.message ? `${reason} — ${c.state.waiting.message}` : reason;
  }
  if (c.state.terminated) {
    const t = c.state.terminated;
    const parts = [`Terminated (${t.reason ?? '—'})`];
    if (t.exitCode != null) parts.push(`exit ${t.exitCode}`);
    if (t.message) parts.push(t.message);
    return parts.join(' · ');
  }
  return 'Unknown';
}

export function probeSummary(p: Probe | undefined): string {
  if (!p?.type) return '—';
  if (p.type === 'http') return `HTTP ${p.path ?? '/'} :${p.port ?? ''}`;
  if (p.type === 'tcp') return `TCP :${p.port ?? ''}`;
  if (p.type === 'exec') return `exec ${(p.command ?? []).join(' ')}`;
  return p.type;
}

@Component({
  selector: 'app-pod-container',
  imports: [FlKeyValue, FlKvItem, FlStatus, FlTable],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @let c = container();
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span class="fl-mono font-semibold text-fl-ink">{{ c.name }}</span>
      @if (c.ready) {
        <fl-status tone="success" label="Ready" />
      } @else {
        <fl-status tone="error" label="Not ready" />
      }
      <span class="text-fl-caption text-fl-ink-muted">Restarts: {{ c.restartCount }}</span>
    </div>

    <fl-key-value>
      <fl-kv-item key="Image" [mono]="true">{{ c.image }}</fl-kv-item>
      <fl-kv-item key="State">{{ state() }}</fl-kv-item>
      <fl-kv-item key="Requests" [mono]="true">
        {{ c.requests.cpu ?? '—' }} · {{ c.requests.memory ?? '—' }}
      </fl-kv-item>
      <fl-kv-item key="Limits" [mono]="true">
        {{ c.limits.cpu ?? '—' }} · {{ c.limits.memory ?? '—' }}
      </fl-kv-item>
      @if (c.readinessProbe) {
        <fl-kv-item key="Readiness probe" [mono]="true">{{ probe(c.readinessProbe) }}</fl-kv-item>
      }
      @if (c.livenessProbe) {
        <fl-kv-item key="Liveness probe" [mono]="true">{{ probe(c.livenessProbe) }}</fl-kv-item>
      }
      @if (c.startupProbe) {
        <fl-kv-item key="Startup probe" [mono]="true">{{ probe(c.startupProbe) }}</fl-kv-item>
      }
    </fl-key-value>

    @if (c.env.length) {
      <details>
        <summary class="cursor-pointer select-none text-fl-body-sm font-semibold text-fl-ink">
          Environment variables ({{ c.env.length }})
        </summary>
        <div class="fl-table-wrap mt-2 rounded-fl-md border border-fl-border bg-fl-surface-subtle">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col" class="is-fit">Name</th>
                <th scope="col">Value</th>
                <th scope="col" class="is-fit"><span class="fl-sr">State</span></th>
              </tr>
            </thead>
            <tbody>
              @for (e of c.env; track e.name) {
                <tr class="align-top">
                  <td class="fl-mono">{{ e.name }}</td>
                  <td class="whitespace-normal break-all">
                    @if (e.valueFrom) {
                      <span class="text-fl-ink-muted">From {{ e.valueFrom.kind }}</span>
                      <span class="fl-mono">{{ e.valueFrom.name }}.{{ e.valueFrom.key }}</span>
                    } @else if (e.value != null) {
                      <span class="fl-mono">{{ e.value }}</span>
                    } @else {
                      <span class="text-fl-ink-muted">—</span>
                    }
                  </td>
                  <td>
                    @if (e.valueFrom?.exists === false) {
                      <fl-status tone="error" label="Missing resource" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    }
  `,
})
export class PodContainer {
  readonly container = input.required<ContainerDebugInfo>();

  protected readonly state = computed(() => containerStateSummary(this.container()));

  protected probe(p: Probe): string {
    return probeSummary(p);
  }
}
