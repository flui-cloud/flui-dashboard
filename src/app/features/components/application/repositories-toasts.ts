import { Component, Injectable, computed, input, signal } from '@angular/core';
import { FlToast } from '../../../ui/overlays/toast';

export type RepoToastTone = 'success' | 'error' | 'warning';

interface RepoToast {
  readonly title: string;
  readonly body: string;
}

const TONES: readonly RepoToastTone[] = ['success', 'error', 'warning'];

@Injectable()
export class RepoToasts {
  readonly slots = signal<Record<RepoToastTone, RepoToast | null>>({
    success: null,
    error: null,
    warning: null,
  });

  show(tone: RepoToastTone, title: string, body: string, hideAfterMs: number): void {
    this.slots.update((s) => ({ ...s, [tone]: { title, body } }));
    setTimeout(() => this.hide(tone), hideAfterMs);
  }

  hide(tone: RepoToastTone): void {
    this.slots.update((s) => ({ ...s, [tone]: null }));
  }
}

@Component({
  selector: 'app-repositories-toasts',
  imports: [FlToast],
  template: `
    @if (visible().length > 0) {
      <div class="fl-toasts" aria-live="polite">
        @for (item of visible(); track item.tone) {
          <fl-toast
            [tone]="item.tone"
            [title]="item.title"
            [body]="item.body"
            (dismiss)="toasts().hide(item.tone)"
          />
        }
      </div>
    }
  `,
})
export class RepositoriesToastStack {
  readonly toasts = input.required<RepoToasts>();

  protected readonly visible = computed(() => {
    const slots = this.toasts().slots();
    return TONES.flatMap((tone) => {
      const slot = slots[tone];
      return slot ? [{ tone, ...slot }] : [];
    });
  });
}
