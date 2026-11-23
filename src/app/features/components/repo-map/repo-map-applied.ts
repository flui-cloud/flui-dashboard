import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideGitBranch,
  lucideGitCommitHorizontal,
} from '@ng-icons/lucide';
import { FlAlert } from '../../../ui/patterns/alert';
import { FlTable } from '../../../ui/patterns/table';
import { FlButton } from '../../../ui/primitives/button';
import { FlIcon } from '../../../ui/primitives/icon';
import { FlStatus } from '../../../ui/primitives/status';
import { AppliedUnit, RepoApplyResult } from '../../service/repo-map.service';
import { shortSha, unitName } from './repo-map-view';

@Component({
  selector: 'app-repo-map-applied',
  imports: [RouterLink, FlAlert, FlTable, FlButton, FlIcon, FlStatus],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideGitBranch,
      lucideGitCommitHorizontal,
    }),
  ],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @let done = result();
    <fl-status
      role="status"
      [tone]="done.partial ? 'warning' : 'success'"
      [label]="done.partial ? 'Applied, but not everything was armed' : 'Applied'"
    />

    @if (unmarked().length > 0) {
      @let one = unmarked().length === 1;
      <fl-alert
        tone="error"
        [title]="
          unmarked().length + ' application' + (one ? '' : 's') + ' could not be marked for reuse.'
        "
      >
        <span class="block">
          The next apply of this repository will not recognise {{ one ? 'it' : 'them' }} and will
          create a second application beside {{ one ? 'it' : 'each of them' }}, with a second
          database if this one attached any. Remove {{ one ? 'it' : 'them' }} by hand first.
        </span>
        <ul class="m-0 mt-1 flex flex-col gap-1 p-0">
          @for (u of unmarked(); track u.unitId) {
            <li class="fl-row">
              <a class="fl-link" [routerLink]="['/apps/applications', u.applicationId]">{{
                u.name
              }}</a>
              <span class="fl-mono text-fl-ink-muted">{{ u.slug }}</span>
            </li>
          }
        </ul>
      </fl-alert>
    }

    <p class="fl-row m-0 text-fl-body-sm">
      <fl-icon class="text-fl-ink-muted" name="lucideGitBranch" [size]="14" />
      <a class="fl-link fl-mono" [href]="done.branchUrl" target="_blank" rel="noopener">{{
        done.branch
      }}</a>
      <fl-icon class="text-fl-ink-muted" name="lucideGitCommitHorizontal" [size]="14" />
      <a class="fl-link fl-mono" [href]="done.commitUrl" target="_blank" rel="noopener">{{
        sha(done.commitSha)
      }}</a>
      <span class="text-fl-ink-muted"
        >cut from {{ done.baseBranch }}, which was not written to.</span
      >
    </p>

    @if (done.units.length > 0) {
      <div class="fl-table-wrap rounded-fl-md border border-fl-border">
        <table flTable density="dense">
          <thead>
            <tr>
              <th scope="col">Application</th>
              <th scope="col">Slug</th>
              <th scope="col">State</th>
              <th scope="col" class="is-fit">Run</th>
            </tr>
          </thead>
          <tbody>
            @for (u of done.units; track u.unitId) {
              <tr>
                <td>
                  <a class="fl-link" [routerLink]="['/apps/applications', u.applicationId]">{{
                    u.name
                  }}</a>
                </td>
                <td class="fl-mono">{{ u.slug }}</td>
                <td class="is-wrap">
                  <span class="flex flex-col gap-0.5">
                    <fl-status
                      [tone]="u.armed ? 'progress' : 'warning'"
                      [label]="u.armed ? 'building' : 'not armed'"
                    />
                    @if (!u.armed && u.reason) {
                      <span class="text-fl-ink-secondary">{{ u.reason }}</span>
                    }
                  </span>
                </td>
                <td class="is-fit">
                  @if (u.workflowRunUrl) {
                    <a class="fl-link" [href]="u.workflowRunUrl" target="_blank" rel="noopener"
                      >Build run</a
                    >
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (done.skipped.length > 0) {
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Nothing was committed for
        @for (s of done.skipped; track s.unitId) {
          <span class="fl-mono">{{ name(s.unitId) }}</span>{{ $last ? ': ' : ', ' }}
        }
        {{ done.skipped[0].reason }}
      </p>
    }

    <div>
      <button
        flButton="ghost"
        size="sm"
        type="button"
        [attr.aria-expanded]="filesExpanded()"
        (click)="toggleFiles.emit()"
      >
        <fl-icon [name]="filesExpanded() ? 'lucideChevronDown' : 'lucideChevronRight'" />
        {{ done.files.length }} file{{ done.files.length === 1 ? '' : 's' }} written
      </button>
    </div>
    @if (filesExpanded()) {
      <ul class="m-0 flex flex-col gap-0.5 p-0">
        @for (f of done.files; track f) {
          <li class="fl-mono text-fl-ink-secondary">{{ f }}</li>
        }
      </ul>
    }
  `,
})
export class RepoMapApplied {
  readonly result = input.required<RepoApplyResult>();
  readonly unmarked = input<readonly AppliedUnit[]>([]);
  readonly filesExpanded = input(false);
  readonly toggleFiles = output<void>();

  protected sha(value: string): string {
    return shortSha(value);
  }

  protected name(id: string): string {
    return unitName(id);
  }
}
