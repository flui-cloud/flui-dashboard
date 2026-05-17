# Chart Components

Componenti riutilizzabili per la visualizzazione di metriche basati su **ECharts**.

## 🎯 Componenti Disponibili

### 1. Ring Gauge (Gauge Circolare - 360°)

Gauge circolare completo per visualizzare metriche con progresso animato.

**File:** `ring-gauge/ring-gauge.component.ts`

**Caratteristiche:**
- Gauge circolare a 360°
- Gradiente lineare per il progresso
- Valore centrale grande e leggibile
- Indicatore trend (↑/↓) con valore precedente
- Colorazione automatica basata su soglie (success/warning/danger)
- Supporto tema chiaro/scuro

**Esempio d'uso:**
```typescript
import { RingGaugeComponent } from '@shared/components/charts';

@Component({
  template: `
    <app-ring-gauge
      [data]="cpuData"
      [config]="cpuConfig"
    />
  `
})
export class MyComponent {
  cpuData: GaugeChartData = {
    value: 75,
    title: 'CPU Usage',
    subtitle: '4 cores active',
    previousValue: 70  // opzionale, per trend
  };

  cpuConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: {
      warning: 70,
      danger: 90
    },
    height: '240px'
  };
}
```

---

### 2. Grade Gauge (Gauge Semicircolare - 180°)

Gauge semicircolare minimalista per dashboard cloud professionali.

**File:** `grade-gauge/grade-gauge.component.ts`

**Caratteristiche:**
- Gauge semicircolare 180° pulito e minimalista
- Progresso con gradiente (no lancetta, no zone colorate)
- Design essenziale senza elementi distraenti
- Valore centrale grande e leggibile
- Indicatore trend (↑/↓)
- Supporto tema chiaro/scuro
- **Perfetto per dashboard cloud**: design professionale senza caos visivo

**Esempio d'uso:**
```typescript
import { GradeGaugeComponent } from '@shared/components/charts';

@Component({
  template: `
    <app-grade-gauge
      [data]="memoryData"
      [config]="memoryConfig"
    />
  `
})
export class MyComponent {
  memoryData: GaugeChartData = {
    value: 85,
    title: 'Memory',
    subtitle: '8.5 GB / 10 GB',
    previousValue: 80
  };

  memoryConfig: GaugeChartConfig = {
    unit: '%',
    thresholds: {
      warning: 75,
      danger: 90
    }
  };
}
```

---

## 📐 Modelli e Interfacce

### GaugeChartData

```typescript
interface GaugeChartData {
  value: number;           // Valore corrente
  title: string;           // Titolo del gauge
  subtitle?: string;       // Sottotitolo (es: "8 GB / 10 GB")
  previousValue?: number;  // Valore precedente per trend
}
```

### GaugeChartConfig

```typescript
interface GaugeChartConfig {
  min?: number;                  // Valore minimo (default: 0)
  max?: number;                  // Valore massimo (default: 100)
  unit?: string;                 // Unità di misura (default: '%')
  height?: string;               // Altezza CSS (default: '240px')

  // Soglie per colorazione automatica
  thresholds?: {
    warning: number;             // Soglia warning (es: 70)
    danger: number;              // Soglia danger (es: 90)
  };

  // Oppure severity fissa
  severity?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';

  // Formatter personalizzato
  valueFormatter?: (value: number) => string;

  // Opzioni UI
  showValue?: boolean;           // Mostra valore (default: true)
  showTitle?: boolean;           // Mostra titolo (default: true)
  animated?: boolean;            // Animazioni (default: true)
  responsive?: boolean;          // Responsive (default: true)
  theme?: 'light' | 'dark';      // Tema (default: auto-detect)
}
```

---

## 🎨 Sistema di Colori

I componenti usano un sistema di colori basato su **severity**:

```typescript
export type MetricSeverity = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
```

**Colorazione automatica basata su soglie:**
- `value < warning` → **success** (verde)
- `warning <= value < danger` → **warning** (arancione)
- `value >= danger` → **danger** (rosso)

**Palette colori (allineata a Tailwind):**
- **Success:** `#10b981` → `#34d399`
- **Warning:** `#f59e0b` → `#fbbf24`
- **Danger:** `#ef4444` → `#f87171`
- **Info:** `#3b82f6` → `#60a5fa`
- **Neutral:** `#6b7280` → `#9ca3af`

---

## 🌗 Supporto Tema Chiaro/Scuro

I componenti supportano automaticamente il tema chiaro/scuro:

1. **Auto-detection** dal sistema operativo (default)
2. **Override manuale** tramite config: `{ theme: 'dark' }`
3. **Servizio globale** tramite `ChartThemeService`

**Esempio con servizio:**
```typescript
import { ChartThemeService } from '@shared/services/chart-theme.service';

@Component({...})
export class MyComponent {
  constructor(private chartTheme: ChartThemeService) {
    // Imposta tema globale
    this.chartTheme.setTheme('dark');  // 'light' | 'dark' | 'auto'
  }
}
```

---

## 🚀 Demo Interattiva

Visita `/chart-demo` per vedere tutti i componenti in azione con:
- Esempi di metriche (CPU, Memory, Disk, Network)
- Simulazione di cambiamenti real-time
- Diversi stili e configurazioni
- Confronto Ring vs Grade gauge

**Avvia il server:**
```bash
npm start
```

Poi apri: `http://localhost:4200/chart-demo`

---

## 📁 Struttura File

```
src/app/shared/components/charts/
├── chart.models.ts              # Interfacce e tipi
├── ring-gauge/
│   └── ring-gauge.component.ts  # Ring Gauge (360°)
├── grade-gauge/
│   └── grade-gauge.component.ts # Grade Gauge (180°)
├── chart-demo/
│   └── chart-demo.component.ts  # Demo interattiva
├── index.ts                     # Barrel export
└── README.md                    # Questa documentazione

src/app/shared/services/
└── chart-theme.service.ts       # Servizio tema globale
```

---

## 💡 Best Practices

### 1. Scelta del Gauge
- **Ring Gauge:** Design compatto e moderno, ottimo per griglie dense di metriche
- **Grade Gauge:** Design più tradizionale semicircolare, occupa più spazio verticale ma fornisce sensazione di "misuratore"
- Entrambi hanno lo stesso livello di minimalismo e pulizia visiva
- La scelta dipende solo da preferenza estetica e spazio disponibile

### 2. Unità di Misura
Specifica sempre l'unità corretta:
```typescript
{ unit: '%' }    // Percentuali
{ unit: ' GB' }  // Spazio (nota lo spazio prima)
{ unit: 'ms' }   // Latency
```

### 3. Trend Indicator
Passa sempre `previousValue` per mostrare trend:
```typescript
{
  value: currentValue,
  previousValue: previousValue  // Abilita ↑/↓
}
```

### 4. Formatter Personalizzato
Per formattazioni complesse:
```typescript
{
  valueFormatter: (value) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  }
}
```

### 5. Responsive Height
Usa unità CSS responsive:
```typescript
{ height: '240px' }    // Fisso
{ height: '20vh' }     // Basato su viewport
{ height: '100%' }     // Riempie container
```

---

## 🔧 Prossimi Componenti

Componenti pianificati per il futuro:

- [ ] `TimeSeriesLineChartComponent` - Grafici temporali
- [ ] `StackedAreaChartComponent` - Breakdown temporale
- [ ] `DualAxisLineChartComponent` - Network in/out
- [ ] `MultiStatCardComponent` - Stat multiple
- [ ] `StatusTimelineComponent` - Uptime history
- [ ] `LogStreamTableComponent` - Real-time logs
- [ ] `ProportionDonutChartComponent` - Donut/Pie

---

## 📚 Riferimenti

- **ECharts:** https://echarts.apache.org/
- **ngx-echarts:** https://github.com/xieziyu/ngx-echarts
- **Angular Signals:** https://angular.io/guide/signals
