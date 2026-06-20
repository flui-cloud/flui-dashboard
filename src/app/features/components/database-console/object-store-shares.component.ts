import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCopy,
  lucideLink,
  lucideX,
} from '@ng-icons/lucide';
import { ShareRecord } from '../../model/object-store-console.models';
import { ObjectStoreConsoleStateService } from './object-store-console-state.service';

@Component({
  selector: 'app-object-store-shares',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, DatePipe],
  providers: [
    provideIcons({
      lucideCheck,
      lucideChevronDown,
      lucideChevronRight,
      lucideCopy,
      lucideLink,
      lucideX,
    }),
  ],
  template: `
    <div class="mt-5">
      <button
        type="button"
        (click)="s.toggleShares()"
        class="flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <ng-icon
          [name]="s.showShares() ? 'lucideChevronDown' : 'lucideChevronRight'"
          class="h-4 w-4 text-muted-foreground"
        />
        <ng-icon name="lucideLink" class="h-4 w-4 text-muted-foreground" />
        Shared links
        @if (s.shares().length) {
          <span class="font-normal text-muted-foreground"
            >({{ s.shares().length }})</span
          >
        }
      </button>

      @if (s.showShares()) {
        @if (s.shares().length === 0) {
          <p class="mt-2 text-xs text-muted-foreground">
            No share links yet. Use the share action on a file to create one.
          </p>
        } @else {
          <div class="mt-2 overflow-x-auto rounded-md border border-border">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 font-medium">Object</th>
                  <th class="w-24 px-3 py-2 font-medium">Status</th>
                  <th class="w-40 px-3 py-2 font-medium">Expires</th>
                  <th class="w-40 px-3 py-2 font-medium">Last accessed</th>
                  <th class="w-20 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                @for (rec of s.shares(); track rec.id) {
                  <tr class="border-t border-border">
                    <td class="px-3 py-2">
                      <div
                        class="max-w-[280px] truncate font-mono text-xs text-foreground"
                        [title]="rec.key"
                      >
                        {{ rec.key }}
                      </div>
                      <div class="text-[10px] text-muted-foreground">
                        {{ rec.bucket }}
                      </div>
                    </td>
                    <td class="px-3 py-2">
                      <span
                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
                        [class.bg-emerald-100]="rec.status === 'active'"
                        [class.text-emerald-700]="rec.status === 'active'"
                        [class.bg-muted]="rec.status !== 'active'"
                        [class.text-muted-foreground]="rec.status !== 'active'"
                      >
                        {{ rec.status }}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-xs text-muted-foreground">
                      {{ rec.expiresAt | date: 'short' }}
                    </td>
                    <td class="px-3 py-2 text-xs text-muted-foreground">
                      {{
                        rec.lastAccessedAt
                          ? (rec.lastAccessedAt | date: 'short')
                          : '—'
                      }}
                    </td>
                    <td class="px-3 py-2 text-right">
                      @if (rec.status === 'active') {
                        <button
                          type="button"
                          (click)="revokeRequest.emit(rec)"
                          class="text-xs text-destructive hover:underline"
                        >
                          Revoke
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>

    @if (s.shareFor(); as sk) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        (click)="s.closeShare()"
      >
        <div
          class="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-3 flex items-center gap-2">
            <ng-icon name="lucideLink" class="h-4 w-4 text-primary" />
            <h2 class="text-sm font-semibold text-foreground">Share link</h2>
            <button
              type="button"
              (click)="s.closeShare()"
              class="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <ng-icon name="lucideX" class="h-4 w-4" />
            </button>
          </div>
          <p class="mb-3 truncate font-mono text-xs text-muted-foreground">
            {{ sk }}
          </p>

          <div class="mb-3 flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Expires in</span>
            @for (t of s.ttls; track t.seconds) {
              <button
                type="button"
                (click)="s.shareTtl.set(t.seconds)"
                class="rounded-md border px-2 py-1 text-xs"
                [class.border-primary]="s.shareTtl() === t.seconds"
                [class.text-primary]="s.shareTtl() === t.seconds"
                [class.border-border]="s.shareTtl() !== t.seconds"
                [class.text-muted-foreground]="s.shareTtl() !== t.seconds"
              >
                {{ t.label }}
              </button>
            }
            <button
              type="button"
              (click)="s.generateShare()"
              [disabled]="s.busy()"
              class="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Generate
            </button>
          </div>

          @if (s.shareLink(); as link) {
            <div
              class="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2"
            >
              <input
                readonly
                [value]="link"
                class="flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
              />
              <button
                type="button"
                (click)="s.copyShareLink(link)"
                class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <ng-icon
                  [name]="s.shareCopied() ? 'lucideCheck' : 'lucideCopy'"
                  class="h-3.5 w-3.5"
                />
                {{ s.shareCopied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              Anyone with this link can open the file until it expires. No Flui
              account needed.
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class ObjectStoreSharesComponent {
  protected readonly s = inject(ObjectStoreConsoleStateService);

  readonly revokeRequest = output<ShareRecord>();
}
