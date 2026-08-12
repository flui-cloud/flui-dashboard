import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideServer, lucideTriangleAlert } from '@ng-icons/lucide';
import { DnsZonesService } from '../../service/dns-zones.service';

type DomainMode = 'zone' | 'external';

@Component({
  selector: 'app-mail-domain-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIcon],
  providers: [provideIcons({ lucideGlobe, lucideServer, lucideTriangleAlert })],
  template: `
    <div>
      <span class="mb-1 block text-xs font-medium text-foreground">
        {{ label() }}
      </span>

      @if (zones().length) {
        <div class="mb-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            (click)="setMode('zone')"
            [class]="cardClass(mode() === 'zone')"
          >
            <span class="flex items-center gap-1.5">
              <ng-icon name="lucideServer" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">A zone Flui manages</span>
            </span>
            <span class="mt-0.5 block text-[11px] text-muted-foreground">
              Records are written for you. Nothing to publish by hand.
            </span>
          </button>
          <button
            type="button"
            (click)="setMode('external')"
            [class]="cardClass(mode() === 'external')"
          >
            <span class="flex items-center gap-1.5">
              <ng-icon name="lucideGlobe" class="h-3.5 w-3.5 text-primary" />
              <span class="text-xs font-medium">A domain hosted elsewhere</span>
            </span>
            <span class="mt-0.5 block text-[11px] text-muted-foreground">
              Flui hands back the records for you to publish there.
            </span>
          </button>
        </div>
      }

      @if (mode() === 'zone' && zones().length) {
        <div class="flex items-stretch">
          <input
            type="text"
            [ngModel]="prefix()"
            (ngModelChange)="onPrefix($event)"
            [placeholder]="prefixPlaceholder()"
            class="min-w-0 flex-1 rounded-l-md border border-border bg-background px-2.5 py-2 font-mono text-sm text-foreground focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          />
          <span
            class="inline-flex items-center border border-l-0 border-border bg-muted px-2 font-mono text-sm text-muted-foreground"
          >
            .
          </span>
          @if (zones().length > 1) {
            <select
              [ngModel]="zone()"
              (ngModelChange)="onZone($event)"
              class="cursor-pointer whitespace-nowrap rounded-r-md border border-l-0 border-border bg-muted px-2 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              [class]="zone() ? 'text-muted-foreground' : 'text-foreground'"
            >
              <option value="" disabled>choose a zone…</option>
              @for (z of zones(); track z) {
                <option [value]="z">{{ z }}</option>
              }
            </select>
          } @else {
            <span
              class="inline-flex items-center whitespace-nowrap rounded-r-md border border-l-0 border-border bg-muted px-2.5 font-mono text-sm text-muted-foreground"
            >
              {{ zone() }}
            </span>
          }
        </div>
        @if (zone()) {
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Leave the prefix empty to send from the zone itself
            (<span class="font-mono">{{ zone() }}</span>).
          </span>
        } @else {
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Pick which of your zones this sends from.
          </span>
        }
      } @else {
        <input
          type="text"
          [ngModel]="external()"
          (ngModelChange)="onExternal($event)"
          [placeholder]="placeholder()"
          class="h-9 w-full rounded-md border border-border bg-background px-2.5 font-mono text-sm text-foreground"
        />
        @if (!zones().length) {
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Flui holds no DNS zone, so the records will come back here for you to publish
            wherever this domain is hosted.
          </span>
        }
      }

      @if (value()) {
        <span class="mt-1.5 block text-[11px] text-muted-foreground">
          Sending from <span class="font-mono text-foreground">{{ value() }}</span> — a domain,
          not an address. The mailbox part comes from
          <span class="font-mono">MAIL_FROM</span>.
        </span>
      }
    </div>
  `,
})
export class MailDomainPickerComponent implements OnInit {
  private readonly dnsZones = inject(DnsZonesService);

  readonly label = input('Sending domain');
  readonly placeholder = input('mail.example.com');
  readonly suggestedPrefix = input('');

  readonly domainChange = output<string>();

  protected readonly zones = signal<string[]>([]);
  protected readonly mode = signal<DomainMode>('zone');
  protected readonly prefix = signal('');
  protected readonly zone = signal('');
  protected readonly external = signal('');

  protected readonly value = computed(() => {
    if (this.mode() === 'external' || !this.zones().length) return this.external().trim();
    const zone = this.zone();
    if (!zone) return '';
    // Trimmed in a loop: a pattern matching a run of dots backtracks.
    let prefix = this.prefix().trim();
    while (prefix.endsWith('.')) prefix = prefix.slice(0, -1);
    return prefix ? `${prefix}.${zone}` : zone;
  });

  protected readonly prefixPlaceholder = computed(() => this.suggestedPrefix() || 'mail');

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    this.prefix.set(this.suggestedPrefix());
    await this.dnsZones.loadZones();
    const names = this.dnsZones
      .zones()
      .map((z) => z.zoneName)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b));

    this.zones.set(names);
    if (names.length === 1) {
      this.zone.set(names[0]!);
    } else if (!names.length) {
      this.mode.set('external');
    }
    this.emit();
  }

  protected setMode(mode: DomainMode): void {
    this.mode.set(mode);
    this.emit();
  }

  protected onPrefix(value: string): void {
    this.prefix.set(value);
    this.emit();
  }

  protected onZone(value: string): void {
    this.zone.set(value);
    this.emit();
  }

  protected onExternal(value: string): void {
    this.external.set(value);
    this.emit();
  }

  protected cardClass(active: boolean): string {
    const base = 'rounded-md border px-2.5 py-2 text-left transition-colors';
    return active
      ? `${base} border-primary bg-primary/10`
      : `${base} border-border hover:bg-muted`;
  }

  private emit(): void {
    this.domainChange.emit(this.value());
  }
}
