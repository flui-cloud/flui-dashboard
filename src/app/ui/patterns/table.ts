import { Directive, input } from '@angular/core';

export type TableDensity = 'default' | 'dense' | 'log';

@Directive({
  selector: 'table[flTable]',
  host: {
    class: 'fl-table',
    '[class.fl-table--dense]': 'density() === "dense"',
    '[class.fl-table--log]': 'density() === "log"',
  },
})
export class FlTable {
  readonly density = input<TableDensity>('default');
}
