import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideEye,
  lucideEyeOff,
  lucideLoader,
  lucideLock,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { CreateApiKeyResultDto } from '../../../../core/api/model/createApiKeyResultDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';

export interface MintRequest {
  name: string;
  groups: string[];
  expiresAt?: string;
}

const AREA_LABEL: Record<string, string> = {
  apps: 'Applications',
  observability: 'Logs and health',
  backups: 'Backups',
  migrations: 'Migrations',
  mail: 'Mail',
};

const LIFETIMES: { id: string; label: string; days: number | null }[] = [
  { id: '1d', label: '24 hours', days: 1 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'never', label: 'No expiry', days: null },
];

@Component({
  selector: 'app-agent-key-mint',
  standalone: true,
  imports: [
    FormsModule,
    NgIcon,
    HlmBadgeDirective,
    HlmInputDirective,
    HlmLabelDirective,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideEye,
      lucideEyeOff,
      lucideLoader,
      lucideLock,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (minted(); as key) {
      <div class="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
        <div class="flex items-start gap-2">
          <ng-icon name="lucideCheck" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground">{{ key.name }} is ready.</p>
            <p class="text-sm text-muted-foreground">
              Copy it now — this is the only time the value is shown. If you lose it,
              revoke this key and issue another.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <code
            data-testid="minted-key"
            class="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          >{{ shown() ? key.key : masked(key.key) }}</code>
          <button
            type="button"
            data-testid="toggle-key"
            (click)="shown.set(!shown())"
            [attr.aria-label]="shown() ? 'Hide the key' : 'Show the key'"
            class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ng-icon [name]="shown() ? 'lucideEyeOff' : 'lucideEye'" class="h-3.5 w-3.5" />
            {{ shown() ? 'Hide' : 'Show' }}
          </button>
          <button
            type="button"
            data-testid="copy-key"
            (click)="copy(key.key)"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ng-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
            {{ copied() ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <div class="rounded-md border border-border bg-background px-3 py-2">
          <p class="text-xs text-muted-foreground">Point your agent at this endpoint:</p>
          <p class="mt-1 font-mono text-xs text-foreground break-all">POST {{ mcpEndpoint() }}</p>
          <p class="font-mono text-xs text-muted-foreground break-all">Authorization: Bearer &lt;your key&gt;</p>
        </div>

        <button
          type="button"
          data-testid="dismiss-minted"
          (click)="dismiss.emit()"
          class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          I have copied it
        </button>
      </div>
    } @else {
      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label hlmLabel for="key-name">Name</label>
            <input
              hlmInput
              id="key-name"
              data-testid="key-name"
              type="text"
              [(ngModel)]="name"
              [disabled]="disabled()"
              placeholder="Claude Code on my laptop"
              class="w-full"
            />
            <p class="text-xs text-muted-foreground">
              So you can tell this agent from the next one when you come to revoke it.
            </p>
          </div>
          <div class="space-y-1.5">
            <label hlmLabel for="key-life">Expires</label>
            <select
              hlmInput
              id="key-life"
              [(ngModel)]="lifetime"
              [disabled]="disabled()"
              class="w-full"
            >
              @for (l of lifetimes; track l.id) {
                <option [value]="l.id">{{ l.label }}</option>
              }
            </select>
            <p class="text-xs text-muted-foreground">
              A consent that ends on its own is one less thing to remember.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          @for (area of areas(); track area.key) {
            <div class="space-y-2">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {{ area.label }}
              </p>
              @for (g of area.groups; track g.key) {
                <label
                  [attr.data-testid]="'group-' + g.key"
                  [attr.data-grantable]="g.grantable"
                  class="flex gap-3 rounded-lg border p-3 transition-colors"
                  [class]="g.grantable
                    ? 'cursor-pointer border-border hover:border-primary/40 hover:bg-accent/40'
                    : 'border-dashed border-border bg-muted/30'"
                >
                  <input
                    type="checkbox"
                    class="mt-1 h-4 w-4 shrink-0 accent-primary"
                    [attr.data-testid]="'check-' + g.key"
                    [checked]="picked().has(g.key)"
                    [disabled]="!g.grantable || disabled()"
                    (change)="toggle(g.key)"
                  />
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="text-sm font-medium"
                        [class]="g.grantable ? 'text-foreground' : 'text-muted-foreground'"
                      >{{ g.label }}</span>
                      @if (!g.grantable) {
                        <span hlmBadge variant="secondary" class="gap-1 text-xs">
                          <ng-icon name="lucideLock" class="h-3 w-3" />
                          Not yours to grant
                        </span>
                      }
                    </div>
                    <p class="text-sm text-muted-foreground">{{ g.summary }}</p>
                    @if (!g.grantable) {
                      <p class="text-xs text-muted-foreground" [attr.data-testid]="'blocked-' + g.key">
                        A key is never worth more than the person who issued it, and this one
                        would be: your own permissions do not cover
                        <span class="font-mono">{{ g.blockedScopes.join(' · ') }}</span
                        >.
                      </p>
                    }
                    <p class="font-mono text-[11px] text-muted-foreground/80 break-all">
                      {{ g.scopes.join(' · ') }}
                    </p>
                  </div>
                </label>
              }
            </div>
          }
        </div>

        @if (error(); as e) {
          <div class="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
            <span data-testid="mint-error">{{ e }}</span>
          </div>
        }

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="mint-key"
            (click)="submit()"
            [disabled]="!canSubmit()"
            class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            @if (busy()) {
              <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
            }
            Create key
          </button>
          <p class="text-xs text-muted-foreground">
            {{ picked().size }} of {{ grantableCount() }} switches on.
            A key with nothing switched on would carry your full weight, so at least one is required.
          </p>
        </div>
      </div>
    }
  `,
})
export class AgentKeyMintComponent {
  readonly catalogue = input.required<PermissionGroupDto[]>();
  readonly minted = input<CreateApiKeyResultDto | null>(null);
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly error = input<string | null>(null);

  readonly create = output<MintRequest>();
  readonly dismiss = output<void>();

  private readonly cfg = inject(AppConfigService);

  protected readonly lifetimes = LIFETIMES;
  protected name = '';
  protected lifetime = '30d';
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly shown = signal(false);
  protected readonly copied = signal(false);

  protected readonly mcpEndpoint = computed(
    () => `${this.cfg.apiBaseUrl}/api/v1/mcp`,
  );

  protected readonly grantableCount = computed(
    () => this.catalogue().filter((g) => g.grantable).length,
  );

  protected readonly areas = computed(() => {
    const order: string[] = [];
    const byArea = new Map<string, PermissionGroupDto[]>();
    for (const g of this.catalogue()) {
      if (!byArea.has(g.area)) {
        byArea.set(g.area, []);
        order.push(g.area);
      }
      byArea.get(g.area)!.push(g);
    }
    return order.map((key) => ({
      key,
      label: AREA_LABEL[key] ?? key,
      groups: byArea.get(key)!,
    }));
  });

  protected readonly canSubmit = computed(
    () =>
      !this.busy() &&
      !this.disabled() &&
      this.picked().size > 0 &&
      this.name.trim().length > 0,
  );

  protected toggle(key: string): void {
    const next = new Set(this.picked());
    if (!next.delete(key)) next.add(key);
    this.picked.set(next);
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const days = LIFETIMES.find((l) => l.id === this.lifetime)?.days ?? null;
    this.create.emit({
      name: this.name.trim(),
      groups: [...this.picked()],
      expiresAt:
        days === null
          ? undefined
          : new Date(Date.now() + days * 86_400_000).toISOString(),
    });
  }

  reset(): void {
    this.name = '';
    this.lifetime = '30d';
    this.picked.set(new Set());
    this.shown.set(false);
    this.copied.set(false);
  }

  protected masked(value: string): string {
    return '•'.repeat(Math.min(value.length, 48));
  }

  protected copy(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2_000);
      })
      .catch(() => this.shown.set(true));
  }
}
