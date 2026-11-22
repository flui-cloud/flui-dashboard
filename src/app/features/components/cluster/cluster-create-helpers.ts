import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { NameAvailability } from '../../service/cluster-name-availability.service';

export type CheckClusterName = (name: string, provider: string) => Promise<NameAvailability>;

interface NamedCluster {
  readonly name?: string | null;
}

export async function suggestClusterName(
  clusters: readonly NamedCluster[],
  provider: string,
  check: CheckClusterName,
): Promise<string> {
  const existingNames = new Set(clusters.map((c) => c.name?.toLowerCase() || ''));
  let counter = 1;
  let suggestedName = `workload-cluster-${counter}`;

  for (let attempt = 0; attempt < 50; attempt++) {
    while (existingNames.has(suggestedName.toLowerCase())) {
      counter++;
      suggestedName = `workload-cluster-${counter}`;
    }

    if (!provider) break;
    try {
      const availability = await check(suggestedName, provider);
      if (availability.available) break;
    } catch {
      break;
    }

    counter++;
    suggestedName = `workload-cluster-${counter}`;
  }
  return suggestedName;
}

export function clusterNameValidator(
  clusters: () => readonly NamedCluster[],
  provider: () => string,
  check: CheckClusterName,
): AsyncValidatorFn {
  return async (control: AbstractControl): Promise<ValidationErrors | null> => {
    if (!control.value) return null;

    const existingNames = clusters().map((c) => c.name?.toLowerCase() || '');
    if (existingNames.includes(control.value.toLowerCase())) {
      return { nameExists: true };
    }

    const selected = provider();
    if (!selected) return null;

    try {
      const availability = await check(control.value, selected);
      return availability.available ? null : { providerCollision: availability.reason };
    } catch {
      return null;
    }
  };
}

export function createClusterErrorMessage(error: {
  error?: { code?: string; message?: string };
  message?: string;
}): string {
  const body = error?.error;
  switch (body?.code) {
    case 'CROSS_PROVIDER_NOT_ALLOWED':
      return (
        body.message ??
        'No private path is available between this provider and the control cluster.'
      );
    case 'VNET_REQUIRED':
      return body.message ?? 'This provider requires a VNet/Subnet selection.';
    default:
      return body?.message ?? error?.message ?? 'Failed to create cluster';
  }
}

export function tagsWithClusterId(
  tags: Record<string, unknown> | null | undefined,
  clusterId: string,
): Record<string, unknown> {
  const existingTags = tags ?? {};
  const current = existingTags['cluster-id'];
  let existingClusterIds: unknown[];
  if (Array.isArray(current)) existingClusterIds = current;
  else if (current) existingClusterIds = [current];
  else existingClusterIds = [];

  const updatedClusterIds = existingClusterIds.includes(clusterId)
    ? existingClusterIds
    : [...existingClusterIds, clusterId];
  return { ...existingTags, 'cluster-id': updatedClusterIds };
}
