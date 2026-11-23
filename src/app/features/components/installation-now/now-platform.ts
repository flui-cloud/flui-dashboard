import { Component, input } from '@angular/core';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlUsageBar } from '../../../ui/patterns/usage-bar';
import { InstallationNow, Level, cpuLevel, memoryLevel } from '../../model/installation-now.models';
import { formatMbitPerSecond } from '../../model/registry-storage.models';
import { NowLevel, UsageBounds, usageBounds } from './now-level';

const MIB = 1024 * 1024;

@Component({
  selector: 'app-now-platform',
  imports: [FlPanel, FlEmptyState, FlTable, FlUsageBar, FlKeyValue, FlKvItem, NowLevel],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel
      title="Platform components"
      [count]="now().platform.length"
      [flush]="true"
      data-testid="now-platform"
    >
      @if (now().platform.length === 0) {
        <fl-empty-state title="No components measured" [compact]="true" />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col">CPU</th>
                <th scope="col">Memory</th>
                <th scope="col" class="is-num">Restarts, last hour</th>
              </tr>
            </thead>
            <tbody>
              @for (c of now().platform; track c.name) {
                <tr [attr.data-testid]="'now-platform-' + c.name">
                  <td class="font-medium">{{ c.name }}</td>
                  <td data-testid="now-platform-cpu">
                    @if (c.cpuPercent !== null) {
                      @let cpu = bounds(cpuOf(c.cpuPercent));
                      <fl-usage-bar
                        [percent]="c.cpuPercent"
                        [label]="'CPU of ' + c.name"
                        [warnAt]="cpu.warnAt"
                        [criticalAt]="cpu.criticalAt"
                      />
                    } @else {
                      <span class="text-fl-ink-muted">–</span>
                    }
                  </td>
                  <td data-testid="now-platform-memory">
                    @if (c.memoryPercent !== null) {
                      @let memory = bounds(memoryOf(c.memoryPercent));
                      <fl-usage-bar
                        [percent]="c.memoryPercent"
                        [label]="'Memory of ' + c.name"
                        [warnAt]="memory.warnAt"
                        [criticalAt]="memory.criticalAt"
                      />
                    } @else {
                      <span class="text-fl-ink-muted">–</span>
                    }
                  </td>
                  <td class="is-num" data-testid="now-platform-restarts">
                    <app-now-level
                      [level]="c.restartsLastHour > 0 ? 'warn' : 'ok'"
                      [label]="'' + c.restartsLastHour"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </fl-panel>

    @if (now().registry; as r) {
      <fl-panel title="Image registry, last hour" data-testid="now-registry">
        <div class="flex flex-col gap-3">
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Pulls">{{ r.requests.pulls }}</fl-kv-item>
            <fl-kv-item key="Pushes">{{ r.requests.pushes }}</fl-kv-item>
            <fl-kv-item key="Pulled out" data-testid="now-registry-out">{{
              mib(r.bytesOut)
            }}</fl-kv-item>
            <fl-kv-item key="Peak out" data-testid="now-registry-peak">{{
              mbit(r.peakBytesPerSecondOut)
            }}</fl-kv-item>
          </fl-key-value>
          <div class="fl-row text-fl-body-sm">
            <app-now-level
              data-testid="now-registry-refused"
              [level]="r.outcomes.refused > 0 ? 'warn' : 'ok'"
              [label]="r.outcomes.refused + ' refused'"
            />
            <app-now-level
              data-testid="now-registry-failed"
              [level]="r.outcomes.failed > 0 ? 'bad' : 'ok'"
              [label]="r.outcomes.failed + ' failed'"
            />
          </div>
        </div>
      </fl-panel>
    }
  `,
})
export class NowPlatformComponent {
  readonly now = input.required<InstallationNow>();

  protected cpuOf(percent: number | null): Level {
    return cpuLevel(percent);
  }

  protected memoryOf(percent: number | null): Level {
    return memoryLevel(percent);
  }

  protected bounds(level: Level): UsageBounds {
    return usageBounds(level);
  }

  protected mib(bytes: number): string {
    return `${(bytes / MIB).toFixed(bytes >= 100 * MIB ? 0 : 1)} MiB`;
  }

  protected mbit(bytesPerSecond: number): string {
    return formatMbitPerSecond(bytesPerSecond);
  }
}
