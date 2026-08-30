import { Injectable, inject } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { InfrastructureClustersService } from '../../../../core/api/api/infrastructureClusters.service';
import { ApplicationsService } from '../../../../core/api/api/applications.service';

export interface SelectableApplication {
  id: string;
  name: string;
  clusterName: string;
  category: 'user' | 'system';
}

/**
 * Every application a key could plausibly be scoped to, flattened out of
 * clusters × groups × components.
 *
 * A composed install (Nextcloud, say) is one row in the group listing but
 * several `ApplicationEntity` rows underneath — and `AppAccessGuard` checks
 * the ceiling against the real row id, never the group id. So the picker
 * offers components, not groups: scoping a key to "Nextcloud" has to mean
 * every component the guard will actually see it ask for, not the id of a
 * row the guard never loads.
 */
@Injectable({ providedIn: 'root' })
export class AgentKeyApplicationsService {
  private readonly clustersApi = inject(InfrastructureClustersService);
  private readonly appsApi = inject(ApplicationsService);

  list() {
    return this.clustersApi.clustersControllerListClusters().pipe(
      switchMap((clusters) => {
        if (!clusters.length) return of([] as SelectableApplication[]);
        return forkJoin(
          clusters.map((cluster) =>
            this.appsApi
              .applicationsControllerListGroupedByCluster(cluster.id)
              .pipe(
                map((groups) =>
                  groups.flatMap((group) =>
                    group.components.map((component) => ({
                      id: component.id,
                      name:
                        group.components.length > 1
                          ? `${group.name} — ${component.name}`
                          : group.name,
                      clusterName: cluster.name,
                      category:
                        group.category === 'system'
                          ? ('system' as const)
                          : ('user' as const),
                    })),
                  ),
                ),
              ),
          ),
        ).pipe(map((perCluster) => perCluster.flat()));
      }),
    );
  }
}
