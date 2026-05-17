import { Component, computed, input } from '@angular/core';
import { hlm } from '@spartan-ng/brain/core';
import { BrnSidebarComponent } from '@dawit-io/spartan-sidebar-core';
import { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-sidebar',
	standalone: true,
	host: {
		'[class]': '_computedClass()',
		'[attr.data-state]': 'sidebarService.isExpanded() ? "expanded" : "collapsed"',
		'[attr.data-collapsible]': 'sidebarService.collapsibleMode()',
	},
	template: `
		<div class="flex h-screen flex-col">
			<ng-content />
		</div>
	`,
	styles: [`
		:host {
			scrollbar-width: thin;
			scrollbar-color: transparent transparent;
		}
		:host:hover {
			scrollbar-color: hsl(var(--muted-foreground) / 0.4) transparent;
		}
		:host::-webkit-scrollbar {
			width: 4px;
		}
		:host::-webkit-scrollbar-track {
			background: transparent;
		}
		:host::-webkit-scrollbar-thumb {
			background-color: transparent;
			border-radius: 4px;
			box-shadow: inset 0 0 0 4px transparent;
			transition: box-shadow 0.3s ease;
		}
		:host:hover::-webkit-scrollbar-thumb {
			box-shadow: inset 0 0 0 4px hsl(var(--muted-foreground) / 0.4);
		}
	`],
})
export class HlmSidebarComponent extends BrnSidebarComponent {

  constructor() {
    super();
    console.log('HlmSidebarComponent constructor');
  }
	protected get sidebarService() {
		return this._sidebarService;
	}
	protected readonly _computedClass = computed(() =>
		hlm(
			'relative z-40 flex h-full overflow-y-auto overflow-x-hidden flex-col flex-none border-r border-border bg-background transition-all duration-200',

			// Variant styles
			this.sidebarService.variant() === 'sidebar' && ['sticky top-0 left-0', 'shrink-0'],
			this.sidebarService.variant() === 'floating' && ['absolute shadow-lg', 'bg-popover text-popover-foreground'],
			this.sidebarService.variant() === 'inset' && ['border rounded-lg m-4', 'bg-card text-card-foreground'],

			// Collapsible mode styles
			this.sidebarService.collapsibleMode() === 'offcanvas' && [
				'w-64',
				'transform',
				'data-[state=collapsed]:-translate-x-full',
				'data-[state=collapsed]:absolute',
				'data-[state=collapsed]:opacity-0',
				'data-[state=expanded]:translate-x-0',
				'data-[state=expanded]:opacity-100',
			],

			this.sidebarService.collapsibleMode() === 'icon' && [
				'w-64 data-[state=collapsed]:w-16',
				'data-[state=collapsed]:transition-[width]',
			],

			this.sidebarService.collapsibleMode() === 'none' && ['w-64', 'transition-none'],

			// Common styles for expanded/collapsed states
			'data-[state=expanded]:w-64',
			'[&_span]:data-[state=collapsed]:hidden [&_span]:data-[state=expanded]:inline',
			'[&_ng-icon]:data-[state=collapsed]:mx-auto',

			this.userClass(),
		),
	);

	public readonly userClass = input<ClassValue>('');
}
