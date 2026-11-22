import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';

const MANIFEST_DOCS = 'https://docs.flui.cloud/cli/deploy/';

@Component({
  selector: 'app-deploy-step-no-manifest',
  imports: [RouterLink, FlAlert, FlButton, FlIcon],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
  host: { class: 'fl-stack' },
  template: `
    <fl-alert tone="warning" title="No flui.yaml found">
      Flui deploys repositories from a <span class="fl-mono">flui.yaml</span> manifest. Branch
      <span class="fl-mono">{{ branch() }}</span> has none, at the root or in a subdirectory.
      <ng-container alertActions>
        <button flButton size="sm" type="button" (click)="retry.emit()">Retry</button>
        <a flButton="ghost" size="sm" [href]="docs" target="_blank" rel="noopener">Read the docs</a>
      </ng-container>
    </fl-alert>

    @if (repoId(); as id) {
      <section class="flex flex-col gap-2" aria-label="Readiness map">
        <h3 class="m-0 text-fl-body-sm font-semibold">Let Flui read the repository</h3>
        <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
          Flui reads branch <span class="fl-mono">{{ branch() }}</span> and proposes a flui.yaml,
          with what it found, what it is unsure of, and why. It does not write to the repository or
          deploy anything. Applying the proposal is a separate step.
        </p>
        <div>
          <a
            flButton
            size="sm"
            [routerLink]="['/apps/repositories', id, 'map']"
            [queryParams]="{ branch: branch() }"
            >View readiness map</a
          >
        </div>
      </section>
    }

    <section class="flex flex-col gap-2" aria-label="Agent prompt">
      <h3 class="m-0 text-fl-body-sm font-semibold">Or let your coding agent write it</h3>
      <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
        Nothing to install and no sign-in. Paste this into the agent in your editor.
      </p>
      <pre
        class="fl-mono m-0 whitespace-pre-wrap rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
        >{{ prompt() }}</pre>
      <div>
        <button flButton size="sm" type="button" (click)="copyPrompt.emit()">
          <fl-icon [name]="copied() ? 'lucideCheck' : 'lucideCopy'" />
          {{ copied() ? 'Copied' : 'Copy prompt' }}
        </button>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-label="Command line">
      <h3 class="m-0 text-fl-body-sm font-semibold">Or scaffold it with the CLI</h3>
      <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
        <span class="fl-mono">flui app init &lt;framework&gt;</span> adds a flui.yaml and a
        production-ready Dockerfile. <span class="fl-mono">--list</span> shows the frameworks, and
        in a monorepo <span class="fl-mono">--target ./&lt;dir&gt;</span> runs it once per app. Sign
        the CLI in first with <span class="fl-mono">flui auth login</span>.
      </p>
    </section>

    <section class="flex flex-col gap-2" aria-label="Manual">
      <h3 class="m-0 text-fl-body-sm font-semibold">Or write it yourself</h3>
      <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
        See the
        <a class="fl-link" [href]="docs" target="_blank" rel="noopener">manifest reference</a>. Then
        commit, push to <span class="fl-mono">{{ branch() }}</span> and retry here.
      </p>
    </section>
  `,
})
export class DeployStepNoManifest {
  readonly branch = input('');
  readonly repoId = input<string | null>(null);
  readonly prompt = input('');
  readonly copied = input(false);
  readonly retry = output<void>();
  readonly copyPrompt = output<void>();
  protected readonly docs = MANIFEST_DOCS;
}
