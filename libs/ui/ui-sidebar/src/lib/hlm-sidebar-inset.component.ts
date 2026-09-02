import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-inset',
	standalone: true,
	template: `
		<ng-content />
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	host: {
		'[class]': '_computedClass()',
	},
})
export class HlmSidebarInsetComponent {
	public readonly userClass = input<ClassValue>('');

	protected readonly _computedClass = computed(() => hlm('relative', '[&>*]:p-6', this.userClass()));
}
