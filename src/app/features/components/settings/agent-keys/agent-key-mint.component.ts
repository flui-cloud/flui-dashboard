import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideLoader,
  lucideLock,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { HlmInputDirective } from '@spartan-ng/ui-input-helm';
import { HlmLabelDirective } from '@spartan-ng/ui-label-helm';
import { CreateApiKeyResultDto } from '../../../../core/api/model/createApiKeyResultDto';
import { AgentSkill } from './agent-skill.service';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { AgentKeyApplicationPickerComponent } from './agent-key-application-picker.component';
import { AgentKeyProjectPickerComponent } from './agent-key-project-picker.component';
import { ConnectAgentComponent } from './connect-agent.component';

export interface MintRequest {
  name: string;
  groups: string[];
  expiresAt?: string;
  applicationIds?: string[];
  projectIds?: string[];
}

// One entry per area the API publishes. A missing one is not a crash — the
// section falls back to the raw key — but it puts a lower-case machine word
// where a heading belongs, which is how `access` read until the switches for
// who-can-reach-what arrived under it.
const AREA_LABEL: Record<string, string> = {
  apps: 'Applications',
  observability: 'Logs and health',
  backups: 'Backups',
  migrations: 'Migrations',
  mail: 'Mail',
  access: 'Who has access',
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
    AgentKeyApplicationPickerComponent,
    AgentKeyProjectPickerComponent,
    ConnectAgentComponent,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideLoader,
      lucideLock,
      lucideTriangleAlert,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (minted(); as key) {
      <div class="space-y-3">
        <div class="flex items-start gap-2">
          <ng-icon name="lucideCheck" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p class="text-sm font-medium text-foreground">{{ key.name }} is ready.</p>
        </div>
        <app-connect-agent
          [apiKey]="key.key"
          [skill]="skill()"
          [skillError]="skillError()"
          (dismiss)="dismiss.emit()"
        />
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

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Which applications
            </p>
            <button
              type="button"
              data-testid="toggle-app-scope"
              (click)="limitToApps.set(!limitToApps())"
              class="text-xs font-medium text-primary underline underline-offset-2"
            >
              {{ limitToApps() ? 'Reach every application instead' : 'Limit to specific applications' }}
            </button>
          </div>
          @if (limitToApps()) {
            <app-agent-key-application-picker
              #appPicker
              [suggestDefault]="true"
              (selectionChange)="pickedApps.set($event)"
            />
          } @else {
            <p class="text-sm text-muted-foreground">
              Every application you can already reach — the default. Narrow it above if this
              agent is only meant to work on some of them.
            </p>
          }
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Which projects
            </p>
            <button
              type="button"
              data-testid="toggle-project-scope"
              (click)="limitToProjects.set(!limitToProjects())"
              class="text-xs font-medium text-primary underline underline-offset-2"
            >
              {{ limitToProjects() ? 'Drop the project grant' : 'Also grant whole projects' }}
            </button>
          </div>
          @if (limitToProjects()) {
            <app-agent-key-project-picker
              #projectPicker
              (selectionChange)="pickedProjects.set($event)"
            />
            <p class="text-xs text-muted-foreground">
              An app added to a granted project later is reached too — nothing to reissue.
              Combines with the applications above rather than replacing them.
            </p>
          } @else {
            <p class="text-sm text-muted-foreground">
              No project grant — the default. Grant one if this agent should keep reaching a
              project's apps as it grows, without you widening the key by hand each time.
            </p>
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
  readonly skill = input<AgentSkill | null>(null);
  readonly skillError = input<string | null>(null);

  readonly create = output<MintRequest>();
  readonly dismiss = output<void>();

  protected readonly lifetimes = LIFETIMES;
  protected name = '';
  protected lifetime = '30d';
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly limitToApps = signal(false);
  protected readonly pickedApps = signal<string[]>([]);
  private readonly appPicker = viewChild<AgentKeyApplicationPickerComponent>('appPicker');
  protected readonly limitToProjects = signal(false);
  protected readonly pickedProjects = signal<string[]>([]);
  private readonly projectPicker = viewChild<AgentKeyProjectPickerComponent>('projectPicker');

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
      applicationIds: this.limitToApps() ? this.pickedApps() : undefined,
      projectIds: this.limitToProjects() ? this.pickedProjects() : undefined,
    });
  }

  reset(): void {
    this.name = '';
    this.lifetime = '30d';
    this.picked.set(new Set());
    this.limitToApps.set(false);
    this.pickedApps.set([]);
    this.appPicker()?.reset();
    this.limitToProjects.set(false);
    this.pickedProjects.set([]);
    this.projectPicker()?.reset();
  }
}
