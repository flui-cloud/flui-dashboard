import { Component } from '@angular/core';

@Component({
  selector: 'fl-tag',
  host: { class: 'fl-tag' },
  template: `<ng-content />`,
})
export class FlTag {}
