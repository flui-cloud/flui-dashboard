import {
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
import { provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFile, lucideFolder, lucideX } from '@ng-icons/lucide';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlTable } from '../../../ui/patterns/table';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
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
  imports: [
    FormsModule,
    FlPanel,
    FlTable,
    FlAlert,
    FlField,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideFile, lucideFolder, lucideX })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="title()" [flush]="true" data-testid="volume-backup-browser">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        [iconOnly]="true"
        aria-label="Close"
        (click)="closed.emit()"
      >
        <fl-icon name="lucideX" />
      </button>

      <div class="flex flex-col gap-3 p-4">
        <nav class="fl-row gap-1" aria-label="Folder">
          <button flButton="ghost" size="sm" type="button" (click)="open('')">/</button>
          @for (c of crumbs(); track c.path) {
            <fl-icon class="text-fl-ink-muted" name="lucideChevronRight" [size]="14" />
            <button flButton="ghost" size="sm" type="button" class="fl-mono" (click)="open(c.path)">
              {{ c.label }}
            </button>
          }
        </nav>

        @if (error(); as e) {
          <fl-alert tone="error" title="Could not read the backup">{{ e }}</fl-alert>
        }

        <div class="max-h-80 overflow-y-auto rounded-fl-md border border-fl-border">
          @if (loading()) {
            <fl-loading-state [rows]="3" />
          } @else if (!entries().length) {
            <fl-empty-state title="Empty folder" icon="lucideFolder" [compact]="true" />
          } @else {
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col" class="is-fit"><span class="fl-sr">Select</span></th>
                  <th scope="col">Name</th>
                  <th scope="col" class="is-num">Size</th>
                  <th scope="col" class="hidden sm:table-cell">Modified</th>
                </tr>
              </thead>
              <tbody>
                @for (e of entries(); track e.name) {
                  @let full = pathOf(e);
                  <tr [class.is-selected]="selected().has(full)">
                    <td class="is-fit">
                      <input
                        type="checkbox"
                        [checked]="selected().has(full)"
                        (change)="toggle(full)"
                        [attr.aria-label]="'Select ' + e.name"
                      />
                    </td>
                    <td>
                      @if (e.type === 'directory') {
                        <button
                          type="button"
                          class="fl-link inline-flex items-center gap-1.5"
                          (click)="open(full)"
                        >
                          <fl-icon name="lucideFolder" [size]="14" />
                          {{ e.name }}
                        </button>
                      } @else {
                        <span class="inline-flex items-center gap-1.5">
                          <fl-icon class="text-fl-ink-muted" name="lucideFile" [size]="14" />
                          {{ e.name }}
                          @if (e.consistentCopy) {
                            <span
                              class="text-fl-caption text-fl-ink-muted"
                              title="Database file copied safely while the app ran"
                              >Consistent</span
                            >
                          }
                        </span>
                      }
                    </td>
                    <td class="is-num text-fl-ink-muted">{{ bytesOrDash(e.size) }}</td>
                    <td class="hidden text-fl-ink-muted sm:table-cell">
                      {{ e.modifiedAt ? formatDate(e.modifiedAt) : '' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <fl-field label="Restore into" for="browser-restore-target">
            <span class="fl-select-wrap">
              <select
                id="browser-restore-target"
                class="fl-select fl-select--sm"
                [ngModel]="targetId()"
                (ngModelChange)="targetId.set($event)"
              >
                <option value="">This app</option>
                @for (t of targets(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </span>
          </fl-field>
          <fl-field label="Write them" for="browser-restore-mode">
            <span class="fl-select-wrap">
              <select
                id="browser-restore-mode"
                class="fl-select fl-select--sm"
                [ngModel]="mode()"
                (ngModelChange)="mode.set($event)"
              >
                <option value="over">Over the current files</option>
                <option value="folder">Into a folder, keeping both</option>
              </select>
            </span>
          </fl-field>
          @if (mode() === 'folder') {
            <fl-field label="Folder" for="browser-restore-folder">
              <div class="fl-input w-48">
                <input
                  id="browser-restore-folder"
                  class="fl-mono"
                  [ngModel]="folder()"
                  (ngModelChange)="folder.set($event)"
                />
              </div>
            </fl-field>
          }
          <button
            flButton
            size="sm"
            type="button"
            (click)="restoreSelected()"
            [disabled]="
              !selection().length || starting() || (mode() === 'folder' && !folder().trim())
            "
          >
            @if (starting()) {
              <fl-spinner label="Starting" />
            }
            Restore selected ({{ selection().length }})
          </button>
          <button
            flButton="ghost"
            size="sm"
            type="button"
            [attr.aria-expanded]="showHelp()"
            (click)="showHelp.set(!showHelp())"
          >
            {{ showHelp() ? 'Hide details' : 'Details' }}
          </button>
        </div>
        @if (showHelp()) {
          <p class="max-w-2xl text-fl-body-sm text-fl-ink-muted">
            Selected files and folders are written into the app's volume while it runs. Nothing else
            on the volume changes. If the app is writing to a file you restore, a database file for
            example, stop the app first.
          </p>
        }
      </div>
    </fl-panel>
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
  protected readonly selection = computed(() => collapseSelection(this.selected()));
  protected readonly title = computed(() => {
    const b = this.backup();
    const taken = `Files in the backup of ${formatDate(b.createdAt ?? '')}`;
    return b.volumeName ? `${taken} · ${b.volumeName}` : taken;
  });

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
      const listing = await this.api.browse(this.appId(), this.backup().id, path);
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
