import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideLayers,
  lucideLoader,
  lucidePlus,
  lucideTrash2,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MessagingConsoleStateService } from './messaging-console-state.service';
import { bytes } from './messaging-format';

@Component({
  selector: 'app-messaging-stream-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, FormsModule, ConfirmationDialogComponent],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideLayers,
      lucideLoader,
      lucidePlus,
      lucideTrash2,
      lucideUsers,
      lucideX,
    }),
  ],
  template: `
    <div
      class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
    >
      <ng-icon name="lucideLayers" class="h-4 w-4 text-muted-foreground" />
      {{ s.nouns().collection }}
      <button
        type="button"
        (click)="showCreate.set(!showCreate())"
        class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-normal text-muted-foreground hover:bg-muted"
      >
        <ng-icon
          [name]="showCreate() ? 'lucideX' : 'lucidePlus'"
          class="h-3.5 w-3.5"
        />
        {{ showCreate() ? 'Cancel' : 'New ' + s.nouns().item }}
      </button>
    </div>

    @if (showCreate()) {
      <div class="mb-3 rounded-md border border-border p-3">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            [(ngModel)]="newName"
            [placeholder]="s.nouns().item + ' name (e.g. ORDERS)'"
            class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
          />
          <input
            type="text"
            [(ngModel)]="newSubjects"
            [placeholder]="
              s.nouns().routing.toLowerCase() +
              ', comma-separated (e.g. ' +
              s.nouns().subjectEg +
              ')'
            "
            class="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground"
          />
          @if (s.nouns().storageChoice) {
            <select
              [(ngModel)]="newStorage"
              class="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="file">{{ s.nouns().storeFile }}</option>
              <option value="memory">{{ s.nouns().storeMem }}</option>
            </select>
          }
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="createStream()"
              [disabled]="s.creating() || !newName.trim() || !newSubjects.trim()"
              class="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              @if (s.creating()) {
                <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
              }
              Create stream
            </button>
            @if (s.createError()) {
              <span class="text-xs text-destructive">{{ s.createError() }}</span>
            }
          </div>
        </div>
      </div>
    }

    @if (s.streams().length === 0) {
      <div
        class="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
      >
        No {{ s.nouns().collection.toLowerCase() }} yet. Create one above so
        producers can publish to its {{ s.nouns().routing.toLowerCase() }}.
      </div>
    } @else {
      <div class="overflow-hidden rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="w-8 px-2 py-2"></th>
              <th class="px-3 py-2 font-medium">{{ s.nouns().itemTitle }}</th>
              <th class="px-3 py-2 font-medium">{{ s.nouns().routing }}</th>
              <th class="w-24 px-3 py-2 font-medium">Messages</th>
              <th class="w-24 px-3 py-2 font-medium">Size</th>
              <th class="w-28 px-3 py-2 font-medium">Consumers</th>
              <th class="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            @for (st of s.streams(); track st.name) {
              <tr
                class="cursor-pointer border-t border-border hover:bg-muted/40"
                (click)="s.toggle(st.name)"
              >
                <td class="px-2 py-2 text-muted-foreground">
                  <ng-icon
                    [name]="
                      s.expanded() === st.name
                        ? 'lucideChevronDown'
                        : 'lucideChevronRight'
                    "
                    class="h-4 w-4"
                  />
                </td>
                <td class="px-3 py-2 font-medium text-foreground">
                  {{ st.name }}
                </td>
                <td class="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {{ st.subjects.join(', ') }}
                </td>
                <td class="px-3 py-2 font-mono text-xs text-foreground">
                  {{ st.messages }}
                </td>
                <td class="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {{ size(st.bytes) }}
                </td>
                <td class="px-3 py-2 text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    <ng-icon name="lucideUsers" class="h-3.5 w-3.5" />
                    {{ st.consumerCount }}
                  </span>
                </td>
                <td class="px-2 py-2 text-right">
                  <button
                    type="button"
                    (click)="askDelete(st.name); $event.stopPropagation()"
                    title="Delete stream"
                    class="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
              @if (s.expanded() === st.name) {
                <tr class="border-t border-border bg-muted/20">
                  <td colspan="7" class="px-3 py-2">
                    <div
                      class="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground"
                    >
                      <span
                        >retention:
                        <span class="text-foreground">{{
                          st.retention || '—'
                        }}</span></span
                      >
                      <span
                        >storage:
                        <span class="text-foreground">{{
                          st.storage || '—'
                        }}</span></span
                      >
                      @if (st.lastSeq > 0) {
                        <span
                          >seq:
                          <span class="text-foreground"
                            >{{ st.firstSeq }}–{{ st.lastSeq }}</span
                          ></span
                        >
                      }
                    </div>
                    @if (st.consumers.length === 0) {
                      <p class="text-xs text-muted-foreground">No consumers.</p>
                    } @else {
                      <table class="w-full text-xs">
                        <thead class="text-left text-muted-foreground">
                          <tr>
                            <th class="py-1 pr-3 font-medium">Consumer</th>
                            <th class="py-1 pr-3 font-medium">Pending</th>
                            <th class="py-1 pr-3 font-medium">Ack pending</th>
                            <th class="py-1 pr-3 font-medium">Redelivered</th>
                            <th class="py-1 pr-3 font-medium">Ack policy</th>
                            <th class="py-1 pr-3 font-medium">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (c of st.consumers; track c.name) {
                            <tr class="border-t border-border/60">
                              <td class="py-1 pr-3 font-mono text-foreground">
                                {{ c.name }}
                              </td>
                              <td class="py-1 pr-3 text-foreground">
                                {{ c.numPending }}
                              </td>
                              <td class="py-1 pr-3 text-muted-foreground">
                                {{ c.numAckPending }}
                              </td>
                              <td class="py-1 pr-3 text-muted-foreground">
                                {{ c.numRedelivered }}
                              </td>
                              <td class="py-1 pr-3 text-muted-foreground">
                                {{ c.ackPolicy || '—' }}
                              </td>
                              <td class="py-1 pr-3 text-muted-foreground">
                                {{ c.durable ? 'durable' : 'ephemeral' }}
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }

    <app-confirmation-dialog
      #deleteDialog
      [title]="'Delete ' + s.nouns().item"
      [message]="
        'Delete ' +
        s.nouns().item +
        ' “' +
        (s.pendingDelete() ?? '') +
        '”? Its stored messages are lost. This cannot be undone.'
      "
      confirmText="Delete"
      variant="danger"
      (confirmed)="s.confirmDelete(deleteDialog)"
      (cancelled)="s.pendingDelete.set(null)"
    />
  `,
})
export class MessagingStreamListComponent {
  protected readonly s = inject(MessagingConsoleStateService);

  @ViewChild('deleteDialog')
  private readonly deleteDialog?: ConfirmationDialogComponent;

  readonly showCreate = signal(false);
  newName = '';
  newSubjects = '';
  newStorage: 'file' | 'memory' = 'file';

  protected size(n: number): string {
    return bytes(n);
  }

  askDelete(name: string): void {
    this.s.askDelete(name, this.deleteDialog);
  }

  createStream(): void {
    const name = this.newName.trim();
    const subjects = this.newSubjects
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!name || !subjects.length) return;
    this.s.createStream(name, subjects, this.newStorage, () => {
      this.showCreate.set(false);
      this.newName = '';
      this.newSubjects = '';
    });
  }
}
