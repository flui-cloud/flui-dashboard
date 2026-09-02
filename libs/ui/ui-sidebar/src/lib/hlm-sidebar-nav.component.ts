import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-nav',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
	},
	changeDetection: ChangeDetectionStrategy.Eager,
	template: `
		<ng-content />
	`,
})
export class HlmSidebarNavComponent {
	public readonly userClass = input<ClassValue>('');

	protected readonly _computedClass = computed(() => hlm('flex flex-col gap-1 px-3', this.userClass()));
}
