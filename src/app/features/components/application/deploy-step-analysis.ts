import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideDownload } from '@ng-icons/lucide';
import { ApplicationManifest, RepositoryManifestEntry } from '../../service/repository.service';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { DeployStepNoManifest } from './deploy-step-no-manifest';

export type AnalysisBranch =
  'loading' | 'flui-ready' | 'manifest-invalid' | 'no-manifest' | 'check-failed';

@Component({
  selector: 'app-deploy-step-analysis',
  imports: [
    FlAlert,
    FlKeyValue,
    FlKvItem,
    FlTable,
    FlButton,
    FlIcon,
    FlStatus,
    DeployStepNoManifest,
  ],
  providers: [provideIcons({ lucideDownload })],
  host: { class: 'fl-stack' },
  template: `
    @switch (state()) {
      @case ('loading') {
        <fl-status tone="progress" label="Looking for flui.yaml" />
      }
      @case ('flui-ready') {
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            @if (valid().length > 1) {
              <fl-status tone="success" [label]="valid().length + ' deployable apps found'" />
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                This monorepo has one <span class="fl-mono">flui.yaml</span> per app. Pick the one
                to deploy. Each app deploys on its own: run the wizard again for the others.
              </p>
            } @else {
              <fl-status tone="success" label="flui.yaml found" />
              <p class="m-0 text-fl-body-sm text-fl-ink-muted">
                Port, healthcheck and resources come from the manifest, and the repository is built
                as it is, like <span class="fl-mono">flui deploy</span>.
              </p>
            }
          </div>
          <button flButton size="sm" type="button" (click)="download.emit()">
            <fl-icon name="lucideDownload" />
            Download
          </button>
        </div>

        @if (valid().length > 1) {
          <div class="fl-table-wrap rounded-fl-lg border border-fl-border">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col" class="is-fit"><span class="fl-sr">Selected</span></th>
                  <th scope="col">App</th>
                  <th scope="col">Path</th>
                  <th scope="col" class="is-num">Port</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of valid(); track entry.path) {
                  <tr
                    class="cursor-pointer"
                    [class.is-selected]="selectedPath() === entry.path"
                    (click)="manifestSelect.emit(entry.path)"
                  >
                    <td class="is-fit">
                      <input
                        type="radio"
                        name="deploy-manifest"
                        [checked]="selectedPath() === entry.path"
                        [attr.aria-label]="'Deploy ' + entry.name"
                      />
                    </td>
                    <td class="fl-mono">{{ entry.name }}</td>
                    <td class="fl-mono fl-muted">{{ entry.path }}</td>
                    <td class="is-num fl-mono">{{ entry.port }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (manifest(); as m) {
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="App name" [mono]="true">{{ m.metadata.name }}</fl-kv-item>
            <fl-kv-item key="Port" [mono]="true">{{ m.deploy.port }}</fl-kv-item>
            @if (m.deploy.healthcheck?.path) {
              <fl-kv-item key="Healthcheck" [mono]="true">{{
                m.deploy.healthcheck!.path
              }}</fl-kv-item>
            }
            @if (m.deploy.env?.length) {
              <fl-kv-item key="Variables">{{ m.deploy.env!.length }} declared</fl-kv-item>
            }
          </fl-key-value>
        }

        @if (invalid().length > 0) {
          <fl-alert tone="warning" title="Some manifests were skipped">
            Not a valid kind: Application:
            @for (bad of invalid(); track bad.path) {
              <span class="fl-mono">{{ bad.path }}</span>{{ !$last ? ', ' : '' }}
            }
          </fl-alert>
        }
      }
      @case ('manifest-invalid') {
        <fl-alert tone="error" title="Invalid flui.yaml">
          <span class="block">
            Branch <span class="fl-mono">{{ branch() }}</span>
            {{
              invalid().length === 1
                ? 'has a flui.yaml, but it is not a valid'
                : 'has flui.yaml manifests, but none is a valid'
            }}
            <span class="fl-mono">kind: Application</span> manifest. Fix it, push, then retry.
          </span>
          @for (bad of invalid(); track bad.path) {
            <span class="mt-2 block fl-mono">{{ bad.path }}: {{ bad.validationError }}</span>
          }
          <ng-container alertActions>
            <button flButton size="sm" type="button" (click)="retry.emit()">Retry</button>
            <a flButton="ghost" size="sm" [href]="docs" target="_blank" rel="noopener"
              >Manifest reference</a
            >
          </ng-container>
        </fl-alert>
      }
      @case ('no-manifest') {
        <app-deploy-step-no-manifest
          [branch]="branch()"
          [repoId]="repoId()"
          [prompt]="agentPrompt()"
          [copied]="promptCopied()"
          (retry)="retry.emit()"
          (copyPrompt)="copyPrompt.emit()"
        />
      }
      @case ('check-failed') {
        <fl-alert tone="warning" title="Could not read flui.yaml">
          {{ fetchError() }}
          <button alertActions flButton size="sm" type="button" (click)="retry.emit()">
            Retry
          </button>
        </fl-alert>
      }
    }
  `,
})
export class DeployStepAnalysis {
  readonly state = input.required<AnalysisBranch>();
  readonly manifest = input<ApplicationManifest | undefined>(undefined);
  readonly valid = input<readonly RepositoryManifestEntry[]>([]);
  readonly invalid = input<readonly RepositoryManifestEntry[]>([]);
  readonly selectedPath = input<string | null>(null);
  readonly branch = input('');
  readonly repoId = input<string | null>(null);
  readonly fetchError = input<string | null>(null);
  readonly agentPrompt = input('');
  readonly promptCopied = input(false);
  readonly download = output<void>();
  readonly manifestSelect = output<string>();
  readonly retry = output<void>();
  readonly copyPrompt = output<void>();
  protected readonly docs = 'https://docs.flui.cloud/cli/deploy/';
}
