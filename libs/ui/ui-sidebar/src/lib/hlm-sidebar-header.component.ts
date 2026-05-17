import { Component, computed, inject, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-header',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
	},
	template: `
		<ng-content />
	`,
})
export class HlmSidebarHeaderComponent {
	private readonly _sidebarService = inject(BrnSidebarService);

	public readonly userClass = input<ClassValue>('');
	protected readonly _computedClass = computed(() =>
		hlm(
			'flex items-center px-3 py-2 text-foreground',
			!this._sidebarService.isExpanded() ? 'justify-center' : '',
			this.userClass(),
		),
	);
}
