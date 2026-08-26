import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideKeyRound,
  lucidePlugZap,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { DeleteConfirmationDialogComponent } from '../../../../shared/components/delete-confirmation-dialog.component';
import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { KeySurface, readKeySurface, understatesItself } from './agent-key-surface';
import {
  ConnectedKey,
  KeyConnection,
  readKeyConnection,
} from './agent-key-connection';

interface KeyRow {
  key: ApiKeyResponseDto;
  surface: KeySurface;
  warn: boolean;
  expired: boolean;
  scopes: string;
  connection: KeyConnection;
}

@Component({
  selector: 'app-agent-key-list',
  standalone: true,
  imports: [
    DatePipe,
    NgIcon,
    HlmBadgeDirective,
    DeleteConfirmationDialogComponent,
  ],
  providers: [provideIcons({ lucideKeyRound, lucidePlugZap, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length === 0) {
      <div class="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <ng-icon name="lucideKeyRound" class="mx-auto h-5 w-5 text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground" data-testid="no-keys">
          No keys yet. Nothing is holding a credential of yours.
        </p>
      </div>
    } @else {
      <ul class="divide-y divide-border rounded-lg border border-border">
        @for (row of rows(); track row.key.id) {
          <li class="space-y-2 p-4" [attr.data-testid]="'key-' + row.key.id">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-foreground">{{ row.key.name }}</span>
                  @if (row.key.revoked) {
                    <span hlmBadge variant="secondary" class="text-xs">Revoked</span>
                  } @else if (row.expired) {
                    <span hlmBadge variant="secondary" class="text-xs">Expired</span>
                  }
                  @if (row.warn) {
                    <span hlmBadge variant="destructive" class="text-xs" data-testid="beyond-groups">
                      Wider than its name
                    </span>
                  }
                  @if (row.key.current) {
                    <span hlmBadge variant="secondary" class="text-xs" data-testid="current-key">
                      You are signed in with this
                    </span>
                  }
                </div>
                <p class="text-sm text-muted-foreground" [attr.data-testid]="'headline-' + row.key.id">
                  {{ row.surface.headline }}
                </p>
              </div>

              @if (!row.key.revoked) {
                <button
                  type="button"
                  [attr.data-testid]="'revoke-' + row.key.id"
                  (click)="ask(row.key)"
                  [disabled]="revoking() === row.key.id"
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/50 bg-background px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  {{ revoking() === row.key.id ? 'Revoking…' : 'Revoke' }}
                </button>
              }
            </div>

            @if (row.surface.caution; as caution) {
              <div
                class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground"
                [attr.data-testid]="'caution-' + row.key.id"
              >
                <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{{ caution }}</span>
              </div>
            }

            @if (row.surface.groups.length) {
              <div class="flex flex-wrap gap-1.5">
                @for (g of row.surface.groups; track g.key) {
                  <span hlmBadge variant="outline" class="text-xs" [title]="g.summary">{{ g.label }}</span>
                }
              </div>
            }

            <p class="font-mono text-[11px] text-muted-foreground/80 break-all">{{ row.scopes }}</p>

            <p class="text-xs text-muted-foreground" [attr.data-testid]="'when-' + row.key.id">
              Created {{ row.key.createdAt | date: 'medium' }}
              @if (row.key.expiresAt) {
                · {{ row.expired ? 'expired' : 'expires' }} {{ row.key.expiresAt | date: 'medium' }}
              } @else {
                · no expiry
              }
              · {{ row.connection.seen }}
            </p>

            <p
              class="flex items-start gap-1.5 text-xs"
              [class]="row.connection.outOfDate ? 'text-destructive' : 'text-muted-foreground'"
              [attr.data-testid]="'connection-' + row.key.id"
            >
              <ng-icon name="lucidePlugZap" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                @if (!row.connection.everUsed) {
                  Never spoken to this instance.
                }
                {{ row.connection.skill }}
              </span>
            </p>
          </li>
        }
      </ul>
    }

    <app-delete-confirmation-dialog
      #revokeDialog
      (confirmed)="confirm()"
      (cancelled)="pending.set(null)"
    />
  `,
})
export class AgentKeyListComponent {
  readonly keys = input.required<ApiKeyResponseDto[]>();
  readonly catalogue = input.required<PermissionGroupDto[]>();
  readonly revoking = input<string | null>(null);
  readonly currentSkillVersion = input<string | null>(null);

  readonly revoke = output<ApiKeyResponseDto>();

  private readonly dialog = viewChild.required<DeleteConfirmationDialogComponent>('revokeDialog');
  protected readonly pending = signal<ApiKeyResponseDto | null>(null);

  protected readonly rows = computed<KeyRow[]>(() =>
    this.keys().map((key) => {
      const surface = readKeySurface(key, this.catalogue());
      return {
        key,
        surface,
        warn: understatesItself(surface) || surface.shape === 'unscoped',
        expired: !!key.expiresAt && new Date(key.expiresAt).getTime() < Date.now(),
        scopes: key.scopes?.length ? key.scopes.join(' · ') : 'no scope list — unscoped',
        connection: readKeyConnection(
          key as ConnectedKey,
          this.currentSkillVersion(),
        ),
      };
    }),
  );

  protected ask(key: ApiKeyResponseDto): void {
    this.pending.set(key);
    const connection = readKeyConnection(
      key as ConnectedKey,
      this.currentSkillVersion(),
    );
    this.dialog().open({
      title: key.current ? 'Revoke the key you are using' : 'Revoke this key',
      description: key.current
        ? 'This is the credential this browser is signed in with. Revoking it ends your session here.'
        : 'The agent holding it stops working the moment you confirm.',
      itemName: key.name,
      itemDescription: `${readKeySurface(key, this.catalogue()).headline} · ${
        connection.everUsed ? connection.seen : 'never used'
      }`,
      warningMessage: key.current
        ? 'You will be signed out immediately, and there is no way back in with this credential. ' +
          'Anything already built stays where it is — only the credential goes.'
        : 'Anything the agent has already built stays where it is — only the credential goes. ' +
          'You are not signed in with this one, so your own session is unaffected.',
      confirmButtonText: 'Revoke',
    });
  }

  protected confirm(): void {
    const key = this.pending();
    this.pending.set(null);
    this.dialog().close();
    if (key) this.revoke.emit(key);
  }
}
