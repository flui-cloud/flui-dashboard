import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX, lucidePlus, lucideLoader } from '@ng-icons/lucide';

@Component({
  selector: 'app-flui-tag-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [provideIcons({ lucideX, lucidePlus, lucideLoader })],
  template: `
    <div class="flex flex-wrap items-center gap-1.5">
      @for (tag of tags(); track tag) {
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {{ tag }}
          <button type="button" (click)="onRemoveTag(tag)" [disabled]="busy()"
            class="hover:text-destructive transition-colors disabled:opacity-50">
            <ng-icon name="lucideX" class="h-3 w-3" />
          </button>
        </span>
      }

      @if (showInput()) {
        <div class="inline-flex items-center gap-1">
          <input
            type="text"
            [(ngModel)]="newTag"
            (keydown.enter)="onAddTag()"
            (keydown.escape)="showInput.set(false)"
            placeholder="tag name"
            class="h-6 w-24 px-2 text-xs border border-input rounded bg-background"
            autofocus
          />
          <button type="button" (click)="onAddTag()" [disabled]="busy() || !newTag()"
            class="text-primary hover:text-primary/80 disabled:opacity-50">
            @if (busy()) {
              <ng-icon name="lucideLoader" class="h-3.5 w-3.5 animate-spin" />
            } @else {
              <ng-icon name="lucidePlus" class="h-3.5 w-3.5" />
            }
          </button>
        </div>
      } @else {
        <button type="button" (click)="showInput.set(true)"
          class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-muted-foreground border border-dashed border-border hover:border-primary hover:text-primary transition-colors">
          <ng-icon name="lucidePlus" class="h-3 w-3" /> Add tag
        </button>
      }
    </div>
  `,
})
export class FluiTagManagerComponent {
  tags = input.required<string[]>();
  addTag = output<string>();
  removeTag = output<string>();

  showInput = signal(false);
  newTag = signal('');
  busy = signal(false);

  onAddTag(): void {
    const tag = this.newTag().trim();
    if (!tag) return;
    this.addTag.emit(tag);
    this.newTag.set('');
    this.showInput.set(false);
  }

  onRemoveTag(tag: string): void {
    this.removeTag.emit(tag);
  }
}
