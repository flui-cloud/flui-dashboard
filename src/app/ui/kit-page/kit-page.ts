import { Component } from '@angular/core';
import { FlPageHeader } from '../patterns/page-header';
import { FlStatus } from '../primitives/status';
import { KitActions } from './kit-actions';
import { KitData } from './kit-data';
import { KitFlows } from './kit-flows';
import { KitFoundations } from './kit-foundations';
import { KitFrame } from './kit-frame';

@Component({
  selector: 'fl-kit-page',
  imports: [FlPageHeader, FlStatus, KitFoundations, KitActions, KitData, KitFlows, KitFrame],
  host: { class: 'block min-h-screen bg-fl-page-bg text-fl-ink' },
  template: `
    <main class="fl-page mx-auto max-w-screen-xl">
      <fl-page-header
        title="Flui Console kit"
        [breadcrumb]="[{ label: 'Development' }, { label: 'Kit' }]"
      >
        <fl-status headerStatus tone="success" label="Ready" />
        <span headerMeta>Components of src/app/ui rendered with real Angular code</span>
      </fl-page-header>
      <fl-kit-frame />
      <fl-kit-data />
      <fl-kit-actions />
      <fl-kit-flows />
      <fl-kit-foundations />
    </main>
  `,
})
export class KitPage {}
