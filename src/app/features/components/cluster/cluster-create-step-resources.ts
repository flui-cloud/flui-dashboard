import { Component, input, output } from '@angular/core';
import { RegionServerSelectorComponent } from '../../../shared/components/region-server-selector/region-server-selector.component';
import { FlField } from '../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import {
  AvailabilityChoice,
  AvailabilityDraft,
  ClusterAvailabilityChoiceComponent,
} from './cluster-availability-choice.component';

const NODE_COUNTS = [1, 2, 3, 5];

@Component({
  selector: 'app-cluster-create-step-resources',
  imports: [
    RegionServerSelectorComponent,
    ClusterAvailabilityChoiceComponent,
    FlField,
    FlKeyValue,
    FlKvItem,
  ],
  host: { class: 'fl-stack' },
  template: `
    <app-region-server-selector
      [selectedProvider]="provider()"
      [selectedRegion]="region()"
      [selectedServerTypeId]="serverTypeId()"
      (regionSelected)="regionSelected.emit($event)"
      (serverTypeSelected)="serverTypeSelected.emit($event)"
    />

    @if (needsDisk()) {
      <fieldset class="fl-fieldset border-t border-fl-border pt-4">
        <legend>Boot disk</legend>
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          This size uses network block storage. Choose the root disk of each node, from 5 to 500 GB.
        </p>
        <div class="fl-row gap-4">
          <input
            type="range"
            class="w-48"
            aria-label="Boot disk size"
            [min]="5"
            [max]="500"
            [step]="5"
            [value]="diskSizeGb()"
            (input)="diskSizeChange.emit(+$any($event.target).value)"
          />
          <div class="fl-input fl-input--lg w-28">
            <input
              type="number"
              class="fl-num text-right"
              aria-label="Boot disk size in GB"
              [min]="5"
              [max]="500"
              [value]="diskSizeGb()"
              (change)="diskSizeChange.emit(+$any($event.target).value)"
            />
            <span class="text-fl-body-sm">GB</span>
          </div>
        </div>
        <fl-key-value class="fl-kv--compact">
          <fl-kv-item key="Storage per node">
            <span class="fl-mono fl-num"
              >€{{ ((storagePricePerGbMonthly() ?? 0) * diskSizeGb()).toFixed(2) }}/mo</span
            >
          </fl-kv-item>
          <fl-kv-item key="Total per node">
            <span class="fl-mono fl-num">€{{ costPerNodeHour().toFixed(4) }}/h</span>
            <span class="fl-num text-fl-ink-muted">
              ~€{{ (costPerNodeHour() * 730).toFixed(2) }}/mo</span
            >
          </fl-kv-item>
        </fl-key-value>
      </fieldset>
    }

    <fieldset class="fl-fieldset border-t border-fl-border pt-4">
      <legend>Flui shared storage</legend>
      <p class="m-0 text-fl-body-sm text-fl-ink-muted">
        Pods move between nodes without losing data, which scale-down needs. Flui adds a cloud
        volume to the master and exports it to the workers over NFS with fscache. Without it,
        volumes fall back to <span class="fl-mono">flui-local</span>, a disk on each node that does
        not move.
      </p>
      <label class="fl-check">
        <input
          type="checkbox"
          id="sharedStorageEnabled"
          [checked]="sharedStorage()"
          (change)="sharedStorageChange.emit($any($event.target).checked)"
        />
        Enable the flui-shared storage class (recommended)
      </label>
      @if (sharedStorage()) {
        <div class="fl-row gap-4">
          <input
            type="range"
            class="w-48"
            aria-label="Shared volume size"
            [min]="10"
            [max]="1000"
            [step]="10"
            [value]="sharedStorageSizeGb()"
            (input)="sharedStorageSizeChange.emit(+$any($event.target).value)"
          />
          <div class="fl-input fl-input--lg w-28">
            <input
              type="number"
              class="fl-num text-right"
              aria-label="Shared volume size in GB"
              [min]="10"
              [max]="1000"
              [value]="sharedStorageSizeGb()"
              (change)="sharedStorageSizeChange.emit(+$any($event.target).value)"
            />
            <span class="text-fl-body-sm">GB</span>
          </div>
          <span class="text-fl-body-sm text-fl-ink-muted">
            Master volume. Holds every flui-shared volume and its snapshots.
          </span>
        </div>
      }
    </fieldset>

    <cluster-availability-choice
      [provider]="provider()"
      [region]="region()"
      [serverTypeId]="serverTypeId()"
      [draft]="draft()"
      (draftChange)="draftChange.emit($event)"
      (changed)="availabilityChange.emit($event)"
    />

    <fieldset class="fl-fieldset border-t border-fl-border pt-4">
      <legend>Nodes</legend>
      @if (highlyAvailable()) {
        <div class="flex flex-col gap-1" data-testid="ha-nodes-fixed">
          <span class="text-fl-body-sm font-medium">3 servers, one in each location</span>
          <span class="text-fl-body-sm text-fl-ink-muted">Add more once the cluster is ready.</span>
        </div>
      } @else {
        <fl-field
          label="Nodes"
          for="clusterNodes"
          hint="Counted across every node, master included. How far the cluster may grow, and whether Flui grows it on its own, is set in its Scaling section once it exists."
        >
          <span class="fl-select-wrap">
            <select
              id="clusterNodes"
              class="fl-select fl-select--sm"
              (change)="nodesChange.emit(+$any($event.target).value)"
            >
              @for (count of nodeCounts; track count) {
                <option [value]="count" [selected]="count === nodes()">{{ count }}</option>
              }
            </select>
          </span>
        </fl-field>
      }
    </fieldset>
  `,
})
export class ClusterCreateStepResources {
  readonly provider = input('');
  readonly region = input('');
  readonly serverTypeId = input('');
  readonly needsDisk = input(false);
  readonly diskSizeGb = input(20);
  readonly storagePricePerGbMonthly = input<number | null>(null);
  readonly costPerNodeHour = input(0);
  readonly sharedStorage = input(true);
  readonly sharedStorageSizeGb = input(20);
  readonly draft = input.required<AvailabilityDraft>();
  readonly highlyAvailable = input(false);
  readonly nodes = input(1);
  readonly regionSelected = output<string>();
  readonly serverTypeSelected = output<string>();
  readonly diskSizeChange = output<number>();
  readonly sharedStorageChange = output<boolean>();
  readonly sharedStorageSizeChange = output<number>();
  readonly draftChange = output<AvailabilityDraft>();
  readonly availabilityChange = output<AvailabilityChoice>();
  readonly nodesChange = output<number>();

  protected readonly nodeCounts = NODE_COUNTS;
}
