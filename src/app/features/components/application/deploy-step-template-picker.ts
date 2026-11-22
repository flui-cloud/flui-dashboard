import { Component, input, output } from '@angular/core';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { FlEmptyState, FlLoadingState } from '../../../ui/patterns/states';
import { FlTag } from '../../../ui/primitives/tag';

@Component({
  selector: 'app-deploy-step-template-picker',
  imports: [FlEmptyState, FlLoadingState, FlTag],
  host: { class: 'fl-stack' },
  template: `
    <p class="m-0 text-fl-body-sm text-fl-ink-muted">
      Each template ships a Flui-managed Dockerfile with port, healthcheck and resources already
      set.
    </p>
    @if (loading()) {
      <fl-loading-state [rows]="4" />
    } @else if (templates().length === 0) {
      <fl-empty-state [compact]="true" title="No templates available" />
    } @else {
      <fieldset class="fl-fieldset">
        <legend class="fl-sr">Template</legend>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          @for (tpl of templates(); track tpl.framework) {
            <label class="fl-radiocard">
              <input
                type="radio"
                name="deploy-template"
                [checked]="selected() === tpl.framework"
                (click)="templateSelect.emit(tpl)"
              />
              <span class="fl-radiocard__text min-w-0">
                <span class="fl-radiocard__title">
                  {{ tpl.displayName }} <span class="fl-muted">{{ tpl.version }}</span>
                </span>
                <span class="fl-radiocard__desc line-clamp-2">{{ tpl.description }}</span>
                <span class="fl-row mt-1">
                  <fl-tag>Port {{ tpl.port }}</fl-tag>
                  <fl-tag class="fl-mono">{{ tpl.healthcheckPath }}</fl-tag>
                  <fl-tag>{{ tpl.buildTool }}</fl-tag>
                </span>
              </span>
            </label>
          }
        </div>
      </fieldset>
    }
  `,
})
export class DeployStepTemplatePicker {
  readonly templates = input.required<readonly TemplateResponseDto[]>();
  readonly loading = input(false);
  readonly selected = input<string | null>(null);
  readonly templateSelect = output<TemplateResponseDto>();
}
