import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideExternalLink } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import {
  ConnectProviderInput,
  MAIL_PROVIDERS,
  MailConnection,
  MailConnectionConfig,
  MailDomainProofs,
  MailProviderId,
  MailProviderProfile,
} from '../../model/mail-console.models';
import { MailDomainPickerComponent } from './mail-domain-picker.component';
import {
  MailScopeSlot,
  activeIn,
  configText,
  holdsScope,
  providersFor,
  suggestions,
  withConfig,
} from './mail-providers-helpers';

let nextId = 0;

@Component({
  selector: 'app-mail-connect-form',
  imports: [
    FormsModule,
    FlAlert,
    FlButton,
    FlIcon,
    ReadOnlySectionDirective,
    MailDomainPickerComponent,
  ],
  providers: [provideIcons({ lucideCheck, lucideExternalLink })],
  host: { class: 'flex flex-col gap-4 border-t border-fl-border p-4' },
  template: `
    <fieldset class="fl-fieldset">
      <legend>Provider</legend>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        @for (p of providers(); track p.id) {
          <label class="fl-radiocard" [attr.title]="p.unproven ? unprovenNote(p) : null">
            <input
              type="radio"
              [name]="id + '-provider'"
              [checked]="chosen() === p.id"
              [disabled]="!!p.unproven"
              (change)="choose(p.id)"
            />
            <span class="fl-radiocard__text">
              <span class="fl-radiocard__title">{{ p.name }}</span>
              @if (p.unproven) {
                <span class="fl-radiocard__desc">Coming soon</span>
              }
            </span>
          </label>
        }
      </div>
    </fieldset>

    @if (profile(); as p) {
      <p class="m-0 max-w-2xl text-fl-body-sm text-fl-ink-muted">{{ p.summary }}</p>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        @if (p.needsSecret) {
          <div class="fl-field">
            <label class="fl-field__label" [for]="id + '-secret'">{{ p.secretLabel }}</label>
            <div class="fl-input fl-input--lg">
              <input
                [id]="id + '-secret'"
                type="password"
                autocomplete="off"
                [(ngModel)]="secret"
              />
            </div>
            @if (p.credentialHelp; as help) {
              <span class="fl-field__hint">{{ help.where }}</span>
              <a
                class="fl-link inline-flex items-center gap-1 text-fl-caption"
                [href]="help.href"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ help.linkText }}
                <fl-icon name="lucideExternalLink" [size]="13" />
              </a>
              @if (help.caveat) {
                <span class="fl-field__hint">{{ help.caveat }}</span>
              }
            }
          </div>
        }

        <div class="flex flex-col gap-1">
          <app-mail-domain-picker
            [suggestedPrefix]="slot().id === 'bulk' ? 'news' : 'mail'"
            [placeholder]="slot().id === 'bulk' ? 'news.example.com' : 'mail.example.com'"
            (domainChange)="domain = $event"
          />
          @if (slot().id === 'bulk') {
            <span class="fl-field__hint">
              Give bulk its own subdomain: reputation is tracked per domain, so a mailing list must
              not be able to damage password resets.
            </span>
          }
          @if (!p.automatesDomain) {
            <span class="fl-field__hint">
              This provider verifies domains in its own console. Flui can still publish the records
              you paste.
            </span>
          }
        </div>

        @if (known(p.id).length) {
          <div class="flex flex-col gap-2 md:col-span-2">
            <span class="fl-field__hint"
              >Already at this provider. Pick one instead of typing:</span
            >
            <div class="fl-row" role="group" aria-label="Known domains">
              @for (k of known(p.id); track k.domain) {
                <button
                  type="button"
                  class="fl-chip fl-mono"
                  [attr.aria-pressed]="domain === k.domain"
                  (click)="domain = k.domain"
                >
                  @if (k.verified) {
                    <fl-icon name="lucideCheck" [size]="13" />
                  }
                  {{ k.domain }}
                </button>
              }
            </div>
          </div>
        }

        @for (field of p.fields; track field.key) {
          @if (field.type === 'checkbox') {
            <label class="fl-check items-start md:col-span-2">
              <input
                type="checkbox"
                [ngModel]="configBool(field.key)"
                (ngModelChange)="setConfig(field.key, $event)"
              />
              <span class="flex flex-col">
                <span>{{ field.label }}</span>
                @if (field.hint) {
                  <span class="fl-field__hint">{{ field.hint }}</span>
                }
              </span>
            </label>
          } @else {
            <div class="fl-field">
              <label class="fl-field__label" [for]="id + '-' + field.key"
                >{{ field.label }}{{ field.required ? '' : ' (optional)' }}</label
              >
              <div class="fl-input fl-input--lg">
                <input
                  [id]="id + '-' + field.key"
                  [type]="field.type"
                  [ngModel]="configValue(field.key)"
                  (ngModelChange)="setConfig(field.key, $event)"
                />
              </div>
              @if (field.hint) {
                <span class="fl-field__hint">{{ field.hint }}</span>
              }
            </div>
          }
        }
      </div>

      @if (p.blindSpot) {
        <fl-alert tone="warning" title="Limited reporting">{{ p.blindSpot }}</fl-alert>
      }

      @if (held(); as h) {
        <label class="fl-check items-start">
          <input
            type="checkbox"
            [(ngModel)]="activateNow"
            [ngModelOptions]="{ standalone: true }"
          />
          <span class="flex flex-col">
            <span>Send {{ slot().id }} mail through this one straight away</span>
            <span class="fl-field__hint">
              {{ h.label }} stops sending and keeps its credential. Leave this unticked to set the
              provider up now and switch when its domain has verified.
            </span>
          </span>
        </label>
      } @else if (sending(); as current) {
        <p class="m-0 text-fl-caption text-fl-ink-muted">
          {{ slot().title }} mail moves from {{ current.label }} to this provider as soon as it is
          connected. Disconnecting it hands the mail back.
        </p>
      }

      <div class="fl-row justify-end">
        <button flButton="ghost" type="button" [disabled]="connecting()" (click)="cancelled.emit()">
          Cancel
        </button>
        <button
          appReadOnlySection="mail"
          flButton="primary"
          type="button"
          [disabled]="connecting() || !canConnect()"
          (click)="connect()"
        >
          {{ connecting() ? 'Setting up…' : 'Connect' }}
        </button>
      </div>
    }
  `,
})
export class MailConnectForm implements OnInit {
  readonly slot = input.required<MailScopeSlot>();
  readonly connections = input.required<MailConnection[]>();
  readonly knownDomains = input.required<MailDomainProofs[]>();
  readonly connecting = input(false);

  readonly submitted = output<ConnectProviderInput>();
  readonly cancelled = output<void>();

  protected readonly id = `mail-connect-${nextId++}`;
  protected readonly chosen = signal<MailProviderId | null>(null);
  protected readonly config = signal<MailConnectionConfig>({});
  protected secret = '';
  protected domain = '';
  protected activateNow = false;

  protected readonly providers = computed(() => providersFor(this.slot().id));
  protected readonly profile = computed<MailProviderProfile | null>(
    () => MAIL_PROVIDERS.find((p) => p.id === this.chosen()) ?? null,
  );
  protected readonly held = computed(() => holdsScope(this.connections(), this.slot().id));
  protected readonly sending = computed(() => activeIn(this.connections(), this.slot().id));

  ngOnInit(): void {
    const offerable = this.providers().find((p) => !p.unproven);
    this.choose(offerable?.id ?? null);
  }

  protected unprovenNote(p: MailProviderProfile): string {
    return `${p.name} is implemented but no message has been sent through it end to end yet.`;
  }

  protected known(provider: MailProviderId): MailDomainProofs[] {
    return suggestions(this.connections(), this.knownDomains(), provider);
  }

  protected choose(provider: MailProviderId | null): void {
    this.chosen.set(provider);
    this.secret = '';
    this.config.set({});
  }

  protected configValue(key: keyof MailConnectionConfig): string {
    return configText(this.config(), key);
  }

  protected configBool(key: keyof MailConnectionConfig): boolean {
    return this.config()[key] === true;
  }

  protected setConfig(key: keyof MailConnectionConfig, value: unknown): void {
    this.config.update((current) => withConfig(current, key, value));
  }

  protected canConnect(): boolean {
    const p = this.profile();
    if (!p) return false;
    if (p.needsSecret && !this.secret.trim()) return false;
    if (!this.domain.trim()) return false;
    return p.fields.every((f) => !f.required || this.configValue(f.key).trim().length > 0);
  }

  protected connect(): void {
    const p = this.profile();
    if (!p) return;
    this.submitted.emit({
      provider: p.id,
      scope: this.slot().id,
      ...(this.domain.trim() ? { sendingDomain: this.domain.trim() } : {}),
      ...(this.secret.trim() ? { secret: this.secret.trim() } : {}),
      ...(this.activateNow ? { activate: true } : {}),
      ...(Object.keys(this.config()).length ? { config: this.config() } : {}),
    });
  }
}
