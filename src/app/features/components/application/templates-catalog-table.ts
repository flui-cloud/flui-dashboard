import { Component, input, output } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideGithub } from '@ng-icons/lucide';
import { TemplateResponseDto } from '../../../core/api/model/templateResponseDto';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { categoryLabel, templateCategory, templateRepoUrl } from './templates-catalog-rows';

@Component({
  selector: 'app-templates-catalog-table',
  imports: [FlTable, FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideGithub })],
  host: { class: 'fl-table-wrap' },
  template: `
    <table flTable density="dense">
      <thead>
        <tr>
          <th scope="col">Template</th>
          <th scope="col">Category</th>
          <th scope="col">Port</th>
          <th scope="col">Healthcheck</th>
          <th scope="col">Build tool</th>
          <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        @for (tpl of rows(); track tpl.framework) {
          <tr [class.is-selected]="highlighted() === tpl.framework">
            <td class="fl-cell-name is-wrap">
              <div class="flex flex-col gap-0.5">
                <span class="font-medium text-fl-ink">
                  {{ tpl.displayName }} <span class="fl-muted">{{ tpl.version }}</span>
                </span>
                <span class="line-clamp-2 text-fl-caption text-fl-ink-muted">
                  {{ tpl.description }}
                </span>
              </div>
            </td>
            <td>{{ label(tpl) }}</td>
            <td>
              <fl-tag>Port {{ tpl.port }}</fl-tag>
            </td>
            <td class="fl-mono">{{ tpl.healthcheckPath }}</td>
            <td>
              <fl-tag>{{ tpl.buildTool }}</fl-tag>
            </td>
            <td class="is-fit">
              <div class="flex items-center justify-end gap-1">
                <button
                  flButton
                  size="sm"
                  type="button"
                  [disabled]="!canUse()"
                  [attr.aria-label]="'Use ' + tpl.displayName + ' template'"
                  [title]="canUse() ? '' : disabledReason()"
                  (click)="useTemplate.emit(tpl)"
                >
                  Use template
                </button>
                <a
                  flButton="ghost"
                  size="sm"
                  [iconOnly]="true"
                  [href]="repoUrl(tpl)"
                  target="_blank"
                  rel="noopener"
                  [attr.aria-label]="'View ' + tpl.displayName + ' on GitHub'"
                  title="View on GitHub"
                >
                  <fl-icon name="lucideGithub" />
                </a>
              </div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TemplatesCatalogTable {
  readonly rows = input.required<readonly TemplateResponseDto[]>();
  readonly highlighted = input<string | null>(null);
  readonly canUse = input(true);
  readonly disabledReason = input('');
  readonly useTemplate = output<TemplateResponseDto>();

  protected label(tpl: TemplateResponseDto): string {
    return categoryLabel(templateCategory(tpl));
  }

  protected repoUrl(tpl: TemplateResponseDto): string {
    return templateRepoUrl(tpl);
  }
}
