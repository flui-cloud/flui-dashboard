import { Component, computed, input } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideExternalLink } from '@ng-icons/lucide';
import { CatalogDetailResponseDto, CatalogResourcesDto } from '../../../core/api/model/models';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlTag } from '../../../ui/primitives/tag';
import { CatalogLinks, categoryLabel, linksOf, ratingRows } from './catalog-view';

@Component({
  selector: 'app-catalog-detail-overview',
  imports: [FlPanel, FlKeyValue, FlKvItem, FlEmptyState, FlTable, FlIcon, FlTag],
  providers: [provideIcons({ lucideExternalLink })],
  host: { class: 'fl-stack' },
  template: `
    @let a = app();
    <fl-panel title="About">
      <div class="flex flex-col gap-5">
        @if (a.description) {
          <p class="m-0 max-w-3xl whitespace-pre-line text-fl-body-sm">{{ a.description }}</p>
        } @else {
          <p class="m-0 text-fl-body-sm text-fl-ink-muted">No description provided.</p>
        }
        <fl-key-value>
          <fl-kv-item key="Version" [mono]="true">{{ a.version }}</fl-kv-item>
          <fl-kv-item key="Category"
            ><span>{{ categoryLabel(a.category) }}</span></fl-kv-item
          >
          @if (a.license) {
            <fl-kv-item key="License">{{ a.license }}</fl-kv-item>
          }
          @if (a.appType !== 'building-block') {
            @if (a.exposure === 'internal') {
              <fl-kv-item key="Access">Internal, Flui sign-in required</fl-kv-item>
            } @else if (a.exposure === 'public') {
              <fl-kv-item key="Access">Public URL and DNS record</fl-kv-item>
            }
          }
          @if (a.alternativeTo.length) {
            <fl-kv-item key="Alternative to">{{ a.alternativeTo.join(', ') }}</fl-kv-item>
          }
          @for (r of ratings(); track r.key) {
            <fl-kv-item [key]="r.label">{{ r.value }}/5</fl-kv-item>
          }
          @for (l of linkItems(); track l.key) {
            <fl-kv-item [key]="l.label">
              <a
                class="fl-link inline-flex items-center gap-1"
                [href]="l.href"
                target="_blank"
                rel="noopener noreferrer"
                >{{ l.text }} <fl-icon name="lucideExternalLink" [size]="13"
              /></a>
            </fl-kv-item>
          }
        </fl-key-value>
        @if (a.tags.length) {
          <div class="flex flex-wrap gap-1" role="group" aria-label="Tags">
            @for (tag of a.tags; track tag) {
              <fl-tag>{{ tag }}</fl-tag>
            }
          </div>
        }
      </div>
    </fl-panel>

    <div class="fl-grid-2">
      <fl-panel title="Requirements" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Resource</th>
                <th scope="col" class="is-num">Request</th>
                <th scope="col" class="is-num">Limit</th>
              </tr>
            </thead>
            <tbody>
              @for (r of requirements(); track r.label) {
                <tr>
                  <td>{{ r.label }}</td>
                  <td class="is-num fl-mono">{{ r.request ?? '—' }}</td>
                  <td class="is-num fl-mono">{{ r.limit ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>

      <fl-panel title="Dependencies" [count]="a.dependencies.length" [flush]="true">
        @if (a.dependencies.length === 0) {
          <fl-empty-state
            [compact]="true"
            title="No dependencies"
            body="This app runs on its own."
          />
        } @else {
          <div class="fl-table-wrap">
            <table flTable density="dense">
              <thead>
                <tr>
                  <th scope="col">App</th>
                  <th scope="col">Alias</th>
                  <th scope="col">Required</th>
                  <th scope="col">Reuse existing</th>
                </tr>
              </thead>
              <tbody>
                @for (dep of a.dependencies; track dep.as) {
                  <tr>
                    <td class="fl-mono">{{ dep.ref }}</td>
                    <td class="fl-mono">{{ dep.as }}</td>
                    <td>{{ dep.required ? 'Yes' : 'No' }}</td>
                    <td>{{ dep.reuseExisting ? 'Allowed' : 'No' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </fl-panel>
    </div>
  `,
})
export class CatalogDetailOverview {
  protected readonly categoryLabel = categoryLabel;
  readonly app = input.required<CatalogDetailResponseDto>();

  protected readonly ratings = computed(() => ratingRows(this.app().ratings));

  protected readonly requirements = computed(() => {
    const a = this.app();
    const res: Partial<CatalogResourcesDto> = a.resources ?? {};
    return [
      { label: 'CPU', request: res.requests?.cpu, limit: res.limits?.cpu },
      { label: 'Memory', request: res.requests?.memory, limit: res.limits?.memory },
      { label: 'Replicas', request: a.replicas?.toString(), limit: undefined },
    ];
  });

  protected readonly linkItems = computed(() => {
    const links: CatalogLinks = linksOf(this.app().links);
    const items: { key: string; label: string; text: string; href: string }[] = [];
    if (links.website)
      items.push({ key: 'website', label: 'Website', text: 'Website', href: links.website });
    if (links.docs)
      items.push({ key: 'docs', label: 'Docs', text: 'Documentation', href: links.docs });
    if (links.source)
      items.push({ key: 'source', label: 'Source', text: 'Source code', href: links.source });
    return items;
  });
}
