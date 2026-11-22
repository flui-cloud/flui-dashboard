import { Clipboard } from '@angular/cdk/clipboard';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCopy,
  lucideRocket,
} from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlSpinner } from '../../../ui/primitives/spinner';
import { RenderedUnitDto } from '../../../core/api/model/renderedUnitDto';
import { RepositoryMapResponseDto } from '../../../core/api/model/repositoryMapResponseDto';
import { AppliedUnit, ApplyRefusal, RepoApplyResult } from '../../service/repo-map.service';
import { RepoMapApplied } from './repo-map-applied';
import { shortSha, unitName } from './repo-map-view';

@Component({
  selector: 'app-repo-map-apply',
  imports: [RouterLink, FlAlert, FlPanel, FlButton, FlIcon, FlSpinner, RepoMapApplied],
  providers: [
    provideIcons({ lucideCheck, lucideChevronDown, lucideChevronRight, lucideCopy, lucideRocket }),
  ],
  template: `
    @let r = result();
    <fl-panel>
      <div class="flex flex-col gap-3">
        @if (applied(); as done) {
          <app-repo-map-applied
            [result]="done"
            [unmarked]="unmarked()"
            [filesExpanded]="isOpen('files')"
            (toggleFiles)="toggled.emit('files')"
          />
        } @else {
          <p class="m-0 text-fl-body-sm">
            This writes a branch and a commit to your repository, and builds on your Actions
            minutes.
          </p>
          <div>
            <button flButton="ghost" size="sm" type="button" (click)="toggled.emit('apply-detail')">
              <fl-icon
                [name]="isOpen('apply-detail') ? 'lucideChevronDown' : 'lucideChevronRight'"
              />
              Details
            </button>
          </div>
          @if (isOpen('apply-detail')) {
            <div class="flex flex-col gap-1.5 text-fl-body-sm text-fl-ink-secondary">
              <p class="m-0">
                Flui cuts
                <span class="fl-mono">flui/deploy-{{ sha(r.read.commitSha || '') }}</span>
                from <span class="fl-mono">{{ r.branch }}</span> and puts one commit on it with the
                flui.yaml below and one workflow per unit. Your own branch is only read.
              </p>
              <p class="m-0">
                Each unit then builds on GitHub Actions and deploys:
                {{ renderedUnits().length }} build{{ renderedUnits().length === 1 ? '' : 's' }}, on
                your minutes.
              </p>
              <p class="m-0">
                It also creates {{ renderedUnits().length }} application{{
                  renderedUnits().length === 1 ? '' : 's'
                }}
                in Flui. If the apply fails halfway they stay: Flui never removes an application on
                its own, and it tells you which ones are there.
              </p>
              @if (serviceCount() > 0) {
                <p class="m-0">
                  The {{ serviceCount() }} service{{ serviceCount() === 1 ? '' : 's' }} this
                  repository declares {{ serviceCount() === 1 ? 'is' : 'are' }} installed from the
                  catalog before anything is committed, and stay if the apply fails.
                </p>
              }
            </div>
          }

          <span class="block" [title]="blockedReason()">
            <button
              flButton="primary"
              type="button"
              (click)="apply.emit()"
              [disabled]="disabled()"
              [attr.aria-disabled]="disabled()"
              [attr.aria-label]="blockedReason() || null"
            >
              @if (applying()) {
                <fl-spinner label="Applying" />
              } @else {
                <fl-icon name="lucideRocket" />
              }
              {{ applying() ? 'Applying…' : 'Deploy from this map' }}
            </button>
          </span>

          @if (!applying() && blockedReason(); as why) {
            <p class="m-0 max-w-prose text-fl-body-sm text-fl-ink-secondary">{{ why }}</p>
          }

          @if (applying()) {
            <p class="m-0 text-fl-body-sm text-fl-ink-secondary">
              Cutting the branch, committing the manifests, and installing the services they
              declare. This can take a few minutes, so leave the page open.
            </p>
          }
        }

        @if (refusal(); as refused) {
          @if (refused.stranded; as left) {
            <fl-alert tone="error" title="The apply failed and left something behind">
              <span class="block whitespace-pre-wrap">{{ refused.message }}</span>
              @if (left.applications.length > 0) {
                <ul class="m-0 mt-1 flex flex-col gap-1 p-0">
                  @for (a of left.applications; track a.applicationId) {
                    <li class="fl-row">
                      <a class="fl-link" [routerLink]="['/apps/applications', a.applicationId]">{{
                        a.name
                      }}</a>
                      <span class="fl-mono text-fl-ink-muted">{{ a.slug }}</span>
                      @if (a.attachedServices.length > 0) {
                        <span class="text-fl-ink-muted">
                          with {{ a.attachedServices.join(', ') }}
                        </span>
                      }
                    </li>
                  }
                </ul>
              }
            </fl-alert>
          } @else {
            <fl-alert tone="error" title="The apply was refused">
              <span class="whitespace-pre-wrap">{{ refused.message }}</span>
            </fl-alert>
          }
        }

        <div class="fl-row">
          @if (renderedUnits().length > 0) {
            <button flButton="ghost" size="sm" type="button" (click)="toggled.emit('yaml')">
              <fl-icon [name]="isOpen('yaml') ? 'lucideChevronDown' : 'lucideChevronRight'" />
              flui.yaml
            </button>
          }
          <button flButton="ghost" size="sm" type="button" (click)="toggled.emit('raw')">
            <fl-icon [name]="isOpen('raw') ? 'lucideChevronDown' : 'lucideChevronRight'" />
            Raw map
            @if (caveatCount() > 0) {
              <span class="text-fl-ink-muted"
                >({{ caveatCount() }} note{{ caveatCount() === 1 ? '' : 's' }})</span
              >
            }
          </button>
        </div>

        @if (isOpen('yaml')) {
          @for (ru of renderedUnits(); track ru.unitId) {
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <span class="fl-mono text-fl-ink-muted">{{ name(ru.unitId) }}</span>
                <button
                  flButton="ghost"
                  size="sm"
                  type="button"
                  [iconOnly]="true"
                  [attr.aria-label]="
                    copied() === ru.unitId ? 'Copied' : 'Copy flui.yaml for ' + name(ru.unitId)
                  "
                  (click)="copy(ru)"
                >
                  <fl-icon [name]="copied() === ru.unitId ? 'lucideCheck' : 'lucideCopy'" />
                </button>
              </div>
              <pre
                class="fl-mono m-0 overflow-x-auto rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
                >{{ ru.yaml }}</pre>
            </div>
          }
        }
        @if (isOpen('raw')) {
          <pre
            class="fl-mono m-0 max-h-96 overflow-auto rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3 text-fl-ink"
            >{{ rawJson() }}</pre>
        }
      </div>
    </fl-panel>
  `,
})
export class RepoMapApply {
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  readonly result = input.required<RepositoryMapResponseDto>();
  readonly renderedUnits = input<readonly RenderedUnitDto[]>([]);
  readonly applied = input<RepoApplyResult | null>(null);
  readonly unmarked = input<readonly AppliedUnit[]>([]);
  readonly refusal = input<ApplyRefusal | null>(null);
  readonly applying = input(false);
  readonly disabled = input(false);
  readonly blockedReason = input('');
  readonly expanded = input<ReadonlySet<string>>(new Set());
  readonly apply = output<void>();
  readonly toggled = output<string>();

  protected readonly copied = signal<string | null>(null);
  protected readonly rawJson = computed(() => JSON.stringify(this.result(), null, 2));
  protected readonly serviceCount = computed(() => this.result().map?.services.length ?? 0);
  protected readonly caveatCount = computed(() => this.result().map?.caveats.length ?? 0);

  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected isOpen(key: string): boolean {
    return this.expanded().has(key);
  }

  protected copy(unit: RenderedUnitDto): void {
    if (!this.clipboard.copy(unit.yaml)) return;
    clearTimeout(this.copiedTimer);
    this.copied.set(unit.unitId);
    this.copiedTimer = setTimeout(() => this.copied.set(null), 1500);
  }

  protected sha(value: string): string {
    return shortSha(value);
  }

  protected name(id: string): string {
    return unitName(id);
  }
}
