import { Routes } from '@angular/router';

/**
 * The fixture section, as a production build sees it: nothing.
 *
 * `angular.json` swaps this file in for `scaling-fixture.routes.ts` on the
 * production configuration. Guarding the route with `environment.production`
 * keeps the page unreachable, but the dynamic import still pulls the fixture
 * service and its invented clusters into a shipped chunk — replacing the
 * module is what actually leaves them out of the bundle.
 */
export const scalingFixtureRoutes: Routes = [];
