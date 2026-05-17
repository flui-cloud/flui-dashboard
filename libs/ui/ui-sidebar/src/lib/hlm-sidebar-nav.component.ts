import { Component, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-nav',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
	},
	template: `
		<ng-content />
	`,
})
export class HlmSidebarNavComponent {
	public readonly userClass = input<ClassValue>('');

	protected readonly _computedClass = computed(() => hlm('flex flex-col gap-1 px-3', this.userClass()));
}
