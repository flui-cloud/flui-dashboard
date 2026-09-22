import { Routes } from '@angular/router';
import { ScalingApiService } from './features/service/scaling-api.service';
import { ScalingFixtureService } from './features/service/scaling-fixture.service';
import { scalingRoutes } from './scaling.routes';

/**
 * The scaling section served from fixtures instead of the API.
 *
 * It is the deterministic target the visual bench captures against, and it is
 * mounted outside the authenticated shell — so in a production build it would
 * be an open page showing invented cluster data. `app.routes.ts` therefore
 * includes it only where `environment.production` is false, which lets the
 * bundler drop both this file and the fixture service from the shipped bundle.
 */
export const scalingFixtureRoutes: Routes = [
  {
    path: '',
    providers: [{ provide: ScalingApiService, useClass: ScalingFixtureService }],
    children: scalingRoutes,
  },
];
