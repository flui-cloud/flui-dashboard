import { Component, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-inset',
	standalone: true,
	template: `
		<ng-content />
	`,
	host: {
		'[class]': '_computedClass()',
	},
})
export class HlmSidebarInsetComponent {
	public readonly userClass = input<ClassValue>('');

	protected readonly _computedClass = computed(() => hlm('relative', '[&>*]:p-6', this.userClass()));
}
