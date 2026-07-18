import { Component, computed, effect, input, output, signal } from '@angular/core';
import {
  PROJECT_PRESET_COLORS,
  Project,
} from '../../model/project.model';

export interface ProjectFormValue {
  name: string;
  description?: string;
  color?: string;
}

const FIELD =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [],
  host: { class: 'block' },
  template: `
    <div class="space-y-3">
      <div class="grid gap-3" [class.sm:grid-cols-2]="withDescription()">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            [class]="fieldClass"
            placeholder="my-project"
            [value]="name()"
            (input)="name.set(value($event))"
            (keydown.enter)="submit()"
          />
          @if (slug()) {
            <p class="mt-1 text-[11px] font-mono text-muted-foreground">{{ slug() }}</p>
          }
        </div>
        @if (withDescription()) {
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <input
              [class]="fieldClass"
              [value]="description()"
              (input)="description.set(value($event))"
            />
          </div>
        }
      </div>

      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">Color</label>
        <div class="flex flex-wrap items-center gap-2">
          @for (c of presetColors; track c) {
            <button
              type="button"
              (click)="color.set(c)"
              [title]="c"
              class="h-7 w-7 rounded-full border-2 transition"
              [style.background]="c"
              [class]="
                color() === c
                  ? 'border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background'
                  : 'border-border hover:border-foreground/40'
              "
            ></button>
          }
          <input
            type="color"
            [value]="colorOrDefault()"
            (input)="color.set(value($event))"
            class="h-7 w-9 rounded border border-border bg-background p-0.5 cursor-pointer"
            title="Custom color"
          />
          <input
            [class]="hexFieldClass"
            type="text"
            placeholder="#22aa88"
            maxlength="7"
            [value]="color()"
            (input)="color.set(value($event))"
          />
          @if (color()) {
            <button
              type="button"
              (click)="color.set('')"
              class="text-xs text-muted-foreground hover:text-foreground underline"
            >
              clear
            </button>
          }
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          (click)="cancelled.emit()"
          class="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          (click)="submit()"
          [disabled]="!canSubmit() || busy()"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ submitLabel() }}
        </button>
      </div>
    </div>
  `,
})
export class ProjectFormComponent {
  readonly project = input<Project | null>(null);
  readonly withDescription = input(false);
  readonly submitLabel = input('Create project');
  readonly busy = input(false);

  readonly saved = output<ProjectFormValue>();
  readonly cancelled = output<void>();

  protected readonly fieldClass = FIELD;
  protected readonly hexFieldClass =
    'h-7 w-24 rounded-md border border-input bg-background px-2 text-xs font-mono ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  protected readonly presetColors = PROJECT_PRESET_COLORS;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly color = signal('');

  protected readonly canSubmit = computed(() => this.name().trim().length > 0);

  protected readonly slug = computed(() => {
    const existing = this.project();
    if (existing) return existing.slug;
    const base = this.name()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return base ? `slug: ${base}` : '';
  });

  constructor() {
    effect(() => {
      const p = this.project();
      this.name.set(p?.name ?? '');
      this.description.set(p?.description ?? '');
      this.color.set(p?.color ?? '');
    });
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected colorOrDefault(): string {
    const c = this.color();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#6366f1';
  }

  protected submit(): void {
    if (!this.canSubmit() || this.busy()) return;
    this.saved.emit({
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      color: this.color().trim() || undefined,
    });
  }
}
