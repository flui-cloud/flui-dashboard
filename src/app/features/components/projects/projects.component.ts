import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFolders,
  lucidePlus,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { ProjectsService } from '../../service/projects.service';
import { PermissionService } from '../../../core/services/permission.service';
import { Project } from '../../model/project.model';
import { AppAttributes } from '../../model/iam.model';
import { DeleteConfirmationDialogComponent } from '../../../shared/components/delete-confirmation-dialog.component';

const FIELD =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
    DeleteConfirmationDialogComponent,
  ],
  providers: [provideIcons({ lucideFolders, lucidePlus, lucideTrash2, lucideX })],
  template: `
    <div class="p-6 max-w-6xl mx-auto space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground shrink-0">
            <ng-icon name="lucideFolders" class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-foreground">Projects</h2>
            <p class="text-sm text-muted-foreground">Group applications across clusters. An app belongs to at most one project.</p>
          </div>
        </div>
        @if (canManage()) {
          <button type="button" (click)="showCreate.set(!showCreate())"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 whitespace-nowrap">
            <ng-icon name="lucidePlus" class="h-4 w-4" /> New project
          </button>
        }
      </div>

      @if (showCreate() && canManage()) {
        <div hlmCard>
          <div hlmCardContent class="pt-5 space-y-3">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <input [class]="fieldClass" placeholder="my-project"
                  [value]="newName()" (input)="newName.set(value($event))" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input [class]="fieldClass" [value]="newDesc()" (input)="newDesc.set(value($event))" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1">Color (optional)</label>
              <div class="flex flex-wrap items-center gap-2">
                @for (c of presetColors; track c) {
                  <button type="button" (click)="newColor.set(c)" [title]="c"
                    class="h-7 w-7 rounded-full border-2 transition"
                    [style.background]="c"
                    [class]="newColor() === c
                      ? 'border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background'
                      : 'border-border hover:border-foreground/40'"></button>
                }
                <input type="color" [value]="colorOrDefault()" (input)="newColor.set(value($event))"
                  class="h-7 w-9 rounded border border-border bg-background p-0.5 cursor-pointer" title="Custom color" />
                <input [class]="hexFieldClass" type="text" placeholder="#22aa88" maxlength="7"
                  [value]="newColor()" (input)="newColor.set(value($event))" />
                @if (newColor()) {
                  <button type="button" (click)="newColor.set('')"
                    class="text-xs text-muted-foreground hover:text-foreground underline">clear</button>
                }
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" (click)="showCreate.set(false)"
                class="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button type="button" (click)="submitCreate()" [disabled]="!canCreate()"
                class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">Create project</button>
            </div>
          </div>
        </div>
      }

      <div class="grid gap-4 md:grid-cols-2">
        @for (p of projects.projects(); track p.id) {
          <div hlmCard class="border-l-4" [style.borderLeftColor]="p.color || 'transparent'">
            <div hlmCardContent class="pt-5 space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="h-3 w-3 rounded-full shrink-0 border border-border"
                      [style.background]="p.color || 'transparent'"></span>
                    <h3 class="text-base font-semibold text-foreground truncate">{{ p.name }}</h3>
                    <span hlmBadge variant="outline" class="text-[11px] font-mono">{{ p.slug }}</span>
                    <span hlmBadge variant="outline" class="text-[11px]">{{ appsInProject(p).length }}</span>
                  </div>
                  @if (p.description) {
                    <p class="text-sm text-muted-foreground mt-0.5">{{ p.description }}</p>
                  }
                </div>
                @if (canManage()) {
                  <button type="button" (click)="askDelete(p)"
                    class="text-muted-foreground hover:text-destructive shrink-0" title="Delete project">
                    <ng-icon name="lucideTrash2" class="h-4 w-4" />
                  </button>
                }
              </div>

              <div class="flex flex-wrap gap-1.5">
                @for (a of appsInProject(p); track a.id) {
                  <span class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                    {{ a.slug }}
                    @if (canManage()) {
                      <button type="button" (click)="projects.unassignApp(p.id, a.id)"
                        class="text-muted-foreground hover:text-destructive">
                        <ng-icon name="lucideX" class="h-3 w-3" />
                      </button>
                    }
                  </span>
                } @empty {
                  <span class="text-xs text-muted-foreground">No apps yet.</span>
                }
              </div>

              @if (canManage() && assignableApps(p).length) {
                <select [class]="selectClass" (change)="onAssign(p.id, $event)">
                  <option value="">Add an app…</option>
                  @for (a of assignableApps(p); track a.id) {
                    <option [value]="a.id">{{ a.name }} ({{ a.slug }}){{ a.project ? ' — ' + a.project : '' }}</option>
                  }
                </select>
              }
            </div>
          </div>
        } @empty {
          <div hlmCard class="md:col-span-2">
            <div hlmCardContent class="pt-6">
              <p class="text-sm text-muted-foreground">No projects yet.@if (canManage()) { Create one to start grouping apps.}</p>
            </div>
          </div>
        }
      </div>
    </div>

    <app-delete-confirmation-dialog
      #deleteDialog
      (confirmed)="confirmDelete()"
      (cancelled)="pendingDelete.set(null)"
    />
  `,
})
export class ProjectsComponent implements OnInit {
  protected readonly projects = inject(ProjectsService);
  private readonly perms = inject(PermissionService);
  protected readonly fieldClass = FIELD;
  protected readonly selectClass = FIELD + ' h-9 pr-8 appearance-none';
  protected readonly hexFieldClass =
    'h-7 w-24 rounded-md border border-input bg-background px-2 text-xs font-mono ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  readonly presetColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
  ];

  readonly canManage = computed(() => this.perms.isAdmin());

  colorOrDefault(): string {
    const c = this.newColor();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#6366f1';
  }

  readonly pendingDelete = signal<Project | null>(null);
  private readonly deleteDialog =
    viewChild.required<DeleteConfirmationDialogComponent>('deleteDialog');

  readonly showCreate = signal(false);
  readonly newName = signal('');
  readonly newDesc = signal('');
  readonly newColor = signal('');

  readonly canCreate = computed(() => this.newName().trim().length > 0);

  ngOnInit(): void {
    this.perms.load();
    this.projects.refresh();
  }

  value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  appsInProject(p: Project): AppAttributes[] {
    return this.projects.apps().filter((a) => a.project === p.slug);
  }

  assignableApps(p: Project): AppAttributes[] {
    return this.projects.apps().filter((a) => a.project !== p.slug);
  }

  submitCreate(): void {
    if (!this.canCreate()) return;
    this.projects.create({
      name: this.newName().trim(),
      description: this.newDesc().trim() || undefined,
      color: this.newColor().trim() || undefined,
    });
    this.newName.set('');
    this.newDesc.set('');
    this.newColor.set('');
    this.showCreate.set(false);
  }

  askDelete(p: Project): void {
    this.pendingDelete.set(p);
    this.deleteDialog().open({
      title: 'Delete project',
      description:
        'The project is removed, but its apps keep running and become unassigned.',
      itemName: p.name,
      itemDescription: p.slug,
      confirmButtonText: 'Delete project',
    });
  }

  confirmDelete(): void {
    const p = this.pendingDelete();
    if (p) this.projects.remove(p.id);
    this.pendingDelete.set(null);
    this.deleteDialog().close();
  }

  onAssign(projectId: string, e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const appId = sel.value;
    sel.value = '';
    if (appId) this.projects.assignApp(projectId, appId);
  }
}
