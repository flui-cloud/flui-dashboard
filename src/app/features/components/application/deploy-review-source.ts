import { Component, computed, input, output } from '@angular/core';
import { ResourceProfileDto } from '../../../core/api/model/resourceProfileDto';
import { DefaultsSource, GhaDeployConfig } from '../../service/deploy-wizard-state.service';
import { FlKeyValue, FlKvItem } from '../../../ui/patterns/key-value';
import { ProbeType } from './deploy-env-health-check';
import { DeployReviewGroup } from './deploy-review-group';
import { profileCpu, profileLabel, profileMemory } from './deploy-profiles';

export type ReviewSourceKind = 'image' | 'template' | 'repo';

@Component({
  selector: 'app-deploy-review-source',
  imports: [FlKeyValue, FlKvItem, DeployReviewGroup],
  host: { class: 'fl-stack' },
  template: `
    @switch (kind()) {
      @case ('image') {
        <app-deploy-review-group
          title="Docker image"
          step="docker_image"
          [editable]="editable()"
          (edit)="edit.emit($event)"
        >
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Image" [mono]="true">{{ imageRef() }}</fl-kv-item>
            <fl-kv-item key="Pull policy" [mono]="true">IfNotPresent</fl-kv-item>
          </fl-key-value>
        </app-deploy-review-group>
        <app-deploy-review-group
          title="Configuration"
          step="environment"
          [editable]="editable()"
          (edit)="edit.emit($event)"
        >
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Port" [mono]="true">{{ port() }}</fl-kv-item>
            <fl-kv-item key="Replicas">{{ replicas() }}</fl-kv-item>
            @if (profile(); as p) {
              <fl-kv-item key="Profile"
                >{{ profileName() }}, <span class="fl-mono">{{ cpu(p) }}</span> CPU,
                <span class="fl-mono">{{ memory(p) }}</span> RAM</fl-kv-item
              >
            }
            <fl-kv-item key="Health check" [mono]="probeType() !== 'none'">{{
              probeSummary()
            }}</fl-kv-item>
            @if (internal()) {
              <fl-kv-item key="Exposure">Internal, behind Flui sign-in</fl-kv-item>
              @if (internalUrl(); as url) {
                <fl-kv-item key="Internal URL" [mono]="true">{{ url }}</fl-kv-item>
              }
            }
          </fl-key-value>
        </app-deploy-review-group>
      }
      @case ('template') {
        <app-deploy-review-group
          title="Template deploy"
          step="template-settings"
          [editable]="editable()"
          (edit)="edit.emit($event)"
        >
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Template">{{ templateName() }}</fl-kv-item>
            <fl-kv-item key="New repository" [mono]="true">{{ newRepo() }}</fl-kv-item>
            <fl-kv-item key="Visibility">{{ repoPrivate() ? 'Private' : 'Public' }}</fl-kv-item>
            <fl-kv-item key="Port"
              ><span class="fl-mono">{{ config().port }}</span>
              <span class="fl-muted">from template</span></fl-kv-item
            >
            <fl-kv-item key="Healthcheck" [mono]="true">{{ config().healthcheckPath }}</fl-kv-item>
            <fl-kv-item key="Resource profile">{{ configProfile() }}</fl-kv-item>
            @if (internal()) {
              <fl-kv-item key="Exposure">Internal, behind Flui sign-in</fl-kv-item>
              @if (internalUrl(); as url) {
                <fl-kv-item key="Internal URL" [mono]="true">{{ url }}</fl-kv-item>
              }
            }
          </fl-key-value>
        </app-deploy-review-group>
      }
      @default {
        <app-deploy-review-group
          title="Repository and build"
          step="repository"
          [editable]="editable()"
          (edit)="edit.emit($event)"
        >
          <fl-key-value class="fl-kv--compact">
            <fl-kv-item key="Repository" [mono]="true">{{ repoName() }}</fl-kv-item>
            <fl-kv-item key="Branch" [mono]="true">{{ branch() }}</fl-kv-item>
            <fl-kv-item key="Port"
              ><span class="fl-mono">{{ config().port || '—' }}</span>
              @if (portSource()) {
                <span class="fl-muted"> {{ portSource() }}</span>
              }
            </fl-kv-item>
            <fl-kv-item key="Healthcheck" [mono]="true">{{ config().healthcheckPath }}</fl-kv-item>
            <fl-kv-item key="Resource profile">{{ configProfile() }}</fl-kv-item>
            <fl-kv-item key="Replicas">{{ config().minReplicas }}</fl-kv-item>
            @if (manifestName()) {
              <fl-kv-item key="App name" [mono]="true">{{ manifestName() }}</fl-kv-item>
            } @else if (framework()) {
              <fl-kv-item key="Framework">{{ framework() }}</fl-kv-item>
            }
            @if (internal()) {
              <fl-kv-item key="Exposure">Internal, behind Flui sign-in</fl-kv-item>
              @if (internalUrl(); as url) {
                <fl-kv-item key="Internal URL" [mono]="true">{{ url }}</fl-kv-item>
              }
            }
          </fl-key-value>
        </app-deploy-review-group>
      }
    }
  `,
})
export class DeployReviewSource {
  readonly kind = input<ReviewSourceKind>('repo');
  readonly imageRef = input('');
  readonly port = input<number | null>(null);
  readonly replicas = input(1);
  readonly profile = input<ResourceProfileDto | null>(null);
  readonly probeType = input<ProbeType>('none');
  readonly probePath = input('/');
  readonly templateName = input('');
  readonly newRepo = input('');
  readonly repoPrivate = input(true);
  readonly config = input.required<GhaDeployConfig>();
  readonly repoName = input('');
  readonly branch = input('');
  readonly defaultsSource = input<DefaultsSource | null>(null);
  readonly manifestName = input<string | null>(null);
  readonly framework = input('');
  readonly internal = input(false);
  readonly internalUrl = input<string | null>(null);
  readonly editable = input<readonly string[]>([]);
  readonly edit = output<string>();

  protected readonly cpu = profileCpu;
  protected readonly memory = profileMemory;

  protected readonly profileName = computed(() => {
    const p = this.profile();
    return p ? profileLabel(p.name) : '';
  });

  protected readonly configProfile = computed(() => {
    const name = this.config().resourceProfile;
    return name.charAt(0).toUpperCase() + name.slice(1);
  });

  protected readonly portSource = computed(() => {
    switch (this.defaultsSource()) {
      case 'manifest':
        return 'from flui.yaml';
      case 'manual':
        return 'manual';
      default:
        return '';
    }
  });

  protected readonly probeSummary = computed(() => {
    switch (this.probeType()) {
      case 'http':
        return `HTTP GET ${this.probePath()} :${this.port() ?? ''}`;
      case 'tcp':
        return `TCP :${this.port() ?? ''}`;
      default:
        return 'Disabled';
    }
  });
}
