import { Component, computed, inject, input } from '@angular/core';
import { BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { hlm } from '@spartan-ng/brain/core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-brand',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
	},
	template: `
		<div class="flex w-full items-center" [class.justify-center]="!_sidebarService.isExpanded()">
			<div class="flex items-center" [class.gap-2]="_sidebarService.isExpanded()">
				<div class="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
					<ng-content select="ng-icon" />
				</div>
				<span class="truncate text-lg font-semibold">
					<ng-content />
				</span>
			</div>
		</div>
	`,
})
export class HlmSidebarBrandComponent {
	protected readonly _sidebarService = inject(BrnSidebarService);
	public readonly userClass = input<ClassValue>('');
	protected readonly _computedClass = computed(() => hlm('flex items-center min-w-0', this.userClass()));
}
