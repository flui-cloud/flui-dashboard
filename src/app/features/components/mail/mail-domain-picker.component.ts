import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DnsZonesService } from '../../service/dns-zones.service';

type DomainMode = 'zone' | 'external';

let nextId = 0;

@Component({
  selector: 'app-mail-domain-picker',
  imports: [FormsModule],
  host: { class: 'fl-field' },
  template: `
    @if (label()) {
      <label class="fl-field__label" [for]="id">{{ label() }}</label>
    }

    @if (zones().length) {
      <div
        class="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        [attr.aria-label]="label() || 'Sending domain'"
      >
        <label class="fl-radiocard">
          <input
            type="radio"
            [name]="id + '-mode'"
            [checked]="mode() === 'zone'"
            (change)="setMode('zone')"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">A zone Flui manages</span>
            <span class="fl-radiocard__desc"
              >Records are written for you. Nothing to publish by hand.</span
            >
          </span>
        </label>
        <label class="fl-radiocard">
          <input
            type="radio"
            [name]="id + '-mode'"
            [checked]="mode() === 'external'"
            (change)="setMode('external')"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">A domain hosted elsewhere</span>
            <span class="fl-radiocard__desc"
              >Flui hands back the records for you to publish there.</span
            >
          </span>
        </label>
      </div>
    }

    @if (mode() === 'zone' && zones().length) {
      <div class="flex items-center gap-2">
        <div class="fl-input fl-input--lg min-w-0 flex-1">
          <input
            [id]="id"
            type="text"
            class="fl-mono"
            [attr.aria-label]="label() ? null : 'Prefix'"
            [ngModel]="prefix()"
            (ngModelChange)="onPrefix($event)"
            [placeholder]="prefixPlaceholder()"
          />
        </div>
        <span class="fl-mono text-fl-ink-muted" aria-hidden="true">.</span>
        @if (zones().length > 1) {
          <span class="fl-select-wrap">
            <select
              class="fl-select fl-mono"
              aria-label="Zone"
              [ngModel]="zone()"
              (ngModelChange)="onZone($event)"
            >
              <option value="" disabled>Choose a zone</option>
              @for (z of zones(); track z) {
                <option [value]="z">{{ z }}</option>
              }
            </select>
          </span>
        } @else {
          <span class="fl-mono text-fl-ink-muted">{{ zone() }}</span>
        }
      </div>
      @if (zone()) {
        <span class="fl-field__hint">
          Leave the prefix empty to send from the zone itself (<span class="fl-mono">{{
            zone()
          }}</span
          >).
        </span>
      } @else {
        <span class="fl-field__hint">Pick which of your zones this sends from.</span>
      }
    } @else {
      <div class="fl-input fl-input--lg">
        <input
          [id]="id"
          type="text"
          class="fl-mono"
          [attr.aria-label]="label() ? null : 'Sending domain'"
          [ngModel]="external()"
          (ngModelChange)="onExternal($event)"
          [placeholder]="placeholder()"
        />
      </div>
      @if (!zones().length) {
        <span class="fl-field__hint">
          Flui holds no DNS zone, so the records will come back here for you to publish wherever
          this domain is hosted.
        </span>
      }
    }

    @if (value()) {
      <span class="fl-field__hint">
        Sending from <span class="fl-mono">{{ value() }}</span>, a domain, not an address. The
        mailbox part comes from <span class="fl-mono">MAIL_FROM</span>.
      </span>
    }
  `,
})
export class MailDomainPickerComponent implements OnInit {
  private readonly dnsZones = inject(DnsZonesService);

  readonly label = input('Sending domain');
  readonly placeholder = input('mail.example.com');
  readonly suggestedPrefix = input('');

  readonly domainChange = output<string>();

  protected readonly id = `mail-domain-${nextId++}`;
  protected readonly zones = signal<string[]>([]);
  protected readonly mode = signal<DomainMode>('zone');
  protected readonly prefix = signal('');
  protected readonly zone = signal('');
  protected readonly external = signal('');

  protected readonly value = computed(() => {
    if (this.mode() === 'external' || !this.zones().length) return this.external().trim();
    const zone = this.zone();
    if (!zone) return '';
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

  private emit(): void {
    this.domainChange.emit(this.value());
  }
}
