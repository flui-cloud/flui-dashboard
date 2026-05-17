import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RingGaugeComponent } from '../ring-gauge/ring-gauge.component';
import { GradeGaugeComponent } from '../grade-gauge/grade-gauge.component';
import { TimeSeriesLineComponent } from '../time-series-line/time-series-line.component';
import { MultiStatCardComponent } from '../multi-stat-card/multi-stat-card.component';
import { StatusTimelineComponent } from '../status-timeline/status-timeline.component';
import { ProportionDonutComponent } from '../proportion-donut/proportion-donut.component';
import { ProportionBarComponent } from '../proportion-bar/proportion-bar.component';
import {
  GaugeChartData,
  GaugeChartConfig,
  TimeSeriesChartData,
  TimeSeriesChartConfig,
  MultiStatCardData,
  StatusTimelineData,
  ProportionDonutData,
  ProportionDonutConfig,
  ProportionBarData,
  ProportionBarConfig
} from '../chart.models';

/**
 * Chart Demo Component
 * Demonstrates all chart components with various configurations
 * Used for testing and showcasing chart capabilities
 */
@Component({
  selector: 'app-chart-demo',
  standalone: true,
  imports: [
    CommonModule,
    RingGaugeComponent,
    GradeGaugeComponent,
    TimeSeriesLineComponent,
    MultiStatCardComponent,
    StatusTimelineComponent,
    ProportionDonutComponent,
    ProportionBarComponent
  ],
  template: `
    <div class="p-8 space-y-8 bg-background">
      <div>
        <h1 class="text-3xl font-bold mb-2">Chart Components Demo</h1>
        <p class="text-muted-foreground">
          Showcase of reusable chart components for metrics visualization
        </p>
      </div>

      <!-- Ring Gauge Examples -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Ring Gauge (Circular)</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- CPU Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-ring-gauge
              [data]="cpuData()"
              [config]="cpuConfig"
            />
          </div>

          <!-- Memory Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-ring-gauge
              [data]="memoryData()"
              [config]="memoryConfig"
            />
          </div>

          <!-- Disk Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-ring-gauge
              [data]="diskData()"
              [config]="diskConfig"
            />
          </div>

          <!-- Custom Metric -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-ring-gauge
              [data]="customData()"
              [config]="customConfig"
            />
          </div>
        </div>
      </section>

      <!-- Grade Gauge Examples -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Grade Gauge (Semicircular)</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- CPU Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-grade-gauge
              [data]="cpuData()"
              [config]="cpuConfig"
            />
          </div>

          <!-- Memory Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-grade-gauge
              [data]="memoryData()"
              [config]="memoryConfig"
            />
          </div>

          <!-- Disk Usage -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-grade-gauge
              [data]="diskData()"
              [config]="diskConfig"
            />
          </div>

          <!-- Network Latency -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-grade-gauge
              [data]="latencyData()"
              [config]="latencyConfig"
            />
          </div>
        </div>
      </section>

      <!-- Proportion Donut Charts -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Proportion Charts (Distribution)</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Modern Donut with padAngle -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-donut
              [data]="memoryDistributionData"
              [config]="memoryDistributionConfig"
            />
          </div>

          <!-- Classic with Label Lines -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-donut
              [data]="memoryDistributionLabelData"
              [config]="memoryDistributionLabelConfig"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Nightingale Radius Mode -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-donut
              [data]="cpuDistributionData"
              [config]="cpuDistributionConfig"
            />
          </div>

          <!-- Nightingale Area Mode -->
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-donut
              [data]="storageByAppData"
              [config]="storageByAppConfig"
            />
          </div>
        </div>
      </section>

      <!-- Proportion Bar Charts -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Proportion Bar (Compact Distribution)</h2>
        <div class="grid grid-cols-1 gap-6">
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-bar
              [data]="storageDistributionData"
              [config]="storageDistributionConfig"
            />
          </div>
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-bar
              [data]="podDistributionData"
              [config]="{ unit: 'pods', barHeight: 24 }"
            />
          </div>
          <div class="bg-card border border-border rounded-lg p-6">
            <app-proportion-bar
              [data]="networkDistributionData"
              [config]="{ unit: 'Mbps', barHeight: 36, showPercentLabels: true }"
            />
          </div>
        </div>
      </section>

      <!-- Time Series Line Chart -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Time Series Line Chart</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-card border border-border rounded-lg p-6">
            <app-time-series-line
              [data]="cpuTimeSeriesData"
              [config]="cpuTimeSeriesConfig"
            />
          </div>
          <div class="bg-card border border-border rounded-lg p-6">
            <app-time-series-line
              [data]="memoryTimeSeriesData"
              [config]="memoryTimeSeriesConfig"
            />
          </div>
        </div>
      </section>

      <!-- Multi-Stat Cards -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Multi-Stat Cards</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <app-multi-stat-card
            [data]="loadAverageData"
            [config]="{ layout: 'horizontal' }"
          />
          <app-multi-stat-card
            [data]="systemInfoData"
            [config]="{ layout: 'grid' }"
          />
        </div>
      </section>

      <!-- Status Timeline -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Status Timeline (Uptime)</h2>
        <app-status-timeline
          [data]="uptimeData"
          [config]="{ daysToShow: 90 }"
        />
      </section>

      <!-- Controls -->
      <section>
        <h2 class="text-2xl font-semibold mb-4">Interactive Controls</h2>
        <div class="bg-card border border-border rounded-lg p-6 space-y-4">
          <div class="flex gap-4">
            <button
              (click)="simulateMetricChange()"
              class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Simulate Metric Change
            </button>
            <button
              (click)="resetMetrics()"
              class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
            >
              Reset Metrics
            </button>
          </div>
          <p class="text-sm text-muted-foreground">
            Click "Simulate Metric Change" to see animated updates and trend indicators
          </p>
        </div>
      </section>
    </div>
  `
})
export class ChartDemoComponent {
  // CPU Data
  cpuData = signal<GaugeChartData>({
    value: 45,
    title: 'CPU Usage',
    subtitle: '4 cores active',
    previousValue: 40
  });

  cpuConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: {
      warning: 70,
      danger: 90
    },
    height: '240px'
  };

  // Memory Data
  memoryData = signal<GaugeChartData>({
    value: 82,
    title: 'Memory',
    subtitle: '8.2 GB / 10 GB',
    previousValue: 78
  });

  memoryConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: {
      warning: 75,
      danger: 90
    },
    height: '240px'
  };

  // Disk Data
  diskData = signal<GaugeChartData>({
    value: 65,
    title: 'Disk Usage',
    subtitle: '325 GB / 500 GB'
  });

  diskConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: {
      warning: 80,
      danger: 95
    },
    height: '240px'
  };

  // Custom Metric
  customData = signal<GaugeChartData>({
    value: 15,
    title: 'Network Load',
    subtitle: '150 Mbps'
  });

  customConfig: GaugeChartConfig = {
    min: 0,
    max: 1000,
    unit: ' Mbps',
    severity: 'success',
    height: '240px',
    valueFormatter: (value) => value.toFixed(0)
  };

  // Latency Data
  latencyData = signal<GaugeChartData>({
    value: 45,
    title: 'Latency',
    subtitle: 'API Response Time'
  });

  latencyConfig: GaugeChartConfig = {
    min: 0,
    max: 200,
    unit: 'ms',
    thresholds: {
      warning: 100,
      danger: 150
    },
    height: '240px'
  };

  // Distribution Data - Memory by Application
  memoryDistributionData: ProportionDonutData = {
    title: 'Memory by Application',
    subtitle: 'Modern style with legend',
    slices: [
      { name: 'API Gateway', value: 2048 },
      { name: 'Auth Service', value: 1024 },
      { name: 'Worker Pool', value: 1536 },
      { name: 'Cache Layer', value: 768 },
      { name: 'Monitoring', value: 512 },
      { name: 'Other', value: 256 }
    ]
  };

  // Memory with Labels (for label line demo)
  memoryDistributionLabelData: ProportionDonutData = {
    title: 'Memory by Application',
    subtitle: 'Classic style with label lines',
    slices: [
      { name: 'API Gateway', value: 2048 },
      { name: 'Auth Service', value: 1024 },
      { name: 'Worker Pool', value: 1536 },
      { name: 'Cache Layer', value: 768 },
      { name: 'Monitoring', value: 512 },
      { name: 'Other', value: 256 }
    ]
  };

  memoryDistributionConfig: ProportionDonutConfig = {
    unit: 'MB',
    height: '380px',
    padAngle: 5,
    borderRadius: 10,
    innerRadius: 0.4,
    legendPosition: 'top'
  };

  // Memory with Label Lines (classic style)
  memoryDistributionLabelConfig: ProportionDonutConfig = {
    unit: 'MB',
    height: '380px',
    padAngle: 5,
    borderRadius: 10,
    innerRadius: 0.4,
    showLabels: true,
    showLegend: false
  };

  // Distribution Data - CPU by Namespace (Nightingale Radius)
  cpuDistributionData: ProportionDonutData = {
    title: 'CPU by Namespace',
    subtitle: 'Nightingale Chart - Radius Mode',
    slices: [
      { name: 'production', value: 40 },
      { name: 'staging', value: 33 },
      { name: 'monitoring', value: 28 },
      { name: 'kube-system', value: 22 },
      { name: 'development', value: 20 },
      { name: 'testing', value: 15 }
    ]
  };

  cpuDistributionConfig: ProportionDonutConfig = {
    unit: 'vCPU',
    legendPosition: 'top',
    height: '380px',
    roseType: 'radius',
    borderRadius: 5,
    innerRadius: 0.2
  };

  // Storage by App (Nightingale Area)
  storageByAppData: ProportionDonutData = {
    title: 'Storage by Application',
    subtitle: 'Nightingale Chart - Area Mode',
    slices: [
      { name: 'PostgreSQL', value: 120 },
      { name: 'Elasticsearch', value: 85 },
      { name: 'Redis', value: 68 },
      { name: 'MongoDB', value: 45 },
      { name: 'App Logs', value: 32 },
      { name: 'Backups', value: 28 }
    ]
  };

  storageByAppConfig: ProportionDonutConfig = {
    unit: 'GB',
    legendPosition: 'top',
    height: '380px',
    roseType: 'area',
    borderRadius: 5,
    innerRadius: 0.2
  };

  // Bar Distribution - Storage
  storageDistributionData: ProportionBarData = {
    title: 'Storage Distribution',
    subtitle: 'Persistent volume usage by application',
    slices: [
      { name: 'PostgreSQL', value: 120 },
      { name: 'Redis', value: 32 },
      { name: 'Elasticsearch', value: 85 },
      { name: 'App Logs', value: 45 },
      { name: 'Backups', value: 68 }
    ]
  };

  storageDistributionConfig: ProportionBarConfig = {
    unit: 'GB',
    barHeight: 32
  };

  // Bar Distribution - Pods per namespace
  podDistributionData: ProportionBarData = {
    title: 'Pods per Namespace',
    slices: [
      { name: 'production', value: 24 },
      { name: 'staging', value: 12 },
      { name: 'monitoring', value: 8 },
      { name: 'kube-system', value: 15 },
      { name: 'development', value: 6 }
    ]
  };

  // Bar Distribution - Network bandwidth
  networkDistributionData: ProportionBarData = {
    title: 'Network Bandwidth by Service',
    subtitle: 'Current outbound traffic',
    slices: [
      { name: 'API Gateway', value: 450 },
      { name: 'CDN Origin', value: 320 },
      { name: 'WebSocket', value: 180 },
      { name: 'gRPC Internal', value: 95 },
      { name: 'Metrics Export', value: 55 }
    ]
  };

  // Time Series Data - CPU History
  cpuTimeSeriesData: TimeSeriesChartData = {
    title: 'CPU Usage History',
    series: [{
      name: 'CPU',
      data: this.generateTimeSeriesData(30, 40, 70),
      showArea: true,
      smooth: true
    }]
  };

  cpuTimeSeriesConfig: TimeSeriesChartConfig = {
    unit: '%',
    showGrid: true,
    showLegend: false,
    height: '300px',
    thresholds: {
      warning: 70,
      danger: 90
    }
  };

  // Time Series Data - Memory History
  memoryTimeSeriesData: TimeSeriesChartData = {
    title: 'Memory Usage History',
    series: [
      {
        name: 'Used',
        data: this.generateTimeSeriesData(30, 60, 85),
        showArea: true,
        smooth: true,
        color: '#3b82f6'
      },
      {
        name: 'Cached',
        data: this.generateTimeSeriesData(30, 10, 20),
        showArea: true,
        smooth: true,
        color: '#8b5cf6'
      }
    ]
  };

  memoryTimeSeriesConfig: TimeSeriesChartConfig = {
    unit: '%',
    showGrid: true,
    showLegend: true,
    height: '300px'
  };

  // Multi-Stat Card - Load Averages
  loadAverageData: MultiStatCardData = {
    title: 'System Load Average',
    subtitle: 'Load over 1, 5, and 15 minutes',
    stats: [
      { label: '1 min', value: 1.23, trend: 'up', trendValue: '+0.05' },
      { label: '5 min', value: 1.45, trend: 'stable' },
      { label: '15 min', value: 1.38, trend: 'down', trendValue: '-0.10' }
    ]
  };

  // Multi-Stat Card - System Info
  systemInfoData: MultiStatCardData = {
    title: 'System Information',
    subtitle: 'Current system metrics',
    stats: [
      { label: 'Uptime', value: '15d 4h', severity: 'success' },
      { label: 'Processes', value: '342', severity: 'info' },
      { label: 'Threads', value: '1,245', severity: 'info' },
      { label: 'Users', value: '12', severity: 'neutral' }
    ]
  };

  // Status Timeline - Uptime
  uptimeData: StatusTimelineData = {
    title: 'Cluster Uptime History',
    subtitle: 'Last 90 days availability',
    uptimePercentage: 99.95,
    events: this.generateUptimeEvents(90)
  };

  /**
   * Generate mock time series data
   */
  private generateTimeSeriesData(points: number, minValue: number, maxValue: number): any[] {
    const data = [];
    const now = Date.now();
    const interval = 5 * 60 * 1000; // 5 minutes

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = now - (i * interval);
      const value = minValue + Math.random() * (maxValue - minValue);
      data.push({ timestamp, value });
    }

    return data;
  }

  /**
   * Generate mock uptime events
   */
  private generateUptimeEvents(days: number): any[] {
    const events = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - i));

      // 99.95% uptime means ~3-4 incidents in 90 days
      const isIncident = Math.random() < 0.005;

      if (isIncident) {
        const incidents = ['down', 'degraded', 'maintenance'];
        const status = incidents[Math.floor(Math.random() * incidents.length)];
        const messages = {
          down: 'Server crash - automatic restart',
          degraded: 'High latency detected',
          maintenance: 'Scheduled maintenance window'
        };

        events.push({
          timestamp: date,
          status,
          duration: Math.floor(Math.random() * 3600000), // 0-1 hour
          message: messages[status as keyof typeof messages]
        });
      } else {
        events.push({
          timestamp: date,
          status: 'up'
        });
      }
    }

    return events;
  }

  /**
   * Simulate random metric changes
   */
  simulateMetricChange(): void {
    // Update CPU
    const currentCpu = this.cpuData().value;
    this.cpuData.set({
      ...this.cpuData(),
      previousValue: currentCpu,
      value: Math.min(100, Math.max(0, currentCpu + (Math.random() * 20 - 10)))
    });

    // Update Memory
    const currentMemory = this.memoryData().value;
    this.memoryData.set({
      ...this.memoryData(),
      previousValue: currentMemory,
      value: Math.min(100, Math.max(0, currentMemory + (Math.random() * 15 - 7)))
    });

    // Update Disk
    const currentDisk = this.diskData().value;
    this.diskData.set({
      ...this.diskData(),
      previousValue: currentDisk,
      value: Math.min(100, Math.max(0, currentDisk + (Math.random() * 5 - 2)))
    });

    // Update Custom
    const currentCustom = this.customData().value;
    this.customData.set({
      ...this.customData(),
      previousValue: currentCustom,
      value: Math.min(1000, Math.max(0, currentCustom + (Math.random() * 100 - 50)))
    });

    // Update Latency
    const currentLatency = this.latencyData().value;
    this.latencyData.set({
      ...this.latencyData(),
      previousValue: currentLatency,
      value: Math.min(200, Math.max(0, currentLatency + (Math.random() * 30 - 15)))
    });
  }

  /**
   * Reset all metrics to initial values
   */
  resetMetrics(): void {
    this.cpuData.set({
      value: 45,
      title: 'CPU Usage',
      subtitle: '4 cores active',
      previousValue: 40
    });

    this.memoryData.set({
      value: 82,
      title: 'Memory',
      subtitle: '8.2 GB / 10 GB',
      previousValue: 78
    });

    this.diskData.set({
      value: 65,
      title: 'Disk Usage',
      subtitle: '325 GB / 500 GB'
    });

    this.customData.set({
      value: 15,
      title: 'Network Load',
      subtitle: '150 Mbps'
    });

    this.latencyData.set({
      value: 45,
      title: 'Latency',
      subtitle: 'API Response Time'
    });
  }
}
