import {
  Component,
  computed,
  input,
  ElementRef,
  effect,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateApiKeyResultDto } from '../../../../core/api/model/createApiKeyResultDto';
import { AgentSkill } from './agent-skill.service';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlButton } from '../../../../ui/primitives/button';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { FlStatus } from '../../../../ui/primitives/status';
import { AgentKeyApplicationPickerComponent } from './agent-key-application-picker.component';
import { AgentKeyProjectPickerComponent } from './agent-key-project-picker.component';
import { ConnectAgentComponent } from './connect-agent.component';
import { AgentKeyAreaRow } from './agent-key-area-row';
import { AREA_LABEL } from './agent-key-scopes-edit';

export interface MintRequest {
  name: string;
  groups: string[];
  expiresAt?: string;
  applicationIds?: string[];
  projectIds?: string[];
}

const LIFETIMES: { id: string; label: string; days: number | null }[] = [
  { id: '1d', label: '24 hours', days: 1 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'never', label: 'No expiry', days: null },
];

@Component({
  selector: 'app-agent-key-mint',
  imports: [
    FormsModule,
    FlAlert,
    FlField,
    FlButton,
    FlSpinner,
    FlStatus,
    AgentKeyApplicationPickerComponent,
    AgentKeyProjectPickerComponent,
    ConnectAgentComponent,
    AgentKeyAreaRow,
  ],
  template: `
    @if (minted(); as key) {
      <div class="flex flex-col gap-3" #result>
        <fl-status tone="success" [label]="key.name + ' is ready'" />
        <app-connect-agent
          [apiKey]="key.key"
          [skill]="skill()"
          [skillError]="skillError()"
          (dismiss)="dismiss.emit()"
        />
      </div>
    } @else {
      <div class="flex flex-col gap-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <fl-field
            label="Name"
            for="key-name"
            hint="So you can tell this agent from the next one when you come to revoke it."
          >
            <div class="fl-input fl-input--lg">
              <input
                id="key-name"
                data-testid="key-name"
                type="text"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                [disabled]="disabled()"
                placeholder="Claude Code on my laptop"
              />
            </div>
          </fl-field>
          <fl-field
            label="Expires"
            for="key-life"
            hint="A consent that ends on its own is one less thing to remember."
          >
            <span class="fl-select-wrap">
              <select
                id="key-life"
                class="fl-select"
                [(ngModel)]="lifetime"
                [disabled]="disabled()"
              >
                @for (l of lifetimes; track l.id) {
                  <option [value]="l.id">{{ l.label }}</option>
                }
              </select>
            </span>
          </fl-field>
        </div>

        <section class="flex flex-col" aria-label="What the agent may do">
          <h3 class="m-0 text-fl-body-sm font-semibold">What the agent may do</h3>
          <div class="divide-y divide-fl-border-subtle">
            @for (area of areas(); track area.key) {
              <app-agent-key-area-row
                [attr.data-testid]="'area-' + area.key"
                [label]="area.label"
                [groups]="area.groups"
                [picked]="picked()"
                [disabled]="disabled()"
                (choose)="choose(area.groups, $event)"
              />
            }
          </div>
        </section>

        <section class="flex flex-col gap-2" aria-label="Which applications">
          <h3 class="m-0 text-fl-body-sm font-semibold">Which applications</h3>
          <label class="fl-check">
            <input
              type="checkbox"
              data-testid="toggle-app-scope"
              [checked]="limitToApps()"
              (change)="limitToApps.set(!limitToApps())"
            />
            Limit to specific applications
          </label>
          @if (limitToApps()) {
            <app-agent-key-application-picker
              #appPicker
              [suggestDefault]="true"
              (selectionChange)="pickedApps.set($event)"
            />
          } @else {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              Every application you can already reach, the default. Narrow it if this agent is only
              meant to work on some of them.
            </p>
          }
        </section>

        <section class="flex flex-col gap-2" aria-label="Which projects">
          <h3 class="m-0 text-fl-body-sm font-semibold">Which projects</h3>
          <label class="fl-check">
            <input
              type="checkbox"
              data-testid="toggle-project-scope"
              [checked]="limitToProjects()"
              (change)="limitToProjects.set(!limitToProjects())"
            />
            Also grant whole projects
          </label>
          @if (limitToProjects()) {
            <app-agent-key-project-picker
              #projectPicker
              (selectionChange)="pickedProjects.set($event)"
            />
            <p class="m-0 text-fl-caption text-fl-ink-muted">
              An app added to a granted project later is reached too, with nothing to reissue. It
              combines with the applications above rather than replacing them.
            </p>
          } @else {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted">
              No project grant, the default. Grant one if this agent should keep reaching a
              project's apps as it grows, without you widening the key by hand each time.
            </p>
          }
        </section>

        @if (error(); as e) {
          <fl-alert tone="error" title="Key not created">
            <span data-testid="mint-error">{{ e }}</span>
          </fl-alert>
        }

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="m-0 text-fl-caption text-fl-ink-muted">
            Pick at least one area: a key with none would carry your full weight.
          </p>
          <button
            flButton="primary"
            type="button"
            data-testid="mint-key"
            (click)="submit()"
            [disabled]="!canSubmit()"
          >
            @if (busy()) {
              <fl-spinner label="Creating" />
            }
            Create key
          </button>
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
  protected readonly name = signal('');
  protected lifetime = '30d';
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly limitToApps = signal(false);
  protected readonly pickedApps = signal<string[]>([]);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');

  private readonly appPicker = viewChild<AgentKeyApplicationPickerComponent>('appPicker');
  protected readonly limitToProjects = signal(false);
  protected readonly pickedProjects = signal<string[]>([]);
  private readonly projectPicker = viewChild<AgentKeyProjectPickerComponent>('projectPicker');

  constructor() {
    effect(() => {
      this.result()?.nativeElement.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    });
  }

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
      !this.busy() && !this.disabled() && this.picked().size > 0 && this.name().trim().length > 0,
  );

  protected choose(groups: PermissionGroupDto[], key: string | null): void {
    const next = new Set(this.picked());
    for (const g of groups) next.delete(g.key);
    if (key) next.add(key);
    this.picked.set(next);
  }

  protected toggle(key: string): void {
    const next = new Set(this.picked());
    if (!next.delete(key)) next.add(key);
    this.picked.set(next);
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const days = LIFETIMES.find((l) => l.id === this.lifetime)?.days ?? null;
    this.create.emit({
      name: this.name().trim(),
      groups: [...this.picked()],
      expiresAt: days === null ? undefined : new Date(Date.now() + days * 86_400_000).toISOString(),
      applicationIds: this.limitToApps() ? this.pickedApps() : undefined,
      projectIds: this.limitToProjects() ? this.pickedProjects() : undefined,
    });
  }

  reset(): void {
    this.name.set('');
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
