import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-card',
  host: { class: 'flex min-h-screen items-center justify-center bg-fl-page-bg p-4' },
  template: `
    <main class="flex w-full max-w-sm flex-col gap-3">
      <section class="fl-panel" [attr.aria-label]="title()">
        <div class="fl-panel__body flex flex-col gap-5">
          <div class="flex flex-col items-center gap-3 text-center">
            <img src="/icons/flui-mark.svg" alt="Flui" class="h-10 w-10" />
            <h1 class="m-0 text-fl-section-title">{{ title() }}</h1>
          </div>
          <ng-content />
        </div>
      </section>
      <ng-content select="[authFooter]" />
    </main>
  `,
})
export class AuthCard {
  readonly title = input.required<string>();
}
