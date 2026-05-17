import { computed, Directive, inject, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Directive({
	selector: '[hlmSidebarSectionTitle]',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
		'[attr.data-state]': 'sidebarService.isExpanded() ? "expanded" : "collapsed"',
	},
})
export class HlmSidebarSectionTitleDirective {
	public readonly userClass = input<ClassValue>('');

	protected readonly sidebarService = inject(BrnSidebarService);
	protected readonly _computedClass = computed(() =>
		hlm(
			'text-xs font-semibold text-muted-foreground',
			'px-2 mt-4 mb-2',
			'data-[state=collapsed]:hidden',
			'transition-opacity duration-200',
			'data-[state=expanded]:opacity-100',
			'data-[state=collapsed]:opacity-0',
			this.userClass(),
		),
	);
}
