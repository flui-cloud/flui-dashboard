import { Component, computed, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { FlActionsMenu, MenuAction } from '../../../ui/overlays/actions-menu';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus, StatusTone } from '../../../ui/primitives/status';
import { ReadOnlySectionDirective } from '../../../shared/directives/read-only-section.directive';
import { MailConnection } from '../../model/mail-console.models';
import { MailConnectionDetails } from './mail-connection-details';
import { MailScopeSlot, blindSpotOf, pushes } from './mail-providers-helpers';

export interface MailConnectionAction {
  readonly action: 'test' | 'add-domain' | 'activate' | 'disconnect' | 'retry' | 'register';
  readonly connection: MailConnection;
}

@Component({
  selector: 'app-mail-scope-panel',
  imports: [
    FlPanel,
    FlTable,
    FlEmptyState,
    FlButton,
    FlIcon,
    FlStatus,
    FlActionsMenu,
    ReadOnlySectionDirective,
    MailConnectionDetails,
  ],
  providers: [provideIcons({ lucidePlus })],
  host: { class: 'block' },
  template: `
    <fl-panel [title]="slot().title" [count]="rows().length" [flush]="true">
      @if (!open()) {
        <button
          panelActions
          appReadOnlySection="mail"
          flButton
          size="sm"
          type="button"
          (click)="openConnect.emit()"
        >
          <fl-icon name="lucidePlus" [size]="14" />
          {{ connectLabel() }}
        </button>
      }
      <p class="m-0 border-b border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        {{ slot().blurb }}
      </p>

      @if (!rows().length) {
        <fl-empty-state
          [compact]="true"
          title="Nothing connected"
          [body]="
            slot().id === 'bulk'
              ? 'Bulk sends are refused until a provider whose terms allow them is set up.'
              : undefined
          "
        />
      } @else {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Status</th>
                <th scope="col">Sending domain</th>
                <th scope="col">Reporting</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td class="fl-cell-name">
                    <div class="flex flex-col">
                      <span class="font-medium">{{ row.label }}</span>
                      @if (row.implicit) {
                        <span class="text-fl-caption text-fl-ink-muted">Already in use</span>
                      }
                    </div>
                  </td>
                  <td>
                    <fl-status
                      [tone]="row.isActive ? 'success' : 'neutral'"
                      [label]="row.isActive ? 'Sending' : 'Ready, not sending'"
                    />
                  </td>
                  <td class="fl-mono">{{ row.sendingDomain ?? '—' }}</td>
                  <td>
                    <fl-status
                      [tone]="reporting(row).tone"
                      [label]="reporting(row).label"
                      [attr.title]="blindSpot(row) || null"
                    />
                  </td>
                  <td class="is-fit">
                    <div class="fl-row flex-nowrap">
                      @if (!row.isActive) {
                        <button
                          appReadOnlySection="mail"
                          flButton
                          size="sm"
                          type="button"
                          [disabled]="switching() === row.id"
                          (click)="act('activate', row)"
                        >
                          {{ switching() === row.id ? 'Switching…' : 'Send through this one' }}
                        </button>
                      }
                      <fl-actions-menu
                        appReadOnlySection="mail"
                        [label]="'Actions for ' + row.label"
                        [compact]="true"
                        [items]="menus().get(row.id) ?? []"
                        (action)="onMenu($event, row)"
                      />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colspan="5" class="whitespace-normal">
                    <app-mail-connection-details
                      [connection]="row"
                      [verifiedDomains]="verifiedDomains()"
                      [retrying]="retrying() === row.id"
                      [testing]="testing() === row.id"
                      [adding]="adding() === row.id"
                      [newDomain]="newDomain()"
                      [registering]="registering()"
                      [added]="added()"
                      [addError]="addError()"
                      (retry)="act('retry', row)"
                      (domainChange)="domainChange.emit($event)"
                      (register)="act('register', row)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <ng-content />
    </fl-panel>
  `,
})
export class MailScopePanel {
  readonly slot = input.required<MailScopeSlot>();
  readonly rows = input.required<MailConnection[]>();
  readonly verifiedDomains = input<string[]>([]);
  readonly open = input(false);
  readonly connectLabel = input('Connect a provider');
  readonly switching = input<string | null>(null);
  readonly retrying = input<string | null>(null);
  readonly testing = input<string | null>(null);
  readonly adding = input<string | null>(null);
  readonly newDomain = input('');
  readonly registering = input(false);
  readonly added = input<string | null>(null);
  readonly addError = input<string | null>(null);

  readonly openConnect = output<void>();
  readonly domainChange = output<string>();
  readonly connectionAction = output<MailConnectionAction>();

  protected readonly menus = computed(
    () => new Map(this.rows().map((row) => [row.id, this.menuFor(row)])),
  );

  private menuFor(row: MailConnection): MenuAction[] {
    const items: MenuAction[] = [
      { id: 'test', label: this.testing() === row.id ? 'Close test' : 'Send a test' },
    ];
    if (!row.implicit) {
      items.push(
        { id: 'add-domain', label: this.adding() === row.id ? 'Close add domain' : 'Add domain' },
        { id: 'disconnect', label: 'Disconnect', danger: true, separatorBefore: true },
      );
    }
    return items;
  }

  protected onMenu(id: string, row: MailConnection): void {
    if (id === 'test' || id === 'add-domain' || id === 'disconnect') this.act(id, row);
  }

  protected act(action: MailConnectionAction['action'], connection: MailConnection): void {
    this.connectionAction.emit({ action, connection });
  }

  protected blindSpot(row: MailConnection): string {
    return blindSpotOf(row.provider);
  }

  protected reporting(row: MailConnection): { tone: StatusTone; label: string } {
    if (!row.webhookRegistered && pushes(row.provider)) {
      return { tone: 'error', label: 'Outcomes not reported' };
    }
    if (blindSpotOf(row.provider)) return { tone: 'warning', label: 'Limited reporting' };
    return { tone: 'success', label: 'Reporting' };
  }
}
