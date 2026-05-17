import { Component, computed, inject, input } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePanelLeft, lucidePanelRight } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarService, BrnSidebarTriggerDirective } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-trigger',
	standalone: true,
	imports: [BrnSidebarTriggerDirective, NgIconComponent],
	providers: [
		provideIcons({
			lucidePanelLeft,
			lucidePanelRight,
		}),
	],
	host: {
		'[class]': '_computedClass()',
	},
	template: `
		<button brnSidebarTrigger class="inline-flex items-center justify-center">
			<ng-icon
				hlm
				[name]="_sidebarService.isExpanded() ? 'lucidePanelLeft' : 'lucidePanelRight'"
				class="text-foreground h-4 w-4"
			/>
		</button>
	`,
})
export class HlmSidebarTriggerComponent {
	protected readonly _sidebarService = inject(BrnSidebarService);
	protected readonly _computedClass = computed(() =>
		hlm(
			'inline-flex items-center justify-center rounded-sm hover:bg-accent hover:text-accent-foreground',
			this.userClass(),
		),
	);

	public readonly userClass = input<ClassValue>('');
}
