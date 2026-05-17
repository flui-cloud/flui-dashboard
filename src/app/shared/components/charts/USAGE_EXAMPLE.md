# Esempio d'Uso: Monitoring Tab Cluster

Questo documento mostra come integrare i componenti gauge nel tab di monitoring di un cluster.

## Scenario: Cluster Monitoring Tab

Vogliamo visualizzare le metriche real-time di un cluster:
- CPU Usage
- Memory Usage
- Disk Usage
- Network Load

---

## 1. Component TypeScript

```typescript
// cluster-monitoring-tab.component.ts
import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RingGaugeComponent,
  GradeGaugeComponent,
  GaugeChartData,
  GaugeChartConfig
} from '@shared/components/charts';
import { ClusterService } from '@features/service/cluster.service';

@Component({
  selector: 'app-cluster-monitoring-tab',
  standalone: true,
  imports: [CommonModule, RingGaugeComponent, GradeGaugeComponent],
  templateUrl: './cluster-monitoring-tab.component.html'
})
export class ClusterMonitoringTabComponent implements OnInit, OnDestroy {
  private clusterService = inject(ClusterService);
  private pollingInterval?: number;

  // Signals per metriche real-time
  private cpuMetric = signal({ current: 0, previous: 0 });
  private memoryMetric = signal({ current: 0, previous: 0, used: 0, total: 0 });
  private diskMetric = signal({ current: 0, previous: 0, used: 0, total: 0 });
  private networkMetric = signal({ current: 0, previous: 0 });

  // Computed data per i gauge
  cpuData = computed<GaugeChartData>(() => ({
    value: this.cpuMetric().current,
    title: 'CPU Usage',
    subtitle: `${this.cpuMetric().current.toFixed(1)}% utilized`,
    previousValue: this.cpuMetric().previous
  }));

  memoryData = computed<GaugeChartData>(() => {
    const m = this.memoryMetric();
    return {
      value: m.current,
      title: 'Memory',
      subtitle: `${m.used.toFixed(1)} GB / ${m.total} GB`,
      previousValue: m.previous
    };
  });

  diskData = computed<GaugeChartData>(() => {
    const d = this.diskMetric();
    return {
      value: d.current,
      title: 'Disk Usage',
      subtitle: `${d.used} GB / ${d.total} GB`,
      previousValue: d.previous
    };
  });

  networkData = computed<GaugeChartData>(() => ({
    value: this.networkMetric().current,
    title: 'Network Load',
    subtitle: `${this.networkMetric().current.toFixed(0)} Mbps`,
    previousValue: this.networkMetric().previous
  }));

  // Configurazioni gauge
  cpuConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: { warning: 70, danger: 90 },
    height: '220px'
  };

  memoryConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: { warning: 75, danger: 90 },
    height: '220px'
  };

  diskConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: { warning: 80, danger: 95 },
    height: '220px'
  };

  networkConfig: GaugeChartConfig = {
    min: 0,
    max: 1000,
    unit: ' Mbps',
    severity: 'info',
    height: '220px',
    valueFormatter: (value) => value.toFixed(0)
  };

  ngOnInit(): void {
    // Carica metriche iniziali
    this.loadMetrics();

    // Polling ogni 5 secondi
    this.pollingInterval = window.setInterval(() => {
      this.loadMetrics();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      // Chiama API per ottenere metriche del cluster
      const metrics = await this.clusterService.getClusterMetrics();

      // Aggiorna CPU
      this.cpuMetric.update(current => ({
        previous: current.current,
        current: metrics.cpu.usage
      }));

      // Aggiorna Memory
      this.memoryMetric.update(current => ({
        previous: current.current,
        current: metrics.memory.percentage,
        used: metrics.memory.used / 1024 / 1024 / 1024, // Converti in GB
        total: metrics.memory.total / 1024 / 1024 / 1024
      }));

      // Aggiorna Disk
      this.diskMetric.update(current => ({
        previous: current.current,
        current: metrics.disk.percentage,
        used: metrics.disk.used / 1024 / 1024 / 1024,
        total: metrics.disk.total / 1024 / 1024 / 1024
      }));

      // Aggiorna Network
      this.networkMetric.update(current => ({
        previous: current.current,
        current: metrics.network.throughput / 1024 / 1024 // Converti in Mbps
      }));
    } catch (error) {
      console.error('Failed to load cluster metrics:', error);
    }
  }

  // Metodo per refresh manuale
  async refreshMetrics(): Promise<void> {
    await this.loadMetrics();
  }
}
```

---

## 2. Component Template

```html
<!-- cluster-monitoring-tab.component.html -->
<div class="space-y-6">
  <!-- Header con refresh button -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-semibold">Cluster Monitoring</h2>
      <p class="text-sm text-muted-foreground">
        Real-time metrics updated every 5 seconds
      </p>
    </div>
    <button
      (click)="refreshMetrics()"
      class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Refresh Now
    </button>
  </div>

  <!-- Grid di gauge - usando Ring Gauge -->
  <section>
    <h3 class="text-lg font-medium mb-4">System Resources (Ring Gauge)</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <app-ring-gauge [data]="cpuData()" [config]="cpuConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-ring-gauge [data]="memoryData()" [config]="memoryConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-ring-gauge [data]="diskData()" [config]="diskConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-ring-gauge [data]="networkData()" [config]="networkConfig" />
      </div>
    </div>
  </section>

  <!-- Oppure con Grade Gauge -->
  <section>
    <h3 class="text-lg font-medium mb-4">System Resources (Grade Gauge)</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <app-grade-gauge [data]="cpuData()" [config]="cpuConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-grade-gauge [data]="memoryData()" [config]="memoryConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-grade-gauge [data]="diskData()" [config]="diskConfig" />
      </div>

      <div class="bg-card border border-border rounded-lg p-6">
        <app-grade-gauge [data]="networkData()" [config]="networkConfig" />
      </div>
    </div>
  </section>
</div>
```

---

## 3. Service con API Call

```typescript
// cluster.service.ts (estensione)
export interface ClusterMetrics {
  cpu: {
    usage: number;        // Percentuale 0-100
  };
  memory: {
    used: number;         // Bytes
    total: number;        // Bytes
    percentage: number;   // 0-100
  };
  disk: {
    used: number;         // Bytes
    total: number;        // Bytes
    percentage: number;   // 0-100
  };
  network: {
    throughput: number;   // Bytes/sec
  };
}

@Injectable({ providedIn: 'root' })
export class ClusterService {
  private apiService = inject(InfrastructureClustersService);

  async getClusterMetrics(): Promise<ClusterMetrics> {
    const clusterId = this.cluster()?.id;
    if (!clusterId) {
      throw new Error('No cluster selected');
    }

    // Chiama API Prometheus/Loki tramite backend
    const response = await firstValueFrom(
      this.apiService.getClusterMetrics(clusterId)
    );

    return response;
  }
}
```

---

## 4. Mock Data (per sviluppo)

```typescript
// cluster.service.ts (per testing senza backend)
async getClusterMetrics(): Promise<ClusterMetrics> {
  // Simula latency API
  await new Promise(resolve => setTimeout(resolve, 500));

  // Genera metriche random realistiche
  return {
    cpu: {
      usage: 40 + Math.random() * 30  // 40-70%
    },
    memory: {
      used: 8.5 * 1024 * 1024 * 1024,
      total: 16 * 1024 * 1024 * 1024,
      percentage: 53 + Math.random() * 15  // 53-68%
    },
    disk: {
      used: 325 * 1024 * 1024 * 1024,
      total: 500 * 1024 * 1024 * 1024,
      percentage: 65 + Math.random() * 10  // 65-75%
    },
    network: {
      throughput: (150 + Math.random() * 100) * 1024 * 1024  // 150-250 Mbps
    }
  };
}
```

---

## 5. Risultato Visivo

```
┌─────────────────────────────────────────────────────────────────┐
│  Cluster Monitoring                      [Refresh Now Button]   │
│  Real-time metrics updated every 5 seconds                      │
└─────────────────────────────────────────────────────────────────┘

System Resources (Ring Gauge)
┌───────────┬───────────┬───────────┬───────────┐
│  ◉ 45.2%  │  ◉ 68.5%  │  ◉ 72.1%  │  ◉ 187    │
│  CPU      │  Memory   │  Disk     │  Network  │
│  Usage    │  8.5/16GB │  325/500GB│  187 Mbps │
│  ↑ 2.3%   │  ↑ 1.2%   │  → 0.0%   │  ↓ 12 Mbps│
└───────────┴───────────┴───────────┴───────────┘

System Resources (Grade Gauge)
┌───────────┬───────────┬───────────┬───────────┐
│   ⟍45.2%⟋ │   ⟍68.5%⟋ │   ⟍72.1%⟋ │  ⟍187⟋   │
│  CPU      │  Memory   │  Disk     │  Network  │
│  Usage    │  8.5/16GB │  325/500GB│  187 Mbps │
│  ↑ 2.3%   │  ↑ 1.2%   │  → 0.0%   │  ↓ 12 Mbps│
└───────────┴───────────┴───────────┴───────────┘
```

---

## 📌 Note Importanti

1. **Polling vs WebSocket**: L'esempio usa polling ogni 5s. Per production considera WebSocket/SSE.

2. **Memory Management**: Ricordati di fare cleanup di interval/subscription in `ngOnDestroy`.

3. **Error Handling**: Gestisci errori API con fallback UI (skeleton, retry button).

4. **Performance**: Se hai molti cluster, carica metriche solo per il cluster attivo.

5. **Unità di Misura**: Converti sempre bytes in GB/MB per leggibilità.

6. **Trend Accuracy**: Il trend è accurato solo dopo il secondo fetch (quando `previousValue` è disponibile).

---

## 🎨 Personalizzazioni Possibili

### 1. Alert Visual quando Soglia Superata
```typescript
showAlert = computed(() => this.cpuData().value >= 90);
```

```html
@if (showAlert()) {
  <div class="bg-red-50 border-l-4 border-red-500 p-4">
    <p class="text-red-700">⚠️ CPU usage critically high!</p>
  </div>
}
```

### 2. Historical Sparkline sotto il Gauge
Aggiungi un mini grafico dei valori passati.

### 3. Auto-refresh Toggle
```html
<label>
  <input type="checkbox" [(ngModel)]="autoRefresh" />
  Auto-refresh (5s)
</label>
```

### 4. Scelta Ring vs Grade
```html
<select [(ngModel)]="gaugeType">
  <option value="ring">Ring Gauge</option>
  <option value="grade">Grade Gauge</option>
</select>
```

---

Questo esempio completo mostra come integrare i gauge in un contesto real-world! 🚀
