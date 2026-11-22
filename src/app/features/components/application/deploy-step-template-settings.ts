import { Component, input, output } from '@angular/core';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlButton } from '../../../ui/primitives/button';

@Component({
  selector: 'app-deploy-step-template-settings',
  imports: [FlAlert, FlField, FlKeyValue, FlKvItem, FlButton],
  host: { class: 'fl-stack' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Flui creates a new GitHub repository from the
      <span class="font-medium text-fl-ink">{{ template()?.displayName }}</span> template in your
      account.
    </p>

    @if (!hasRepoScope()) {
      <fl-alert tone="warning" title="GitHub connection required">
        Connect GitHub with the <span class="fl-mono">repo</span> scope to create a repository.
        <button alertActions flButton size="sm" type="button" (click)="connectGithub.emit()">
          Connect GitHub
        </button>
      </fl-alert>
    }

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <fl-field
        label="Repository name"
        for="deploy-repo-name"
        [error]="nameError()"
        hint="Letters, digits, dots, hyphens and underscores."
      >
        <div class="fl-input fl-input--lg">
          <input
            id="deploy-repo-name"
            type="text"
            class="fl-mono"
            required
            placeholder="my-app"
            [value]="repoName()"
            (input)="repoNameChange.emit($any($event.target).value)"
          />
        </div>
      </fl-field>
      <fl-field
        label="Owner (optional)"
        for="deploy-repo-owner"
        hint="Defaults to your personal GitHub account."
      >
        <div class="fl-input fl-input--lg">
          <input
            id="deploy-repo-owner"
            type="text"
            class="fl-mono"
            placeholder="GitHub user or organization"
            [value]="repoOwner()"
            (input)="repoOwnerChange.emit($any($event.target).value)"
          />
        </div>
      </fl-field>
    </div>

    <fieldset class="fl-fieldset">
      <legend>Visibility</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="fl-radiocard">
          <input
            type="radio"
            name="deploy-repo-visibility"
            [checked]="isPrivate()"
            (change)="privateChange.emit(true)"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">Private</span>
            <span class="fl-radiocard__desc">Only you and the people you invite see it.</span>
          </span>
        </label>
        <label class="fl-radiocard">
          <input
            type="radio"
            name="deploy-repo-visibility"
            [checked]="!isPrivate()"
            (change)="privateChange.emit(false)"
          />
          <span class="fl-radiocard__text">
            <span class="fl-radiocard__title">Public</span>
            <span class="fl-radiocard__desc">Anyone on GitHub can see it.</span>
          </span>
        </label>
      </div>
    </fieldset>

    @if (template(); as tpl) {
      <section class="flex flex-col gap-3" aria-label="Runtime defaults">
        <h3 class="m-0 text-fl-body-sm font-semibold">Runtime defaults from this template</h3>
        <fl-key-value class="fl-kv--compact">
          <fl-kv-item key="Framework">{{ tpl.displayName }} {{ tpl.version }}</fl-kv-item>
          <fl-kv-item key="Port" [mono]="true">{{ tpl.port }}</fl-kv-item>
          <fl-kv-item key="Healthcheck" [mono]="true">{{ tpl.healthcheckPath }}</fl-kv-item>
          <fl-kv-item key="Build tool">{{ tpl.buildTool }}</fl-kv-item>
        </fl-key-value>
      </section>
    }
  `,
})
export class DeployStepTemplateSettings {
  readonly template = input<TemplateResponseDto | null>(null);
  readonly hasRepoScope = input(true);
  readonly repoName = input('');
  readonly repoOwner = input('');
  readonly isPrivate = input(true);
  readonly nameError = input<string | null>(null);
  readonly repoNameChange = output<string>();
  readonly repoOwnerChange = output<string>();
  readonly privateChange = output<boolean>();
  readonly connectGithub = output<void>();
}
