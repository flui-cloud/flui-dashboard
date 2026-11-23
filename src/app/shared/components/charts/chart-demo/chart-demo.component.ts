import { Component, signal } from '@angular/core';
import { FlButton } from '../../../../ui/primitives/button';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { RingGaugeComponent } from '../ring-gauge/ring-gauge.component';
import { GradeGaugeComponent } from '../grade-gauge/grade-gauge.component';
import { TimeSeriesLineComponent } from '../time-series-line/time-series-line.component';
import { MultiStatCardComponent } from '../multi-stat-card/multi-stat-card.component';
import { StatusTimelineComponent } from '../status-timeline/status-timeline.component';
import { ProportionDonutComponent } from '../proportion-donut/proportion-donut.component';
import { ProportionBarComponent } from '../proportion-bar/proportion-bar.component';
import { GaugeChartData } from '../chart.models';
import {
  CPU_CONFIG,
  CPU_DISTRIBUTION_CONFIG,
  CPU_DISTRIBUTION_DATA,
  CPU_TIME_SERIES_CONFIG,
  CPU_TIME_SERIES_DATA,
  CUSTOM_CONFIG,
  DEMO_GAUGES,
  DISK_CONFIG,
  LATENCY_CONFIG,
  LOAD_AVERAGE_DATA,
  MEMORY_CONFIG,
  MEMORY_DISTRIBUTION_CONFIG,
  MEMORY_DISTRIBUTION_DATA,
  MEMORY_DISTRIBUTION_LABEL_CONFIG,
  MEMORY_DISTRIBUTION_LABEL_DATA,
  MEMORY_TIME_SERIES_CONFIG,
  MEMORY_TIME_SERIES_DATA,
  NETWORK_DISTRIBUTION_DATA,
  POD_DISTRIBUTION_DATA,
  STORAGE_BY_APP_CONFIG,
  STORAGE_BY_APP_DATA,
  STORAGE_DISTRIBUTION_CONFIG,
  STORAGE_DISTRIBUTION_DATA,
  SYSTEM_INFO_DATA,
  UPTIME_DATA,
  jitter,
} from './chart-demo-data';

/**
 * Chart Demo Component
 * Demonstrates all chart components with various configurations
 * Used for testing and showcasing chart capabilities
 */
@Component({
  selector: 'app-chart-demo',
  imports: [
    FlButton,
    FlPageHeader,
    FlPanel,
    RingGaugeComponent,
    GradeGaugeComponent,
    TimeSeriesLineComponent,
    MultiStatCardComponent,
    StatusTimelineComponent,
    ProportionDonutComponent,
    ProportionBarComponent,
  ],
  template: `
    <div class="fl-page">
      <fl-page-header title="Chart components">
        <span headerMeta>Reusable chart components for metrics</span>
        <div headerActions class="flex gap-2">
          <button flButton type="button" (click)="resetMetrics()">Reset metrics</button>
          <button flButton="primary" type="button" (click)="simulateMetricChange()">
            Simulate a change
          </button>
        </div>
      </fl-page-header>

      <div class="fl-stack">
        <fl-panel title="Ring gauge">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <app-ring-gauge [data]="cpuData()" [config]="cpuConfig" />
            <app-ring-gauge [data]="memoryData()" [config]="memoryConfig" />
            <app-ring-gauge [data]="diskData()" [config]="diskConfig" />
            <app-ring-gauge [data]="customData()" [config]="customConfig" />
          </div>
        </fl-panel>

        <fl-panel title="Grade gauge">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <app-grade-gauge [data]="cpuData()" [config]="cpuConfig" />
            <app-grade-gauge [data]="memoryData()" [config]="memoryConfig" />
            <app-grade-gauge [data]="diskData()" [config]="diskConfig" />
            <app-grade-gauge [data]="latencyData()" [config]="latencyConfig" />
          </div>
        </fl-panel>

        <fl-panel title="Proportion donut">
          <div class="fl-grid-2">
            <app-proportion-donut
              [data]="memoryDistributionData"
              [config]="memoryDistributionConfig"
            />
            <app-proportion-donut
              [data]="memoryDistributionLabelData"
              [config]="memoryDistributionLabelConfig"
            />
            <app-proportion-donut [data]="cpuDistributionData" [config]="cpuDistributionConfig" />
            <app-proportion-donut [data]="storageByAppData" [config]="storageByAppConfig" />
          </div>
        </fl-panel>

        <fl-panel title="Proportion bar">
          <div class="fl-stack">
            <app-proportion-bar
              [data]="storageDistributionData"
              [config]="storageDistributionConfig"
            />
            <app-proportion-bar
              [data]="podDistributionData"
              [config]="{ unit: 'pods', barHeight: 24 }"
            />
            <app-proportion-bar
              [data]="networkDistributionData"
              [config]="{ unit: 'Mbps', barHeight: 36, showPercentLabels: true }"
            />
          </div>
        </fl-panel>

        <fl-panel title="Time series">
          <div class="fl-grid-2">
            <app-time-series-line [data]="cpuTimeSeriesData" [config]="cpuTimeSeriesConfig" />
            <app-time-series-line [data]="memoryTimeSeriesData" [config]="memoryTimeSeriesConfig" />
          </div>
        </fl-panel>

        <div class="fl-grid-2">
          <app-multi-stat-card [data]="loadAverageData" [config]="{ layout: 'horizontal' }" />
          <app-multi-stat-card [data]="systemInfoData" [config]="{ layout: 'grid' }" />
        </div>

        <app-status-timeline [data]="uptimeData" [config]="{ daysToShow: 90 }" />
      </div>
    </div>
  `,
})
export class ChartDemoComponent {
  cpuData = signal<GaugeChartData>(DEMO_GAUGES.cpu);
  memoryData = signal<GaugeChartData>(DEMO_GAUGES.memory);
  diskData = signal<GaugeChartData>(DEMO_GAUGES.disk);
  customData = signal<GaugeChartData>(DEMO_GAUGES.custom);
  latencyData = signal<GaugeChartData>(DEMO_GAUGES.latency);

  cpuConfig = CPU_CONFIG;
  memoryConfig = MEMORY_CONFIG;
  diskConfig = DISK_CONFIG;
  customConfig = CUSTOM_CONFIG;
  latencyConfig = LATENCY_CONFIG;
  memoryDistributionData = MEMORY_DISTRIBUTION_DATA;
  memoryDistributionLabelData = MEMORY_DISTRIBUTION_LABEL_DATA;
  memoryDistributionConfig = MEMORY_DISTRIBUTION_CONFIG;
  memoryDistributionLabelConfig = MEMORY_DISTRIBUTION_LABEL_CONFIG;
  cpuDistributionData = CPU_DISTRIBUTION_DATA;
  cpuDistributionConfig = CPU_DISTRIBUTION_CONFIG;
  storageByAppData = STORAGE_BY_APP_DATA;
  storageByAppConfig = STORAGE_BY_APP_CONFIG;
  storageDistributionData = STORAGE_DISTRIBUTION_DATA;
  storageDistributionConfig = STORAGE_DISTRIBUTION_CONFIG;
  podDistributionData = POD_DISTRIBUTION_DATA;
  networkDistributionData = NETWORK_DISTRIBUTION_DATA;
  cpuTimeSeriesData = CPU_TIME_SERIES_DATA;
  cpuTimeSeriesConfig = CPU_TIME_SERIES_CONFIG;
  memoryTimeSeriesData = MEMORY_TIME_SERIES_DATA;
  memoryTimeSeriesConfig = MEMORY_TIME_SERIES_CONFIG;
  loadAverageData = LOAD_AVERAGE_DATA;
  systemInfoData = SYSTEM_INFO_DATA;
  uptimeData = UPTIME_DATA;

  /**
   * Simulate random metric changes
   */
  simulateMetricChange(): void {
    this.cpuData.update((d) => jitter(d, 10, 100));
    this.memoryData.update((d) => jitter(d, 7.5, 100));
    this.diskData.update((d) => jitter(d, 2.5, 100));
    this.customData.update((d) => jitter(d, 50, 1000));
    this.latencyData.update((d) => jitter(d, 15, 200));
  }

  /**
   * Reset all metrics to initial values
   */
  resetMetrics(): void {
    this.cpuData.set(DEMO_GAUGES.cpu);
    this.memoryData.set(DEMO_GAUGES.memory);
    this.diskData.set(DEMO_GAUGES.disk);
    this.customData.set(DEMO_GAUGES.custom);
    this.latencyData.set(DEMO_GAUGES.latency);
  }
}
