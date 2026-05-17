/**
 * Charts Module - Barrel Export
 * Reusable chart components for metrics visualization
 */

// Models and Types
export * from './chart.models';

// Gauge Components
export { RingGaugeComponent } from './ring-gauge/ring-gauge.component';
export { GradeGaugeComponent } from './grade-gauge/grade-gauge.component';

// Time Series Components
export { TimeSeriesLineComponent } from './time-series-line/time-series-line.component';

// Distribution Components
export { ProportionDonutComponent } from './proportion-donut/proportion-donut.component';
export { ProportionBarComponent } from './proportion-bar/proportion-bar.component';

// Stat Components
export { MultiStatCardComponent } from './multi-stat-card/multi-stat-card.component';
export { StatusTimelineComponent } from './status-timeline/status-timeline.component';

// Log Volume
export { LogVolumeHistogramComponent } from './log-volume-histogram/log-volume-histogram.component';

// Demo
export { ChartDemoComponent } from './chart-demo/chart-demo.component';

// Services
export { ChartThemeService } from '../../services/chart-theme.service';
