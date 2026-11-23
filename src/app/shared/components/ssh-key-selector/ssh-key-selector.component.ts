import { Component, OnInit, computed, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucideKey, lucidePlus } from '@ng-icons/lucide';
import { ProviderWizardService } from '../../services/provider-wizard.service';
import { SSHKeyDto } from '../../../core/api/model/models';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { FlStatus } from '../../../ui/primitives/status';

const ALL_PROVIDERS = [
  { id: 'hetzner', label: 'Hetzner' },
  { id: 'contabo', label: 'Contabo' },
  { id: 'scaleway', label: 'Scaleway' },
];

/**
 * SSH Key Selector Component
 *
 * Reusable component for selecting or creating SSH keys.
 * - List existing keys with provider availability badges
 * - Create new key with optional provider targeting
 * - Skip SSH key selection
 */
@Component({
  selector: 'app-ssh-key-selector',
  imports: [
    FormsModule,
    FlPanel,
    FlAlert,
    FlField,
    FlEmptyState,
    FlLoadingState,
    FlButton,
    FlIcon,
    FlSpinner,
    FlStatus,
  ],
  providers: [provideIcons({ lucideKey, lucidePlus })],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="SSH key (optional)">
      <div class="flex flex-col gap-4">
        <p class="text-fl-body-sm text-fl-ink-muted">
          Choose a key for secure access to your servers. You can skip this step and add one later.
        </p>

        @if (wizardService.isSshKeyLoading()) {
          <fl-loading-state [rows]="3" />
        } @else if (wizardService.sshKeyError()) {
          <fl-alert tone="error" title="Could not load the SSH keys">{{
            wizardService.sshKeyError()
          }}</fl-alert>
        } @else {
          <fieldset class="fl-fieldset">
            <legend class="fl-sr">SSH key</legend>
            <label class="fl-radiocard">
              <input
                type="radio"
                name="ssh-key-choice"
                [checked]="selectedKeyId() === undefined"
                (change)="selectKey(undefined)"
              />
              <span class="fl-radiocard__text">
                <span class="fl-radiocard__title">No SSH key</span>
                <span class="fl-radiocard__desc">Skip SSH key configuration</span>
              </span>
            </label>
            @for (key of wizardService.sshKeysData(); track key.id) {
              <label class="fl-radiocard">
                <input
                  type="radio"
                  name="ssh-key-choice"
                  [checked]="selectedKeyId() === key.id"
                  (change)="selectKey(key.id)"
                />
                <span class="fl-radiocard__text min-w-0">
                  <span class="fl-radiocard__title">{{ key.name }}</span>
                  <span class="fl-radiocard__desc">
                    <span class="fl-mono">{{ key.type }}</span> · {{ formatDate(key.createdAt) }}
                  </span>
                  <span class="fl-row">
                    @for (p of getProviderBadges(key); track p.id) {
                      <fl-status
                        [tone]="p.available ? 'success' : 'neutral'"
                        [label]="p.label"
                        [title]="p.available ? 'Synced' : 'Not synced'"
                      />
                    }
                  </span>
                </span>
              </label>
            }
          </fieldset>

          @if (wizardService.sshKeysData().length === 0) {
            <fl-empty-state
              icon="lucideKey"
              [compact]="true"
              title="No SSH keys yet"
              body="Create your first key below."
            />
          }

          <div class="flex flex-col gap-4 border-t border-fl-border pt-4">
            @if (!showCreateForm()) {
              <div>
                <button flButton type="button" (click)="showCreateForm.set(true)">
                  <fl-icon name="lucidePlus" />
                  Create SSH key
                </button>
              </div>
            } @else {
              <div class="fl-grid-2">
                <fl-field label="Key name" for="ssh-selector-name">
                  <div class="fl-input fl-input--lg">
                    <input
                      id="ssh-selector-name"
                      type="text"
                      placeholder="production-key"
                      autocomplete="off"
                      [ngModel]="newKeyName()"
                      (ngModelChange)="newKeyName.set($event)"
                    />
                  </div>
                </fl-field>
                <fl-field label="User name" for="ssh-selector-user">
                  <div class="fl-input fl-input--lg">
                    <input
                      id="ssh-selector-user"
                      type="text"
                      placeholder="admin"
                      autocomplete="off"
                      [ngModel]="newKeyUserName()"
                      (ngModelChange)="newKeyUserName.set($event)"
                    />
                  </div>
                </fl-field>
              </div>
              @if (createError()) {
                <fl-alert tone="error" title="Key not created">{{ createError() }}</fl-alert>
              }
              <div class="fl-row">
                <button
                  flButton
                  type="button"
                  [disabled]="!canCreate() || isCreating()"
                  (click)="createKey()"
                >
                  @if (isCreating()) {
                    <fl-spinner label="Creating" />
                    Creating…
                  } @else {
                    Create key
                  }
                </button>
                <button
                  flButton="ghost"
                  type="button"
                  [disabled]="isCreating()"
                  (click)="cancelCreate()"
                >
                  Cancel
                </button>
              </div>
            }
          </div>
        }
      </div>
    </fl-panel>
  `,
})
export class SshKeySelectorComponent implements OnInit {
  readonly wizardService = inject(ProviderWizardService);

  readonly selectedKeyId = input<string | undefined>(undefined);
  readonly keySelected = output<string | undefined>();

  readonly showCreateForm = signal<boolean>(false);
  readonly isCreating = signal<boolean>(false);
  readonly createError = signal<string | null>(null);
  readonly newKeyName = signal('');
  readonly newKeyUserName = signal('');

  protected readonly canCreate = computed(
    () => this.newKeyName().trim().length > 0 && this.newKeyUserName().trim().length > 0,
  );

  ngOnInit(): void {
    void (async () => {
      try {
        await this.wizardService.loadSshKeys();
      } catch (error) {
        console.error('Failed to load SSH key data:', error);
      }
    })();
  }

  selectKey(keyId: string | undefined): void {
    this.keySelected.emit(keyId);
  }

  /**
   * Returns badges for all known providers indicating availability on each.
   * Green = key is synced there, grey = not synced.
   */
  getProviderBadges(key: SSHKeyDto): { id: string; label: string; available: boolean }[] {
    const mappings = key.providerKeyMappings as Record<string, string> | undefined;
    return ALL_PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      available: !!mappings?.[p.id],
    }));
  }

  async createKey(): Promise<void> {
    if (!this.canCreateKey()) return;
    this.isCreating.set(true);
    this.createError.set(null);
    try {
      const newKey = await this.wizardService.createSshKey(
        this.newKeyName(),
        this.newKeyUserName(),
      );
      this.newKeyName.set('');
      this.newKeyUserName.set('');
      this.showCreateForm.set(false);
      this.selectKey(newKey.id);
    } catch (error: unknown) {
      console.error('Failed to create SSH key:', error);
      const message = (error as { message?: string } | null)?.message;
      this.createError.set(message || 'Failed to create SSH key. Please try again.');
    } finally {
      this.isCreating.set(false);
    }
  }

  cancelCreate(): void {
    this.newKeyName.set('');
    this.newKeyUserName.set('');
    this.showCreateForm.set(false);
    this.createError.set(null);
  }

  canCreateKey(): boolean {
    return this.canCreate();
  }

  formatDate(date: string | undefined): string {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-GB');
  }
}
