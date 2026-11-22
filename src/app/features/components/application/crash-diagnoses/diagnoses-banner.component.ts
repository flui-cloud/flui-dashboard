import { Component, OnInit, computed, inject, input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { AlertTone, FlAlert } from '../../../../ui/patterns/alert';
import { CrashDiagnosesService } from '../../../service/crash-diagnoses.service';

@Component({
  selector: 'app-diagnoses-banner',
  imports: [RouterLink, FlAlert],
  template: `
    @if (latest(); as d) {
      <fl-alert [tone]="tone()" [title]="d.title">
        {{ sentence() }}
        <a
          alertActions
          class="fl-link text-fl-body-sm"
          [routerLink]="['/apps/applications', applicationId(), 'diagnoses']"
          >{{ linkLabel() }}</a
        >
      </fl-alert>
    }
  `,
})
export class DiagnosesBannerComponent implements OnInit {
  readonly applicationId = input.required<string>();

  private readonly service = inject(CrashDiagnosesService);

  readonly latest = computed(() => this.service.unresolvedRecent()[0] ?? null);
  readonly othersCount = computed(() => Math.max(0, this.service.unresolvedRecent().length - 1));
  readonly tone = computed<AlertTone>(() =>
    this.latest()?.severity === 'critical' ? 'error' : 'warning',
  );
  readonly sentence = computed(() => firstSentence(this.latest()?.explanation ?? ''));
  readonly linkLabel = computed(() => {
    const others = this.othersCount();
    if (others === 0) return 'View diagnosis';
    return `View all ${others + 1} diagnoses`;
  });

  ngOnInit(): void {
    void (async () => {
      const applicationId = this.applicationId();
      if (applicationId && this.service.diagnoses().length === 0) {
        await this.service.loadList(applicationId, { limit: 10 });
      }
    })();
  }
}

function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](\s|$)/);
  return end === -1 ? flat : flat.slice(0, end + 1);
}
