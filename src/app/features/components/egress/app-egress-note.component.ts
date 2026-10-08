import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { EgressService, EgressView } from '../../service/egress.service';

/** One line on what the application may reach outside its cluster; shown only when limited. */
@Component({
  selector: 'app-egress-note',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reading(); as r) {
      @if (!r.open) {
        <section class="card-surface p-4" data-testid="app-egress">
          <h3 class="m-0 text-sm font-semibold text-foreground">Outbound ports</h3>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">{{ r.summary }}</p>
        </section>
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

  private async load(id: string): Promise<void> {
    try {
      this.reading.set(await this.api.app(id));
    } catch {
      this.reading.set(null);
    }
  }
}
