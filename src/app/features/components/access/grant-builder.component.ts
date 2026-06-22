import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideCirclePlus, lucideInfo } from '@ng-icons/lucide';
import {
  HlmCardDirective,
  HlmCardContentDirective,
} from '@spartan-ng/ui-card-helm';
import { HlmBadgeDirective } from '@spartan-ng/ui-badge-helm';
import { IamService } from '../../service/iam.service';
import {
  AccessPrincipal,
  AccessRole,
  AccessScope,
  ScopeKind,
} from '../../model/iam.model';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none';

@Component({
  selector: 'app-grant-builder',
  standalone: true,
  imports: [
    NgIcon,
    HlmCardDirective,
    HlmCardContentDirective,
    HlmBadgeDirective,
  ],
  providers: [provideIcons({ lucideArrowRight, lucideCirclePlus, lucideInfo })],
  templateUrl: './grant-builder.component.html',
})
export class GrantBuilderComponent {
  protected readonly iam = inject(IamService);
  protected readonly selectClass = SELECT_CLASS;

  readonly principalKey = signal<string>('');
  readonly role = signal<AccessRole>('viewer');
  readonly scopeKind = signal<ScopeKind>('everything');
  readonly clusterId = signal<string>('');
  readonly project = signal<string>('');
  readonly kindValue = signal<string>('');
  readonly selectedApps = signal<string[]>([]);
  readonly sectionKey = signal<string>('');
  readonly selectedTags = signal<string[]>([]);

  readonly principal = computed<AccessPrincipal | null>(() => {
    const key = this.principalKey();
    if (!key) return null;
    const [type, ref] = key.split('::');
    return { type: type as AccessPrincipal['type'], ref };
  });

  readonly scope = computed<AccessScope | null>(() => {
    switch (this.scopeKind()) {
      case 'everything':
        return { type: 'global' };
      case 'kind':
        return this.kindValue()
          ? { type: 'selector', selector: { kind: this.kindValue() } }
          : null;
      case 'cluster':
        return this.clusterId() ? { type: 'cluster', cluster: this.clusterId() } : null;
      case 'project':
        return this.project() ? { type: 'selector', selector: { project: this.project() } } : null;
      case 'app':
        return this.selectedApps().length
          ? { type: 'selector', selector: { slugs: this.selectedApps() } }
          : null;
      case 'tag':
        return this.selectedTags().length
          ? { type: 'selector', selector: { tags: this.selectedTags() } }
          : null;
      case 'section':
        return this.sectionKey() ? { type: 'section', section: this.sectionKey() } : null;
    }
  });

  readonly matchedApps = computed(() => {
    const s = this.scope();
    return s ? this.iam.matchApps(s) : [];
  });

  readonly canSave = computed(() => !!this.principal() && !!this.scope());

  readonly compiled = computed(() => JSON.stringify(this.scope()));

  readonly sentence = computed(() => {
    const p = this.principal();
    if (!p) return 'Pick who this grant is for.';
    const who = this.iam.principalDisplay(p);
    const roleName = this.iam.roleName(this.role());
    return `${who} can ${roleName} on ${this.scopeLabel()}`;
  });

  private scopeLabel(): string {
    switch (this.scopeKind()) {
      case 'everything':
        return 'everything';
      case 'kind':
        return this.kindValue() ? `${this.kindValue().toLowerCase()} apps` : 'apps of a kind…';
      case 'cluster':
        return this.clusterId() ? `cluster ${this.iam.clusterName(this.clusterId())}` : 'a cluster…';
      case 'project':
        return this.project() ? `project ${this.project()}` : 'a project…';
      case 'app':
        return this.selectedApps().length ? `apps ${this.selectedApps().join(', ')}` : 'apps…';
      case 'tag':
        return this.selectedTags().length ? `apps tagged ${this.selectedTags().join(', ')}` : 'tagged apps…';
      case 'section':
        return this.sectionKey() ? `section ${this.iam.sectionName(this.sectionKey())}` : 'a section…';
    }
  }

  protected value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected titleCase(k: string): string {
    return k ? k.charAt(0).toUpperCase() + k.slice(1).toLowerCase() : k;
  }

  onPrincipal(e: Event): void {
    this.principalKey.set(this.value(e));
  }

  onRole(e: Event): void {
    this.role.set(this.value(e) as AccessRole);
  }

  onScopeKind(e: Event): void {
    this.scopeKind.set(this.value(e) as ScopeKind);
  }

  toggleTag(t: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t],
    );
  }

  toggleApp(slug: string): void {
    this.selectedApps.update((apps) =>
      apps.includes(slug) ? apps.filter((x) => x !== slug) : [...apps, slug],
    );
  }

  save(): void {
    const principal = this.principal();
    const scope = this.scope();
    if (!principal || !scope) return;
    this.iam.addGrant({ principal, role: this.role(), scope });
    this.clusterId.set('');
    this.project.set('');
    this.kindValue.set('');
    this.selectedApps.set([]);
    this.sectionKey.set('');
    this.selectedTags.set([]);
    this.scopeKind.set('everything');
  }
}
