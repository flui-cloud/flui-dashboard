import type {
  CutoverMode,
  DbMigrationMode,
  MigrationType,
  StagingMode,
} from '../../service/migration.service';

export interface LaunchOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description: string;
}

export const TYPE_OPTIONS: readonly LaunchOption<MigrationType>[] = [
  { value: 'app', label: 'App', description: 'A workload and its volumes' },
  { value: 'db', label: 'Database', description: 'A managed database' },
  { value: 'full', label: 'Full app', description: 'An app and its database, cut over together' },
];

export const CUTOVER_OPTIONS: readonly LaunchOption<CutoverMode>[] = [
  { value: 'auto', label: 'Automatic', description: 'Cut over as soon as it is ready' },
  { value: 'manual', label: 'Manual', description: 'Wait, then cut over on your signal' },
];

export const MODE_OPTIONS: readonly LaunchOption<DbMigrationMode>[] = [
  { value: 'live', label: 'Live', description: 'Stream from the running database' },
  { value: 'restore', label: 'Restore', description: 'Rebuild from a backup or a point in time' },
];

export const STAGING_OPTIONS: readonly LaunchOption<StagingMode>[] = [
  { value: 'scaled-down', label: 'Scaled down', description: 'Stage the app at zero replicas' },
  {
    value: 'live-fenced',
    label: 'Live fenced',
    description: 'Stage at full replicas against a read-only database',
  },
];
