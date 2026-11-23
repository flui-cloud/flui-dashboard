import { Crumb } from '../../../ui/patterns/breadcrumb';
import { ApplicationService } from '../../service/application.service';

export function storeNameOf(apps: ApplicationService, id: string | null): string | null {
  if (!id) return null;
  const listed = apps.applications().find((app) => app.id === id);
  if (listed?.name) return listed.name;
  const selected = apps.selectedApplication();
  return selected?.id === id ? (selected.name ?? null) : null;
}

export function storeConsoleCrumbs(id: string | null, name: string | null): Crumb[] {
  return [
    { label: 'Data stores', link: '/apps/data' },
    { label: name ?? id ?? 'Data store', link: id ? ['/apps/applications', id] : undefined },
    { label: 'Console' },
  ];
}
