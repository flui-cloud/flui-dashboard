import { Component, effect, inject, input, signal } from '@angular/core';
import {
  EgressPort,
  EgressService,
  EgressView,
  formatEgressPorts,
} from '../../service/egress.service';
import { FlKeyValue, FlKvItem, FlPanel } from '../../../ui/patterns';
import { FlStatus, FlTag } from '../../../ui/primitives';

@Component({
  selector: 'app-egress-note',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlStatus, FlTag],
  host: { class: 'fl-stack' },
  template: `
    @if (reading(); as r) {
      @if (!r.open) {
        <fl-panel title="Outbound ports" data-testid="app-egress">
          <div class="flex flex-col gap-3">
            <fl-key-value>
              <fl-kv-item key="Policy">
                <fl-status tone="warning" label="Limited to listed ports" />
              </fl-kv-item>
              <fl-kv-item key="Allowed ports">
                <span class="fl-row">
                  @for (p of r.ports; track p.port + p.protocol) {
                    <fl-tag class="fl-mono">{{ portLabel(p) }}</fl-tag>
                  } @empty {
                    <span class="text-fl-ink-muted">None</span>
                  }
                </span>
              </fl-kv-item>
            </fl-key-value>
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">{{ r.summary }}</p>
          </div>
        </fl-panel>
      }
    }
  `,
})
export class AppEgressNoteComponent {
  readonly appId = input<string | null>(null);
  private readonly api = inject(EgressService);
  protected readonly reading = signal<EgressView | null>(null);

  constructor() {
    effect(() => {
      const id = this.appId();
      if (id) void this.load(id);
    });
  }

  protected portLabel(p: EgressPort): string {
    return formatEgressPorts([p]);
  }

  private async load(id: string): Promise<void> {
    try {
      this.reading.set(await this.api.app(id));
    } catch {
      this.reading.set(null);
    }
  }
}
