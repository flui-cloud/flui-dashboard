import { Component } from '@angular/core';

@Component({
  selector: 'grid',
  template: `
    <div class="fl-stack p-4">
      <div class="fl-grid-3 min-h-40">
        <div class="rounded-fl-lg border border-fl-border bg-fl-surface"></div>
        <div class="rounded-fl-lg border border-fl-border bg-fl-surface"></div>
        <div class="rounded-fl-lg border border-fl-border bg-fl-surface"></div>
      </div>
      <div class="min-h-96 rounded-fl-lg border border-fl-border bg-fl-surface"></div>
    </div>
  `,
})
export class GridComponent {}
