import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideLoader,
  lucideLockKeyhole,
  lucideLockKeyholeOpen,
  lucideRotateCcw,
  lucideShield,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { SecretsConsoleStateService } from './secrets-console-state.service';
import { SecretsTreeComponent } from './secrets-tree.component';
import { SecretsEditorComponent } from './secrets-editor.component';

@Component({
  selector: 'app-secrets-console-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, SecretsTreeComponent, SecretsEditorComponent],
  providers: [
    SecretsConsoleStateService,
    provideIcons({
      lucideArrowLeft,
      lucideLoader,
      lucideLockKeyhole,
      lucideLockKeyholeOpen,
      lucideRotateCcw,
      lucideShield,
      lucideTriangleAlert,
    }),
  ],
  template: `
    <div class="p-4 md:p-6">
      <div class="mb-5 flex items-center gap-3">
        <button
          type="button"
          (click)="s.back()"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          title="Back"
        >
          <ng-icon name="lucideArrowLeft" class="h-4 w-4" />
        </button>
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <ng-icon name="lucideShield" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h1 class="flex items-center gap-2 text-lg font-semibold text-foreground">
            Secrets
            @if (s.server(); as srv) {
              <span class="text-sm font-normal text-muted-foreground"
                >{{ s.engineLabel() }} {{ srv.version }} · {{ srv.mount }}/</span
              >
              @if (srv.sealed) {
                <span
                  class="rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive"
                  >sealed</span
                >
              }
            }
          </h1>
          <p class="truncate font-mono text-xs text-muted-foreground">
            {{ applicationId() }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            (click)="s.readOnly.set(!s.readOnly())"
            [title]="s.readOnly() ? 'Read-only: writes blocked' : 'Writes enabled'"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
            [class.border-border]="s.readOnly()"
            [class.text-muted-foreground]="s.readOnly()"
            [class.border-amber-500]="!s.readOnly()"
            [class.text-amber-600]="!s.readOnly()"
          >
            <ng-icon
              [name]="s.readOnly() ? 'lucideLockKeyhole' : 'lucideLockKeyholeOpen'"
              class="h-4 w-4"
            />
            {{ s.readOnly() ? 'Read-only' : 'Writes on' }}
          </button>
          <button
            type="button"
            (click)="s.connect()"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            title="Refresh"
          >
            <ng-icon name="lucideRotateCcw" class="h-4 w-4" />
          </button>
        </div>
      </div>

      @if (s.conn() === 'connecting') {
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Connecting…
        </div>
      } @else if (s.conn() === 'error') {
        <div
          class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ s.errorMsg() || 'Failed to connect.' }}</span>
        </div>
      } @else {
        <div class="flex flex-col gap-4 lg:flex-row">
          <app-secrets-tree />
          <app-secrets-editor />
        </div>
      }
    </div>
  `,
})
export class SecretsConsolePageComponent implements OnInit {
  protected readonly s = inject(SecretsConsoleStateService);
  private readonly route = inject(ActivatedRoute);

  readonly applicationId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('applicationId'))),
    { initialValue: this.route.snapshot.paramMap.get('applicationId') },
  );

  ngOnInit(): void {
    this.s.appId.set(this.applicationId() ?? null);
    this.s.init();
  }
}
