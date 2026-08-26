import { Route } from '@angular/router';
import { agentsRoutes } from './agents.routes';
import { routes } from './app.routes';

const DECIDE_PATH = 'settings/agents/requests';

const shellChildren = (): Route[] => {
  const shell = routes.find((r) => r.path === '' && r.children?.length);
  expect(shell).withContext('the authenticated shell route').toBeTruthy();
  return shell?.children ?? [];
};

describe('where a person answers an agent', () => {
  it('mounts the section on the path the API hands out', () => {
    const mount = shellChildren().find((r) => r.path === 'settings/agents');
    expect(mount).toBeTruthy();
    expect(mount?.children).toBe(agentsRoutes);
  });

  it('answers on the exact path a refusal deep-links to, with the request id', () => {
    const suffix = DECIDE_PATH.replace('settings/agents/', '');
    expect(agentsRoutes.map((r) => r.path)).toContain(`${suffix}/:proposalId`);
  });

  it('answers on the section root and on the requests path alike', () => {
    expect(agentsRoutes.map((r) => r.path)).toContain('');
    expect(agentsRoutes.map((r) => r.path)).toContain('requests');
  });

  it('is declared before the settings route it sits under', () => {
    const children = shellChildren();
    const agents = children.findIndex((r) => r.path === 'settings/agents');
    const settings = children.findIndex((r) => r.path === 'settings');
    expect(agents).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(-1);
    expect(agents).toBeLessThan(settings);
  });

  it('every path it serves loads a component', () => {
    for (const route of agentsRoutes) {
      expect(route.loadComponent).withContext(route.path ?? '').toBeDefined();
    }
  });
});
