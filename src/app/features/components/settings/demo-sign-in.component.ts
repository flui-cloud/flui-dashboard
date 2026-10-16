import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertCircle, lucideLoader } from '@ng-icons/lucide';
import {
  HlmCardContentDirective,
  HlmCardDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { DeleteConfirmationDialogComponent } from '../../../shared/components/delete-confirmation-dialog.component';
import {
  SandboxSignInService,
  SignInProvider,
  SignInProviderStatus,
  SignInProviders,
} from '../../service/sandbox-sign-in.service';

@Component({
  selector: 'app-demo-sign-in',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    HlmInputDirective,
    HlmLabelDirective,
    DeleteConfirmationDialogComponent,
  ],
  providers: [provideIcons({ lucideAlertCircle, lucideLoader })],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-4">
      @if (error()) {
        <div class="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ng-icon name="lucideAlertCircle" class="h-4 w-4 shrink-0" />
          {{ error() }}
        </div>
      }

      @if (view(); as v) {
        @if (!v.demo) {
          <p class="text-sm text-muted-foreground" data-testid="not-demo">
            This installation is not a demo. GitHub and Google sign-in is only offered on one.
          </p>
        } @else {
          @if (v.callbackUrl) {
            <p class="text-sm text-muted-foreground">
              Callback URL to register at GitHub or Google:
              <span class="font-mono text-xs text-foreground break-all" data-testid="callback-url">{{ v.callbackUrl }}</span>
            </p>
            <p class="text-xs text-muted-foreground" data-testid="callback-note">
              If you change the sign-in address, update the callback at GitHub and Google.
            </p>
            @if (v.intentCallbackUrl) {
              <p class="text-xs text-muted-foreground" data-testid="intent-callback-url">
                Visitors who sign in come back to
                <span class="font-mono break-all">{{ v.intentCallbackUrl }}</span>. Add it at GitHub and Google as well.
              </p>
            }
          }

          <div hlmCard>
            <div hlmCardContent class="pt-6">
              <ul class="divide-y divide-border">
                @for (p of v.providers; track p.provider) {
                  <li class="py-4 first:pt-0 last:pb-0 space-y-3" [attr.data-provider]="p.provider">
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-medium">{{ p.name }}</span>
                          @if (p.connected) {
                            <span hlmBadge variant="default" class="text-xs">{{ statusLabel(p) }}</span>
                          } @else {
                            <span hlmBadge variant="secondary" class="text-xs">{{ statusLabel(p) }}</span>
                          }
                        </div>
                        @if (p.clientId) {
                          <p class="font-mono text-xs text-muted-foreground truncate">{{ p.clientId }}</p>
                        }
                        @if (p.source === 'environment') {
                          <p class="text-xs text-muted-foreground">
                            Its secret sits in plain configuration. Connect it here, then remove the old variables.
                          </p>
                        } @else if (p.source === 'identity-provider') {
                          <p class="text-xs text-muted-foreground">
                            Set up by the old configuration. Connect it here to manage it.
                          </p>
                        }
                      </div>
                      <div class="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          (click)="edit(p)"
                          [disabled]="busy()"
                          class="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {{ p.source === 'flui' ? 'Rotate' : 'Connect' }}
                        </button>
                        @if (p.connected) {
                          <button
                            type="button"
                            (click)="confirmDisconnect(p)"
                            [disabled]="busy()"
                            class="inline-flex items-center rounded-md border border-destructive/50 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Disconnect
                          </button>
                        }
                      </div>
                    </div>

                    @if (editing() === p.provider) {
                      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div class="space-y-1.5">
                            <label hlmLabel for="sign-in-client-id">Client ID</label>
                            <input hlmInput id="sign-in-client-id" formControlName="clientId" class="w-full" autocomplete="off" />
                          </div>
                          <div class="space-y-1.5">
                            <label hlmLabel for="sign-in-client-secret">Client secret</label>
                            <input
                              hlmInput
                              id="sign-in-client-secret"
                              type="password"
                              formControlName="clientSecret"
                              autocomplete="new-password"
                              class="w-full"
                            />
                          </div>
                        </div>
                        <p class="text-xs text-muted-foreground">
                          The secret goes to the identity provider only and cannot be shown again.
                        </p>
                        <div class="flex gap-2">
                          <button
                            type="submit"
                            [disabled]="busy() || form.invalid"
                            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            @if (busy()) {
                              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
                            }
                            Save
                          </button>
                          <button
                            type="button"
                            (click)="cancel()"
                            class="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    }
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      } @else if (!error()) {
        <p class="text-sm text-muted-foreground">Loading…</p>
      }
    </div>

    <app-delete-confirmation-dialog
      #disconnectDialog
      [deleting]="busy()"
      (confirmed)="disconnect()"
      (cancelled)="pending.set(null)"
    />
  `,
})
export class DemoSignInComponent implements OnInit {
  private readonly service = inject(SandboxSignInService);
  private readonly fb = inject(FormBuilder);
  private readonly disconnectDialog =
    viewChild.required<DeleteConfirmationDialogComponent>('disconnectDialog');

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

  confirmDisconnect(p: SignInProviderStatus): void {
    this.pending.set(p.provider);
    this.disconnectDialog().open({
      title: `Disconnect ${p.name} sign-in`,
      description: 'Its button leaves the sign-in page and its credentials are deleted.',
      itemName: p.name,
      itemDescription: p.clientId ?? '',
      warningMessage: `Guests who signed in with ${p.name} can no longer do so.`,
    });
  }

  disconnect(): void {
    const provider = this.pending();
    if (!provider) return;
    this.busy.set(true);
    this.service.disconnect(provider).subscribe({
      next: (status) => {
        this.busy.set(false);
        this.pending.set(null);
        this.disconnectDialog().close();
        this.replace(status);
      },
      error: (err) => {
        this.busy.set(false);
        this.pending.set(null);
        this.disconnectDialog().close();
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
