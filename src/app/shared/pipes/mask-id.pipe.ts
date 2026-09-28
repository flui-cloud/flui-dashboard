import { Pipe, PipeTransform, inject } from '@angular/core';
import { MaskModeService } from '../../core/services/mask-mode.service';

/**
 * An identifier shown on screen, cut to its last four characters while mask
 * mode is on: enough to tell two apart on a shared screen, not enough to
 * reuse. The address bar still carries the full id — mask mode says so on
 * its toggle.
 */
@Pipe({ name: 'maskId', standalone: true, pure: false })
export class MaskIdPipe implements PipeTransform {
  private readonly mask = inject(MaskModeService);

  transform(value: string | null | undefined): string {
    if (!value) return '';
    if (!this.mask.enabled()) return value;
    return `••••${value.slice(-4)}`;
  }
}
