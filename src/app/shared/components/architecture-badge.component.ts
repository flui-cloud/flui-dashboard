import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';

export type ServerArchitecture = 'x86' | 'arm';

export const ARM_WARNING =
  'Arm server: apps deployed from a repository are built for x86 and will not run on it. Catalog apps run normally.';

const LABEL: Record<ServerArchitecture, string> = { x86: 'x86', arm: 'Arm' };

export function architectureLabel(architecture: string | null | undefined): string | null {
  return architecture === 'x86' || architecture === 'arm' ? LABEL[architecture] : null;
}

export function architectureWarning(architecture: string | null | undefined): string | null {
  return architecture === 'arm' ? ARM_WARNING : null;
}

@Component({
  selector: 'app-architecture-badge',
  standalone: true,
  imports: [HlmBadgeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as text) {
      <span
        hlmBadge
        variant="outline"
        static
        class="px-1.5 py-0 text-[10px] font-medium leading-4 text-muted-foreground"
        [attr.title]="'CPU architecture: ' + text"
        data-testid="architecture-badge"
        >{{ text }}</span
      >
    }
  `,
})
export class ArchitectureBadgeComponent {
  readonly architecture = input<string | null | undefined>(null);

  protected readonly label = computed(() => architectureLabel(this.architecture()));
}
