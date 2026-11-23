import { Component, computed, input } from '@angular/core';
import { FlTag } from '../../ui/primitives/tag';

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
  imports: [FlTag],
  template: `
    @if (label(); as text) {
      <fl-tag [attr.title]="'CPU architecture: ' + text" data-testid="architecture-badge">{{
        text
      }}</fl-tag>
    }
  `,
})
export class ArchitectureBadgeComponent {
  readonly architecture = input<string | null | undefined>(null);

  protected readonly label = computed(() => architectureLabel(this.architecture()));
}
