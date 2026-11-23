import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  SandboxSignInService,
  SignInProvider,
  SignInProviderStatus,
  SignInProviders,
} from '../../service/sandbox-sign-in.service';
import { ConfirmService } from '../../../ui/overlays/confirm';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlLoadingState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';

@Component({
  selector: 'app-demo-sign-in',
  imports: [
    ReactiveFormsModule,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlPanel,
    FlLoadingState,
    FlTable,
    FlButton,
    FlSpinner,
    FlStatus,
  ],
  host: { class: 'fl-stack' },
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (error()) {
      <fl-alert tone="error" title="Sign-in providers">{{ error() }}</fl-alert>
    }

    @if (view(); as v) {
      @if (!v.demo) {
        <fl-panel title="Sign-in providers">
          <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="not-demo">
            This installation is not a demo. GitHub and Google sign-in is only offered on one.
          </p>
        </fl-panel>
      } @else {
        @if (v.callbackUrl) {
          <fl-panel title="Callback">
            <div class="flex flex-col gap-3">
              <fl-key-value>
                <fl-kv-item key="Callback URL to register at GitHub or Google" [mono]="true">
                  <span data-testid="callback-url">{{ v.callbackUrl }}</span>
                </fl-kv-item>
                @if (v.intentCallbackUrl) {
                  <fl-kv-item key="Visitor callback" [mono]="true">{{
                    v.intentCallbackUrl
                  }}</fl-kv-item>
                }
              </fl-key-value>
              <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="callback-note">
                If you change the sign-in address, update the callback at GitHub and Google.
              </p>
              @if (v.intentCallbackUrl) {
                <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="intent-callback-url">
                  Visitors who sign in come back to
                  <span class="fl-mono">{{ v.intentCallbackUrl }}</span>. Add it at GitHub and
                  Google as well.
                </p>
              }
            </div>
          </fl-panel>
        }

        <fl-panel title="Sign-in providers" [count]="v.providers.length" [flush]="true">
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">State</th>
                  <th scope="col">Client ID</th>
                  <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of v.providers; track p.provider) {
                  <tr [attr.data-provider]="p.provider">
                    <td class="whitespace-normal">
                      <span class="flex flex-col gap-0.5">
                        <span class="font-medium">{{ p.name }}</span>
                        @if (p.source === 'environment') {
                          <span class="text-fl-caption text-fl-ink-muted">
                            Its secret sits in plain configuration. Connect it here, then remove the
                            old variables.
                          </span>
                        } @else if (p.source === 'identity-provider') {
                          <span class="text-fl-caption text-fl-ink-muted">
                            Set up by the old configuration. Connect it here to manage it.
                          </span>
                        }
                      </span>
                    </td>
                    <td>
                      <fl-status [tone]="statusTone(p)" [label]="statusLabel(p)" />
                    </td>
                    <td class="fl-mono">{{ p.clientId ?? '—' }}</td>
                    <td class="is-fit">
                      <span class="flex items-center gap-1">
                        <button
                          flButton
                          size="sm"
                          type="button"
                          [attr.aria-label]="
                            (p.source === 'flui' ? 'Rotate ' : 'Connect ') + p.name
                          "
                          (click)="edit(p)"
                          [disabled]="busy()"
                        >
                          {{ p.source === 'flui' ? 'Rotate' : 'Connect' }}
                        </button>
                        @if (p.connected) {
                          <button
                            flButton="ghost"
                            size="sm"
                            type="button"
                            [attr.aria-label]="'Disconnect ' + p.name"
                            (click)="confirmDisconnect(p)"
                            [disabled]="busy()"
                          >
                            Disconnect
                          </button>
                        }
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </fl-panel>

        @if (editingProvider(v); as p) {
          <fl-panel [title]="'Connect ' + p.name">
            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <fl-field label="Client ID" for="sign-in-client-id">
                  <div class="fl-input fl-input--lg">
                    <input id="sign-in-client-id" formControlName="clientId" autocomplete="off" />
                  </div>
                </fl-field>
                <fl-field
                  label="Client secret"
                  for="sign-in-client-secret"
                  hint="The secret goes to the identity provider only and cannot be shown again."
                >
                  <div class="fl-input fl-input--lg">
                    <input
                      id="sign-in-client-secret"
                      type="password"
                      formControlName="clientSecret"
                      autocomplete="new-password"
                    />
                  </div>
                </fl-field>
              </div>
              <div class="flex justify-end gap-2">
                <button flButton="ghost" type="button" (click)="cancel()">Cancel</button>
                <button flButton="primary" type="submit" [disabled]="busy() || form.invalid">
                  @if (busy()) {
                    <fl-spinner label="Saving" />
                  }
                  Save
                </button>
              </div>
            </form>
          </fl-panel>
        }
      }
    } @else if (!error()) {
      <fl-panel title="Sign-in providers">
        <fl-loading-state />
      </fl-panel>
    }
  `,
})
export class DemoSignInComponent implements OnInit {
  private readonly service = inject(SandboxSignInService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmService = inject(ConfirmService);

  readonly view = signal<SignInProviders | null>(null);
  readonly editing = signal<SignInProvider | null>(null);
  readonly pending = signal<SignInProvider | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    clientId: ['', Validators.required],
    clientSecret: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  statusLabel(p: SignInProviderStatus): string {
    if (!p.connected) return 'Not connected';
    if (p.source === 'environment' || p.source === 'identity-provider') {
      return 'From old configuration';
    }
    return p.onSignInPage ? 'Connected' : 'Connected, not shown';
  }

  statusTone(p: SignInProviderStatus): StatusTone {
    if (!p.connected) return 'neutral';
    if (p.source === 'environment' || p.source === 'identity-provider') return 'warning';
    return 'success';
  }

  protected editingProvider(v: SignInProviders): SignInProviderStatus | null {
    const provider = this.editing();
    return provider ? (v.providers.find((p) => p.provider === provider) ?? null) : null;
  }

  edit(p: SignInProviderStatus): void {
    this.error.set(null);
    this.form.reset({ clientId: p.clientId ?? '', clientSecret: '' });
    this.editing.set(p.provider);
  }

  cancel(): void {
    this.editing.set(null);
    this.form.reset({ clientId: '', clientSecret: '' });
  }

  submit(): void {
    const provider = this.editing();
    if (!provider || this.form.invalid) return;
    const { clientId, clientSecret } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.service.connect(provider, { clientId: clientId.trim(), clientSecret }).subscribe({
      next: (status) => {
        this.busy.set(false);
        this.cancel();
        this.replace(status);
      },
      error: (err) => {
        this.busy.set(false);
        this.form.controls.clientSecret.reset('');
        this.error.set(err?.error?.message ?? 'The sign-in could not be connected.');
      },
    });
  }

  async confirmDisconnect(p: SignInProviderStatus): Promise<void> {
    this.pending.set(p.provider);
    const client = p.clientId ? ` (${p.clientId})` : '';
    const ok = await this.confirmService.confirm({
      title: `Disconnect ${p.name} sign-in`,
      body:
        `${p.name}${client}: its button leaves the sign-in page and its credentials are deleted. ` +
        `Guests who signed in with ${p.name} can no longer do so.`,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (ok) this.disconnect();
    else this.pending.set(null);
  }

  disconnect(): void {
    const provider = this.pending();
    if (!provider) return;
    this.busy.set(true);
    this.service.disconnect(provider).subscribe({
      next: (status) => {
        this.busy.set(false);
        this.pending.set(null);
        this.replace(status);
      },
      error: (err) => {
        this.busy.set(false);
        this.pending.set(null);
        this.error.set(err?.error?.message ?? 'The sign-in could not be disconnected.');
      },
    });
  }

  private load(): void {
    this.service.list().subscribe({
      next: (v) => this.view.set(v),
      error: (err) =>
        this.error.set(err?.error?.message ?? 'The sign-in providers could not be read.'),
    });
  }

  private replace(status: SignInProviderStatus): void {
    const v = this.view();
    if (!v) return;
    this.view.set({
      ...v,
      providers: v.providers.map((p) => (p.provider === status.provider ? status : p)),
    });
  }
}
