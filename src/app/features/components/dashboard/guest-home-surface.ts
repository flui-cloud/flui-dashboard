import type {
  Observation,
  SemanticScopeSnapshot,
  SurfaceSnapshot,
} from '@flui-cloud/semantic-surface';
import {
  SURFACE_APP_ID,
  buildSurfaceList,
  scopeIdPart,
  textObservation,
  valueObservation,
} from '../../../shared/utils/surface-kit';
import { applicationEntityRef } from '../application/application-surface';
import type {
  SandboxArea,
  SandboxQuota,
} from '../../../core/services/sandbox.service';

/* Semantic Surface for a demo guest's Home.
 *
 * The guest's first screen is not the operator's control room, so it carries its own
 * content under the same surface id: the showcase applications, the guest's own space
 * and its limits, what a visitor can do, and which trial areas show example data or
 * are not part of the trial. */

const PAGE_ID = 'guest-home';

export interface GuestHomeSurfaceInput {
  loading: boolean;
  showcase: {
    id: string;
    name: string;
    note: string | null;
    hasLink: boolean;
  }[];
  hasArea: boolean;
  visitor: boolean;
  ownApps: { id: string; name: string; status: string }[];
  workloadTtlHours: number | null;
  quota: SandboxQuota | null;
  areas: SandboxArea[];
  exploreText: string;
  installText: string;
  installWays: string[];
}

export interface GuestHomeSurfaceContext {
  revision: number;
  generatedAt: string;
}

function keep(observations: (Observation | null)[]): Observation[] {
  return observations.filter((o): o is Observation => o !== null);
}

function areaNames(
  areas: SandboxArea[],
  level: SandboxArea['level'],
): string | null {
  const names = areas.filter((a) => a.level === level).map((a) => a.area);
  return names.length ? names.join(', ') : null;
}

export function guestHomeContent(input: GuestHomeSurfaceInput): {
  scopes: SemanticScopeSnapshot[];
  attention: SurfaceSnapshot['attention'];
} {
  const quota = input.quota
    ? `CPU ${input.quota.cpu}, memory ${input.quota.memory}, disk ${input.quota.storage}`
    : null;
  const pageScope: SemanticScopeSnapshot = {
    id: PAGE_ID,
    kind: 'page',
    label: 'Home (demo)',
    observations: keep([
      textObservation('flui.guest_home.explore', input.exploreText, 'ui'),
      textObservation('flui.guest_home.install', input.installText, 'ui'),
      textObservation(
        'flui.guest_home.install_ways',
        input.installWays.join('; '),
        'ui',
      ),
      textObservation(
        'flui.guest_home.visitor',
        input.visitor ? 'visitor without an account: read-only' : null,
        'api',
      ),
      textObservation(
        'flui.guest_home.example_data_sections',
        areaNames(input.areas, 'stand-in'),
        'ui',
      ),
      textObservation(
        'flui.guest_home.read_only_sections',
        areaNames(input.areas, 'read-only'),
        'ui',
      ),
      textObservation(
        'flui.guest_home.closed_sections',
        areaNames(input.areas, 'closed'),
        'ui',
      ),
    ]),
    state: { loading: input.loading },
  };

  const scopes: SemanticScopeSnapshot[] = [pageScope];
  if (!input.loading) {
    scopes.push(
      ...buildSurfaceList({
        listId: `${PAGE_ID}:showcase`,
        parentId: PAGE_ID,
        label: 'In the showcase',
        totalCount: input.showcase.length,
        listObservations: [
          textObservation(
            'flui.guest_home.showcase_note',
            'real applications, running',
            'ui',
          ),
        ],
        rows: input.showcase.map((app) => ({
          id: `${PAGE_ID}:showcase:${scopeIdPart(app.id)}`,
          ref: applicationEntityRef(app.id),
          label: app.name,
          observations: keep([
            textObservation(
              'flui.guest_home.showcase_description',
              app.note,
              'api',
            ),
            app.hasLink
              ? textObservation(
                  'flui.guest_home.showcase_open',
                  'Open it',
                  'ui',
                )
              : null,
          ]),
        })),
      }).scopes,
    );
    if (input.hasArea) {
      scopes.push(
        ...buildSurfaceList({
          listId: `${PAGE_ID}:your-space`,
          parentId: PAGE_ID,
          label: 'Your space',
          totalCount: input.ownApps.length,
          listObservations: [
            input.workloadTtlHours !== null
              ? valueObservation(
                  'flui.guest_home.removed_after_idle',
                  input.workloadTtlHours,
                  'api',
                  'h',
                )
              : null,
            textObservation('flui.guest_home.quota', quota, 'api'),
          ],
          rows: input.ownApps.map((app) => ({
            id: `${PAGE_ID}:your-space:${scopeIdPart(app.id)}`,
            ref: applicationEntityRef(app.id),
            label: app.name,
            observations: keep([
              textObservation('flui.application.status', app.status, 'api'),
            ]),
          })),
        }).scopes,
      );
    }
  }
  return { scopes, attention: [{ scopeId: PAGE_ID, reason: 'route' }] };
}

export function buildGuestHomeSurface(
  input: GuestHomeSurfaceInput,
  context: GuestHomeSurfaceContext,
): SurfaceSnapshot {
  const content = guestHomeContent(input);
  return {
    schemaVersion: '0.2',
    app: { id: SURFACE_APP_ID },
    surface: {
      id: 'dashboard',
      route: 'dashboard',
      revision: context.revision,
      generatedAt: context.generatedAt,
    },
    attention: content.attention,
    scopes: content.scopes,
  };
}
