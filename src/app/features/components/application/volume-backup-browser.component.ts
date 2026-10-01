import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight,
  lucideCircleAlert,
  lucideFile,
  lucideFolder,
  lucideLoader,
  lucideRotateCcw,
  lucideX,
} from '@ng-icons/lucide';
import { VolumeBackupsService } from '../../service/volume-backups.service';
import {
  VolumeBackup,
  VolumeBackupFileEntry,
  backupPathCrumbs,
  bytesOrDash,
  collapseSelection,
  joinBackupPath,
} from '../../model/volume-backup.models';
import { formatDate } from './snapshot-format';

export interface RestoreTarget {
  id: string;
  name: string;
}

export interface VolumeRestoreStarted {
  operationId: string;
  label: string;
  targetApplicationId: string;
}

@Component({
  selector: 'app-volume-backup-browser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideChevronRight,
      lucideCircleAlert,
      lucideFile,
      lucideFolder,
      lucideLoader,
      lucideRotateCcw,
      lucideX,
    }),
  ],
  template: `
    <div class="card-inner p-4 space-y-3" data-testid="volume-backup-browser">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-medium">
          Files in the backup of {{ formatDate(backup().createdAt ?? '') }}
          @if (backup().volumeName) {
            <span class="font-mono text-xs text-muted-foreground"
              >· {{ backup().volumeName }}</span
            >
          }
        </div>
        <button
          (click)="closed.emit()"
          class="p-1 rounded hover:bg-muted"
          title="Close"
        >
          <ng-icon name="lucideX" class="h-4 w-4" />
        </button>
      </div>

      <nav class="flex flex-wrap items-center gap-1 text-xs">
        <button
          (click)="open('')"
          class="px-1.5 py-0.5 rounded hover:bg-muted font-medium"
        >
          /
        </button>
        @for (c of crumbs(); track c.path) {
          <ng-icon
            name="lucideChevronRight"
            class="h-3 w-3 text-muted-foreground"
          />
          <button
            (click)="open(c.path)"
            class="px-1.5 py-0.5 rounded hover:bg-muted font-mono"
          >
            {{ c.label }}
          </button>
        }
      </nav>

      @if (error(); as e) {
        <p class="flex items-center gap-1.5 text-xs text-red-600">
          <ng-icon name="lucideCircleAlert" class="h-3.5 w-3.5" /> {{ e }}
        </p>
      }

      <div class="max-h-80 overflow-y-auto rounded-md border border-border">
        @if (loading()) {
          <div class="p-4 text-xs text-muted-foreground flex items-center gap-2">
            <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            Reading the backup…
          </div>
        } @else if (!entries().length) {
          <div class="p-4 text-xs text-muted-foreground">Empty folder</div>
        } @else {
          <table class="w-full text-sm">
            <tbody>
              @for (e of entries(); track e.name) {
                @let full = pathOf(e);
                <tr class="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td class="w-8 px-3 py-1.5">
                    <input
                      type="checkbox"
                      [checked]="selected().has(full)"
                      (change)="toggle(full)"
                      [attr.aria-label]="'Select ' + e.name"
                    />
                  </td>
                  <td class="px-1 py-1.5">
                    @if (e.type === 'directory') {
                      <button
                        (click)="open(full)"
                        class="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <ng-icon
                          name="lucideFolder"
                          class="h-3.5 w-3.5 text-indigo-500"
                        />
                        {{ e.name }}
                      </button>
                    } @else {
                      <span class="inline-flex items-center gap-1.5">
                        <ng-icon
                          name="lucideFile"
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
                        {{ e.name }}
                        @if (e.consistentCopy) {
                          <span
                            class="text-[10px] px-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            title="Database file copied safely while the app ran"
                            >consistent</span
                          >
                        }
                      </span>
                    }
                  </td>
                  <td class="px-3 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {{ bytesOrDash(e.size) }}
                  </td>
                  <td class="px-3 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {{ e.modifiedAt ? formatDate(e.modifiedAt) : '' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <label class="block text-xs">
          <span class="text-muted-foreground">Restore into</span>
          <select
            [ngModel]="targetId()"
            (ngModelChange)="targetId.set($event)"
            class="mt-1 block h-8 px-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="">This app</option>
            @for (t of targets(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
        </label>
        <label class="block text-xs">
          <span class="text-muted-foreground">Write them</span>
          <select
            [ngModel]="mode()"
            (ngModelChange)="mode.set($event)"
            class="mt-1 block h-8 px-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="over">Over the current files</option>
            <option value="folder">Into a folder, keeping both</option>
          </select>
        </label>
        @if (mode() === 'folder') {
          <label class="block text-xs">
            <span class="text-muted-foreground">Folder</span>
            <input
              [ngModel]="folder()"
              (ngModelChange)="folder.set($event)"
              class="mt-1 block h-8 w-48 px-2 rounded-md border border-input bg-background text-sm font-mono"
            />
          </label>
        }
        <button
          (click)="restoreSelected()"
          [disabled]="!selection().length || starting() || (mode() === 'folder' && !folder().trim())"
          class="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <ng-icon
            [name]="starting() ? 'lucideLoader' : 'lucideRotateCcw'"
            class="h-3.5 w-3.5"
            [class.animate-spin]="starting()"
          />
          Restore selected ({{ selection().length }})
        </button>
        <button
          (click)="showHelp.set(!showHelp())"
          class="h-8 px-2 text-xs text-muted-foreground hover:underline"
        >
          {{ showHelp() ? 'Hide details' : 'Details' }}
        </button>
      </div>
      @if (showHelp()) {
        <p class="text-xs text-muted-foreground max-w-2xl">
          Selected files and folders are written into the app's volume while it
          runs. Nothing else on the volume changes. If the app is writing to a
          file you restore — a database file, say — stop the app first.
        </p>
      }
    </div>
  `,
})
export class VolumeBackupBrowserComponent {
  private readonly api = inject(VolumeBackupsService);

  readonly appId = input.required<string>();
  readonly backup = input.required<VolumeBackup>();
  readonly targets = input<RestoreTarget[]>([]);

  readonly started = output<VolumeRestoreStarted>();
  readonly closed = output<void>();

  protected readonly path = signal('');
  protected readonly entries = signal<VolumeBackupFileEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly targetId = signal('');
  protected readonly mode = signal<'over' | 'folder'>('over');
  protected readonly folder = signal(defaultFolder());
  protected readonly starting = signal(false);
  protected readonly showHelp = signal(false);

  protected readonly crumbs = computed(() => backupPathCrumbs(this.path()));
  protected readonly selection = computed(() =>
    collapseSelection(this.selected()),
  );

  protected readonly formatDate = formatDate;
  protected readonly bytesOrDash = bytesOrDash;

  constructor() {
    effect(() => {
      this.backup();
      untracked(() => {
        this.selected.set(new Set());
        void this.open('');
      });
    });
  }

  protected pathOf(e: VolumeBackupFileEntry): string {
    return joinBackupPath(this.path(), e.name);
  }

  protected async open(path: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const listing = await this.api.browse(
        this.appId(),
        this.backup().id,
        path,
      );
      if (listing.isFile) return;
      this.path.set(listing.path);
      this.entries.set(listing.entries);
    } catch (err) {
      this.error.set(this.api.errorMessage(err, 'Could not read the backup'));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(path: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  protected async restoreSelected(): Promise<void> {
    const paths = this.selection();
    if (!paths.length) return;
    const target = this.targetId();
    const intoFolder = this.mode() === 'folder';
    this.starting.set(true);
    this.error.set(null);
    try {
      const res = await this.api.restoreFiles(this.appId(), this.backup().id, {
        paths,
        ...(intoFolder ? { targetDirectory: this.folder().trim() } : {}),
        ...(target ? { targetApplicationId: target } : {}),
      });
      const where = target
        ? ` into ${this.targets().find((t) => t.id === target)?.name ?? 'another app'}`
        : '';
      this.started.emit({
        operationId: res.operationId,
        label: `Restoring ${paths.length} item${paths.length === 1 ? '' : 's'}${where}`,
        targetApplicationId: res.targetApplicationId,
      });
      this.selected.set(new Set());
    } catch (err) {
      this.error.set(this.api.errorMessage(err, 'Could not start the restore'));
    } finally {
      this.starting.set(false);
    }
  }
}

function defaultFolder(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `restored-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
