import { Component, computed, effect, input, output, signal } from '@angular/core';
import { PROJECT_PRESET_COLORS, Project } from '../../model/project.model';
import { stripHyphenEdges } from '../../../shared/utils/slug';
import { FlDialog } from '../../../ui/overlays/dialog-frame';
import { FlField } from '../../../ui/patterns/field';
import { FlButton } from '../../../ui/primitives/button';

export interface ProjectFormValue {
  name: string;
  description?: string;
  color?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

let nextId = 0;

@Component({
  selector: 'app-project-form',
  imports: [FlDialog, FlField, FlButton],
  template: `
    <fl-dialog [title]="project() ? 'Edit ' + project()!.name : 'New project'">
      <fl-field label="Name" [for]="uid + '-name'" [hint]="slugHint()">
        <div class="fl-input fl-input--lg">
          <input
            [id]="uid + '-name'"
            autocomplete="off"
            placeholder="my-project"
            [value]="name()"
            (input)="name.set(value($event))"
            (keydown.enter)="submit()"
          />
        </div>
      </fl-field>
      @if (withDescription()) {
        <fl-field label="Description" [for]="uid + '-description'" hint="Optional">
          <textarea
            class="fl-textarea"
            rows="2"
            [id]="uid + '-description'"
            [value]="description()"
            (input)="description.set(value($event))"
          ></textarea>
        </fl-field>
      }
      <fl-field label="Color" [for]="uid + '-color'" hint="Optional, as a hex value">
        <div class="fl-row">
          <input
            type="color"
            class="h-8 w-10 cursor-pointer"
            aria-label="Pick a color"
            [attr.list]="uid + '-presets'"
            [value]="colorOrDefault()"
            (input)="color.set(value($event))"
          />
          <datalist [id]="uid + '-presets'">
            @for (c of presetColors; track c) {
              <option [value]="c"></option>
            }
          </datalist>
          <div class="fl-input fl-input--lg">
            <input
              class="fl-mono"
              type="text"
              maxlength="7"
              autocomplete="off"
              placeholder="No color"
              [id]="uid + '-color'"
              [value]="color()"
              (input)="color.set(value($event))"
            />
          </div>
          @if (color()) {
            <button flButton="ghost" size="sm" type="button" (click)="color.set('')">Clear</button>
          }
        </div>
      </fl-field>
      <ng-container dialogFooter>
        <button flButton="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
        <button
          flButton="primary"
          type="button"
          [disabled]="!canSubmit() || busy()"
          (click)="submit()"
        >
          {{ submitLabel() }}
        </button>
      </ng-container>
    </fl-dialog>
  `,
})
export class ProjectFormComponent {
  readonly project = input<Project | null>(null);
  readonly withDescription = input(false);
  readonly submitLabel = input('Create project');
  readonly busy = input(false);

  readonly saved = output<ProjectFormValue>();
  readonly cancelled = output<void>();

  protected readonly uid = `project-form-${nextId++}`;
  protected readonly presetColors = PROJECT_PRESET_COLORS;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly color = signal('');

  protected readonly canSubmit = computed(() => this.name().trim().length > 0);

  protected readonly slug = computed(() => {
    const existing = this.project();
    if (existing) return existing.slug;
    const rawBase = this.name()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-');
    return stripHyphenEdges(rawBase).slice(0, 60);
  });

  protected readonly slugHint = computed(() => {
    const slug = this.slug();
    return slug ? `Slug: ${slug}` : 'Shown in lists and used to build the slug';
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
    return HEX.test(c) ? c : PROJECT_PRESET_COLORS[8];
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
