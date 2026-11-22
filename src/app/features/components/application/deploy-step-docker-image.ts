import { Component, input, output } from '@angular/core';
import { ApplicationKind } from '../../model/application.models';
import { FlButton } from '../../../ui/primitives/button';
import { FlStatus } from '../../../ui/primitives/status';
import { DockerImagePickerComponent } from './docker-image-picker.component';

export interface KindOption {
  readonly value: ApplicationKind;
  readonly label: string;
}

@Component({
  selector: 'app-deploy-step-docker-image',
  imports: [FlButton, FlStatus, DockerImagePickerComponent],
  host: { class: 'fl-stack' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Search Docker Hub for an image and select a tag.
    </p>
    @if (imageRef()) {
      <div
        class="flex flex-wrap items-center gap-3 rounded-fl-lg border border-fl-border bg-fl-surface-subtle px-4 py-3"
      >
        <fl-status tone="success" label="Selected" />
        <span class="fl-mono min-w-0 break-all">{{ imageRef() }}</span>
        <button flButton size="sm" type="button" class="ml-auto" (click)="clear.emit()">
          Change
        </button>
      </div>

      <fieldset class="fl-fieldset">
        <legend>Application kind</legend>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          Sets the menu group the app appears under. Suggested from the image name.
        </p>
        <div class="fl-segmented self-start" role="group" aria-label="Application kind">
          @for (opt of kindOptions(); track opt.value) {
            <button
              type="button"
              [attr.aria-pressed]="kind() === opt.value"
              (click)="kindChange.emit(opt.value)"
            >
              {{ opt.label }}
            </button>
          }
        </div>
      </fieldset>
    } @else {
      <app-docker-image-picker (imageSelected)="imageSelected.emit($event)" />
    }
  `,
})
export class DeployStepDockerImage {
  readonly imageRef = input('');
  readonly kind = input.required<ApplicationKind>();
  readonly kindOptions = input.required<readonly KindOption[]>();
  readonly imageSelected = output<string>();
  readonly clear = output<void>();
  readonly kindChange = output<ApplicationKind>();
}
