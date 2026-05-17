import { Component } from '@angular/core';

@Component({
  selector: 'grid',
  imports: [],
  template: `
    <div class="p-4 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-40">
        <div class="bg-card-foreground/10 text-card rounded-lg transition-shadow">
        </div>
        <div class="bg-card-foreground/10 text-card rounded-lg transition-shadow">
        </div>
        <div class="bg-card-foreground/10 text-card rounded-lg transition-shadow">
        </div>
      </div>
      <div class="bg-card-foreground/10 text-card rounded-lg transition-shadow min-h-[calc(100vh-20rem)]">
      </div>
    </div>
  `
})
export class GridComponent {

}
