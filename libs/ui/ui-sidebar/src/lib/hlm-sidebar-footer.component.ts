import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarService } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar-footer',
	standalone: true,
	imports: [CommonModule],
	host: {
		'[class]': '_computedClass()',
	},
	template: `
		<button
			[ngClass]="{ 'px-3': _sidebarService.isExpanded(), 'px-2': !_sidebarService.isExpanded() }"
			class="border-border group relative h-12 w-full border-t"
			(click)="clicked.emit()"
		>
			<div
				class="flex w-full items-center"
				[class.justify-start]="_sidebarService.isExpanded()"
				[class.justify-center]="!_sidebarService.isExpanded()"
			>
				<div
					class="border-border bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-md border transition-transform duration-200 ease-in-out group-hover:scale-110 shrink-0"
				>
					@if (initials()) {
						<span class="text-sm font-semibold leading-none select-none">{{ initials() }}</span>
					} @else {
						<ng-content select="ng-icon" />
					}
				</div>

				@if (_sidebarService.isExpanded()) {
					<div class="ml-3 flex min-w-0 flex-col">
						<span class="text-foreground truncate text-sm font-medium">{{ title() }}</span>
						<span class="text-muted-foreground truncate text-xs">{{ subtitle() }}</span>
					</div>
				} @else {
					<div
						class="bg-popover text-popover-foreground invisible absolute bottom-full left-full z-50 mb-2 ml-2 rounded-md px-2 py-1 text-xs opacity-0 transition-opacity group-hover:visible group-hover:opacity-100"
					>
						{{ title() }}
					</div>
				}
			</div>
		</button>
	`,
})
export class HlmSidebarFooterComponent {
	protected readonly _sidebarService = inject(BrnSidebarService);

	public readonly clicked = output<void>();
	public readonly userClass = input<ClassValue>('');
	public readonly title = input.required<string>();
	public readonly subtitle = input.required<string>();
	public readonly initials = input<string>('');

	protected readonly _computedClass = computed(() => hlm('block mt-auto', this.userClass()));
}
