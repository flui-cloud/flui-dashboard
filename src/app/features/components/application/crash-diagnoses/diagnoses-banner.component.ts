import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideShieldAlert,
  lucideChevronRight,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';
import { severityBannerClass } from '../../../model/crash-diagnosis.models';

@Component({
  selector: 'app-diagnoses-banner',
  standalone: true,
  imports: [CommonModule, NgIcon, RouterLink, HlmButtonDirective],
  providers: [provideIcons({ lucideShieldAlert, lucideChevronRight, lucideTriangleAlert })],
  template: `
    @if (latest()) {
      <div
        class="flex items-start gap-3 px-4 py-3 border rounded-lg text-sm"
        [class]="bannerClass()"
      >
        <ng-icon name="lucideTriangleAlert" class="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div class="flex-1 min-w-0 space-y-1">
          <p class="font-medium">{{ latest()!.title }}</p>
          <p class="text-xs opacity-90 whitespace-pre-wrap">{{ latest()!.explanation }}</p>
          @if (othersCount() > 0) {
            <p class="text-xs opacity-75">
              +{{ othersCount() }} other unresolved diagnoses
            </p>
          }
        </div>
        <a
          hlmBtn
          size="sm"
          variant="outline"
          [routerLink]="['/apps/applications', applicationId, 'diagnoses']"
          class="flex-shrink-0"
        >
          View
          <ng-icon name="lucideChevronRight" class="h-3.5 w-3.5 ml-1" />
        </a>
      </div>
    }
  `,
})
export class DiagnosesBannerComponent implements OnInit {
  @Input({ required: true }) applicationId!: string;

  private readonly service = inject(CrashDiagnosesService);

  readonly latest = computed(() => this.service.unresolvedRecent()[0] ?? null);
  readonly othersCount = computed(() =>
    Math.max(0, this.service.unresolvedRecent().length - 1),
  );
  readonly bannerClass = computed(() =>
    this.latest() ? severityBannerClass(this.latest().severity) : '',
  );

  ngOnInit(): void {
    void (async () => {
      if (this.applicationId && this.service.diagnoses().length === 0) {
        await this.service.loadList(this.applicationId, { limit: 10 });
      }
    })();
  }
}
