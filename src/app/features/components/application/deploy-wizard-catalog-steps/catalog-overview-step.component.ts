import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideSearch, lucideX } from '@ng-icons/lucide';
import { DeployWizardStateService } from '../../../service/deploy-wizard-state.service';
import { CatalogService } from '../../../service/catalog.service';
import { SandboxService } from '../../../../core/services/sandbox.service';
import { CatalogResponseDto } from '../../../../core/api/model/models';
import { CatalogIconComponent } from '../../catalog/catalog-icon.component';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlEmptyState, FlLoadingState } from '../../../../ui/patterns/states';
import { FlTable } from '../../../../ui/patterns/table';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlSpinner } from '../../../../ui/primitives/spinner';

@Component({
  selector: 'app-catalog-overview-step',
  imports: [
    FormsModule,
    CatalogIconComponent,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlEmptyState,
    FlLoadingState,
    FlTable,
    FlButton,
    FlIcon,
    FlSpinner,
  ],
  providers: [provideIcons({ lucidePencil, lucideSearch, lucideX })],
  host: { class: 'flex flex-col gap-5' },
  template: `
    @if (catalog.detailLoading()) {
      <fl-loading-state [rows]="4" />
    } @else if (!detail()) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">Pick the app to install.</p>

      <label class="fl-input fl-input--lg">
        <fl-icon name="lucideSearch" />
        <span class="fl-sr">Search apps</span>
        <input type="search" placeholder="Search by name, category or tag" [(ngModel)]="query" />
        @if (query()) {
          <button
            flButton="ghost"
            size="sm"
            [iconOnly]="true"
            type="button"
            aria-label="Clear search"
            (click)="query.set('')"
          >
            <fl-icon name="lucideX" />
          </button>
        }
      </label>

      @if (catalog.listLoading()) {
        <fl-loading-state [rows]="4" />
      } @else if (catalog.listError()) {
        <fl-alert tone="error" title="Could not load the catalog">{{
          catalog.listError()
        }}</fl-alert>
      } @else if (results().length === 0) {
        <fl-empty-state [compact]="true" title="No apps match your search" />
      } @else {
        <div class="fl-table-wrap max-h-96 overflow-y-auto">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">App</th>
                <th scope="col">Category</th>
                <th scope="col">Version</th>
                <th scope="col" class="is-fit"><span class="fl-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (app of results(); track app.id) {
                <tr>
                  <td class="is-wrap">
                    <div class="flex items-start gap-3">
                      <app-catalog-icon
                        [slug]="app.slug"
                        [name]="app.name"
                        [iconUrl]="app.iconUrl"
                        size="sm"
                      />
                      <div class="flex min-w-0 flex-col gap-0.5">
                        <span class="font-medium">{{ app.name }}</span>
                        @if (app.description) {
                          <span class="line-clamp-2 text-fl-caption text-fl-ink-muted">{{
                            app.description
                          }}</span>
                        }
                        @if (app.alternativeTo.length) {
                          <span class="text-fl-caption text-fl-ink-muted"
                            >Alternative to {{ app.alternativeTo.slice(0, 2).join(', ') }}</span
                          >
                        }
                      </div>
                    </div>
                  </td>
                  <td class="capitalize">{{ app.category }}</td>
                  <td class="fl-mono">{{ app.version }}</td>
                  <td class="is-fit">
                    <button
                      flButton
                      size="sm"
                      type="button"
                      [disabled]="loadingSlug() === app.slug"
                      [attr.aria-label]="'Select ' + app.name"
                      (click)="selectApp(app)"
                    >
                      @if (loadingSlug() === app.slug) {
                        <fl-spinner label="Loading" />
                      }
                      Select
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      @let d = detail()!;
      <div class="flex items-start gap-3">
        <app-catalog-icon [slug]="d.slug" [name]="d.name" [iconUrl]="d.iconUrl" size="lg" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <h3 class="m-0 text-fl-section-title">{{ d.name }}</h3>
          @if (d.description) {
            <p class="m-0 text-fl-body-sm text-fl-ink-secondary">{{ d.description }}</p>
          }
        </div>
        <button flButton="ghost" size="sm" type="button" (click)="changeSelection()">
          <fl-icon name="lucidePencil" />
          Change
        </button>
      </div>

      <fl-key-value>
        <fl-kv-item key="Version" [mono]="true">{{ d.version }}</fl-kv-item>
        <fl-kv-item key="Category"
          ><span class="capitalize">{{ d.category }}</span></fl-kv-item
        >
        @if (d.license) {
          <fl-kv-item key="License">{{ d.license }}</fl-kv-item>
        }
        @if (d.appType !== 'building-block') {
          @if (d.exposure === 'internal') {
            <fl-kv-item key="Access">Internal, Flui sign-in required</fl-kv-item>
          } @else if (d.exposure === 'public') {
            <fl-kv-item key="Access">Public URL and DNS record</fl-kv-item>
          }
        }
        @if (d.persistenceScope === 'dedicated') {
          <fl-kv-item key="Placement">One node</fl-kv-item>
        }
      </fl-key-value>

      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        The next steps are pre-filled from the app manifest. Change only what you need.
      </p>

      @if (d.persistenceScope === 'dedicated') {
        <fl-alert tone="info" title="Pinned to one node">
          The app keeps its data on one node's disk, the master by default. Resizing that node
          briefly stops the app.
        </fl-alert>
      }

      <fl-field
        label="Display name"
        for="catalog-display-name"
        hint="Tells installs of the same app apart in the console."
      >
        <div class="fl-input fl-input--lg">
          <input
            id="catalog-display-name"
            type="text"
            [ngModel]="state.catalogDisplayName()"
            (ngModelChange)="state.catalogDisplayName.set($event)"
            placeholder="How this install appears in the console"
          />
        </div>
      </fl-field>
    }
  `,
})
export class CatalogOverviewStepComponent implements OnInit {
  protected readonly state = inject(DeployWizardStateService);
  protected readonly catalog = inject(CatalogService);
  private readonly sandbox = inject(SandboxService);

  protected readonly detail = computed(() => this.state.catalogDetail());
  protected readonly query = signal('');
  protected readonly loadingSlug = signal<string | null>(null);

  protected readonly results = computed<CatalogResponseDto[]>(() => {
    const q = this.query().trim().toLowerCase();
    const excluded = this.sandbox.catalogExcluded();
    const all = this.catalog.catalog().filter((app) => !excluded.has(app.slug));
    if (!q) return all;
    return all.filter((app) => {
      const haystack = [
        app.name,
        app.slug,
        app.category,
        app.description ?? '',
        ...(app.alternativeTo ?? []),
        ...(app.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  ngOnInit(): void {
    if (!this.detail() && this.catalog.catalog().length === 0) {
      this.catalog.loadCatalog();
    }
  }

  async selectApp(app: CatalogResponseDto): Promise<void> {
    this.loadingSlug.set(app.slug);
    try {
      const detail = await this.catalog.loadDetail(app.slug);
      if (detail) this.state.initializeFromCatalog(detail);
    } finally {
      this.loadingSlug.set(null);
    }
  }

  changeSelection(): void {
    this.catalog.resetDetail();
    this.state.catalogDetail.set(null);
    this.state.catalogSlug.set(null);
    this.state.catalogDisplayName.set('');
    this.state.userInputs.set({});
    this.state.envOverrides.set({});
  }
}
