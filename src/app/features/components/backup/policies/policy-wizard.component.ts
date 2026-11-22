import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BackupService } from '../../../service/backup.service';
import { ClusterService } from '../../../service/cluster.service';
import {
  BackupPolicyProfile,
  BackupScope,
  inferProfile,
  validatePolicyDestinations,
} from '../../../model/backup.models';
import { policyEngineLabel } from '../../../model/backup-protection.models';
import { CreateBackupPolicyDto } from '../../../../core/api/model/createBackupPolicyDto';
import { PolicyDestinationInputDto } from '../../../../core/api/model/policyDestinationInputDto';
import { AppOption, PolicyAppPickerComponent } from './policy-app-picker.component';
import { PROFILE_DESCRIPTION, policyDtoOf } from './policy-wizard.dto';
import { DestinationFormComponent } from '../destinations/destination-form.component';
import { DeployReviewGroup } from '../../application/deploy-review-group';
import { describeCron } from '../../application/cron-text';
import { formatUtcDateTime } from '../../../model/backup-activity';
import { Crumb } from '../../../../ui/patterns/breadcrumb';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlField } from '../../../../ui/patterns/field';
import { FlKeyValue, FlKvItem } from '../../../../ui/patterns/key-value';
import { FlPageHeader } from '../../../../ui/patterns/page-header';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlEmptyState } from '../../../../ui/patterns/states';
import { FlWizardSteps, WizardStep } from '../../../../ui/patterns/wizard-steps';
import { FlButton } from '../../../../ui/primitives/button';
import { FlSpinner } from '../../../../ui/primitives/spinner';
import { copiesRetentionText, nextRunIso, scopeLabel, volumeRetentionText } from './policy-text';

const STEPS = ['What to protect', 'Schedule', 'Destinations', 'Review'];

const ENGINES: { id: CreateBackupPolicyDto.EngineClassEnum; title: string; description: string }[] =
  [
    {
      id: 'volume_copy',
      title: 'Volume backups',
      description:
        "Encrypted snapshots of one app's volumes. Keeps 7 daily and 4 weekly snapshots. To protect every app at once, use Protect this cluster.",
    },
    {
      id: 'database',
      title: 'Database',
      description:
        'Continuous backup where the image allows, nightly dumps otherwise. One destination, no replicas.',
    },
    { id: 'platform', title: 'Flui itself', description: 'The control-plane database.' },
  ];

interface WizardDestination {
  destinationId: string;
  role: 'primary' | 'replica';
  priority: number;
}

@Component({
  selector: 'app-policy-wizard',
  imports: [
    FormsModule,
    RouterLink,
    PolicyAppPickerComponent,
    DestinationFormComponent,
    DeployReviewGroup,
    FlAlert,
    FlField,
    FlKeyValue,
    FlKvItem,
    FlPageHeader,
    FlPanel,
    FlEmptyState,
    FlWizardSteps,
    FlButton,
    FlSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './policy-wizard.component.html',
})
export class PolicyWizardComponent implements OnInit {
  protected readonly backup = inject(BackupService);
  private readonly clusterService = inject(ClusterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumb: readonly Crumb[] = [
    { label: 'Backups', link: '/management/backup' },
    { label: 'Policies', link: '/management/backup/policies' },
    { label: 'New policy' },
  ];
  protected readonly stepNames = STEPS;
  protected readonly engines = ENGINES;
  protected readonly editable = ['1', '2', '3'];
  protected readonly scopeLabel = scopeLabel;

  readonly clusters = this.clusterService.clusters;
  readonly profiles: BackupPolicyProfile[] = ['single', 'mirrored', 'custom'];

  readonly step = signal(1);
  readonly creatingDestination = signal(false);
  private readonly destinationsLoaded = signal(false);
  readonly noDestinations = computed(
    () => this.destinationsLoaded() && this.backup.destinations().length === 0,
  );
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly destinations = signal<WizardDestination[]>([
    { destinationId: '', role: 'primary', priority: 0 },
  ]);

  namespacesText = '';
  labelSelector = '';
  readonly selectedApps = signal<string[]>([]);
  private readonly appChoices = signal<AppOption[]>([]);
  private autoName = false;
  pauseDuringCopy = false;
  keepMonthly = false;

  form: CreateBackupPolicyDto = {
    name: '',
    clusterId: '',
    scope: 'applications' as BackupScope,
    engineClass: 'volume_copy',
    cronSchedule: '',
    retentionDays: 30,
    retentionMaxCopies: 14,
    profile: 'single' as BackupPolicyProfile,
    destinations: [],
  };

  readonly engineLabel = policyEngineLabel;

  /** Database and volume backups protect exactly one application. */
  perApp(): boolean {
    return this.form.engineClass === 'database' || this.form.engineClass === 'volume_copy';
  }

  onEngineClassChange(engineClass: CreateBackupPolicyDto.EngineClassEnum): void {
    if (engineClass === 'database' || engineClass === 'volume_copy') {
      this.form.scope = 'applications' as BackupScope;
      this.selectedApps.update((ids) => ids.slice(0, 1));
    }
    if (engineClass === 'database') {
      this.destinations.update((list) =>
        list.slice(0, 1).map((d) => ({ ...d, role: 'primary' as const })),
      );
    }
  }

  readonly inferredProfile = computed(() => inferProfile(this.destinations()));
  readonly validationError = computed(() => {
    const list = this.destinations()
      .filter((d) => d.destinationId)
      .map<PolicyDestinationInputDto>((d, i) => ({
        destinationId: d.destinationId,
        role: d.role,
        priority: i,
      }));
    const base = validatePolicyDestinations(list);
    if (base) return base;
    if (this.form.engineClass === 'database' && list.length > 1) {
      return 'A database-class policy supports only a single (primary) destination.';
    }
    return null;
  });

  ngOnInit(): void {
    this.prefillFromLink();
    void this.clusterService.loadClusters().catch(() => undefined);
    void this.backup
      .loadDestinations()
      .then(() => this.destinationsLoaded.set(!this.backup.error()));
  }

  /** A destination made from inside the wizard fills the first empty row, or joins as a replica. */
  onDestinationCreated(id: string): void {
    this.creatingDestination.set(false);
    this.destinations.update((list) => {
      const empty = list.findIndex((d) => !d.destinationId);
      let next: WizardDestination[];
      if (empty >= 0) next = list.map((d, i) => (i === empty ? { ...d, destinationId: id } : d));
      else if (this.form.engineClass === 'database' && list.length > 0)
        next = [{ ...list[0], destinationId: id }];
      else next = [...list, { destinationId: id, role: 'replica', priority: list.length }];
      if (!next.some((d) => d.role === 'primary'))
        next = next.map((d, i) => (i === 0 ? { ...d, role: 'primary' } : d));
      return next;
    });
  }

  /** "Protect" from the home opens this with the cluster and the app already chosen. */
  private prefillFromLink(): void {
    const params = this.route.snapshot.queryParamMap;
    const clusterId = params.get('clusterId');
    const applicationId = params.get('applicationId');
    if (clusterId) this.form.clusterId = clusterId;
    if (params.get('engineClass') === 'database') {
      this.form.engineClass = 'database';
      this.onEngineClassChange('database');
    }
    if (applicationId) {
      this.form.scope = 'applications' as BackupScope;
      this.selectedApps.set([applicationId]);
      this.autoName = !this.form.name;
    }
  }

  onAppsLoaded(options: AppOption[]): void {
    this.appChoices.set(options);
    const only = options.find((a) => a.id === this.selectedApps()[0]);
    if (this.autoName && only) {
      this.form.name = `protect-${only.slug}`;
      this.autoName = false;
      if (only.database && this.form.engineClass !== 'database') {
        this.form.engineClass = 'database';
        this.onEngineClassChange('database');
      }
    }
  }

  appNames(): string {
    const byId = new Map(this.appChoices().map((a) => [a.id, a.name]));
    return this.selectedApps()
      .map((id) => byId.get(id) ?? id)
      .join(', ');
  }

  protected wizardSteps(): WizardStep[] {
    return [
      { name: STEPS[0], summary: this.form.name || undefined },
      { name: STEPS[1], summary: this.scheduleText() },
      { name: STEPS[2], summary: this.destinationSummary() },
      { name: STEPS[3] },
    ];
  }

  protected goTo(step: number): void {
    this.step.set(step);
  }

  protected selectEngine(engineClass: CreateBackupPolicyDto.EngineClassEnum): void {
    this.form.engineClass = engineClass;
    this.onEngineClassChange(engineClass);
  }

  protected scheduleText(): string {
    return this.form.cronSchedule ? describeCron(this.form.cronSchedule) : 'Default nightly time';
  }

  protected nextRunText(): string | null {
    const next = nextRunIso(this.form.cronSchedule);
    return next ? formatUtcDateTime(next) : null;
  }

  protected retentionText(): string {
    return this.form.engineClass === 'volume_copy'
      ? volumeRetentionText(this.keepMonthly)
      : copiesRetentionText(this.form.retentionDays ?? 0, this.form.retentionMaxCopies);
  }

  protected destinationSummary(): string | undefined {
    const names = this.destinations()
      .filter((d) => d.destinationId)
      .map((d) => this.destName(d.destinationId));
    return names.length ? names.join(', ') : undefined;
  }

  protected profileTitle(p: BackupPolicyProfile): string {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  profileDescription(p: BackupPolicyProfile): string {
    return PROFILE_DESCRIPTION[p];
  }

  canAdvance(): boolean {
    if (this.step() === 1) {
      if (!this.form.name || !this.form.clusterId) return false;
      const apps = this.selectedApps().length;
      if (this.form.scope === 'applications' && apps === 0) return false;
      return !this.perApp() || apps === 1;
    }
    if (this.step() === 3) return !this.validationError();
    return true;
  }

  next(): void {
    this.step.update((s) => Math.min(4, s + 1));
  }
  prev(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  addDestination(): void {
    this.destinations.update((list) => [
      ...list,
      { destinationId: '', role: 'replica', priority: list.length },
    ]);
  }

  removeDestination(i: number): void {
    this.destinations.update((list) => list.filter((_, idx) => idx !== i));
  }

  /**
   * Mutating `d.destinationId` in place (the old [(ngModel)] binding) never
   * marks the `destinations` signal dirty, so `validationError` — a
   * `computed()` — never recomputes and Step 3 stays stuck on "at least one
   * destination is required" forever. Replace, don't mutate.
   */
  setDestinationField(i: number, field: 'destinationId' | 'role', value: string): void {
    this.destinations.update((list) =>
      list.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );
  }

  destName(id: string): string {
    return this.backup.destinations().find((d) => d.id === id)?.name ?? '—';
  }

  clusterName(id: string): string {
    return this.clusters().find((c) => c.id === id)?.name ?? id;
  }

  async onSubmit(): Promise<void> {
    this.submitError.set(null);
    this.submitting.set(true);

    const dto = policyDtoOf({
      form: this.form,
      profile: this.inferredProfile(),
      destinations: this.destinations(),
      pauseDuringCopy: this.pauseDuringCopy,
      keepMonthly: this.keepMonthly,
      namespacesText: this.namespacesText,
      labelSelector: this.labelSelector,
      applicationIds: this.selectedApps(),
    });
    const created =
      this.form.engineClass === 'database'
        ? await this.backup.enableDatabase(dto)
        : await this.backup.createPolicy(dto);
    this.submitting.set(false);
    if (!created) {
      this.submitError.set(this.backup.error() ?? 'Creation failed');
      return;
    }
    this.router.navigate(['/management/backup/policies', created.id]);
  }
}
