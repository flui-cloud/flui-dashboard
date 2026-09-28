import type { AppGroupView, ApplicationKind } from '../../model/application.models';
import { EMPTY_FILTERS, activeFilterCount, deployTarget, kindCopy, listSummary, providerName } from './applications-list-kind';

const kind = (k: string) => k as ApplicationKind;

describe('applications list kind', () => {
  it('words the call to action, the empty state and the list name per kind', () => {
    expect(kindCopy(kind('DATABASE'))).toEqual({
      cta: 'Add Database',
      emptyTitle: 'No databases found',
      emptySubtitle: 'Deploy your first database to get started',
      listName: 'databases',
    });
    expect(kindCopy(kind('SYSTEM')).listName).toBe('system');
    expect(kindCopy(kind('APPLICATION')).cta).toBe('Add Application');
  });

  it('sends databases and tools to the catalog, everything else to the deploy wizard', () => {
    expect(deployTarget(kind('TOOL'))).toBe('/apps/catalog');
    expect(deployTarget(kind('APPLICATION'))).toBe('/apps/deploy/new');
  });

  it('names the provider from its definition, a known name, or as written', () => {
    expect(providerName(undefined, () => 'x')).toBe('');
    expect(providerName('hetzner', () => undefined)).toBe('Hetzner');
    expect(providerName('acme', () => undefined)).toBe('acme');
    expect(providerName('ovh', () => 'OVHcloud')).toBe('OVHcloud');
  });

  it('counts apps and clusters in the summary', () => {
    const g = (clusterId: string) => ({ clusterId }) as AppGroupView;
    expect(listSummary([], 'Applications')).toBe('No applications yet');
    expect(listSummary([g('c1')], 'Applications')).toBe('1 application on 1 cluster');
    expect(listSummary([g('c1'), g('c2')], 'Databases')).toBe('2 databases on 2 clusters');
  });

  it('counts each active filter once', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ search: 'x', view: 'running', cluster: 'c1', project: 'p' })).toBe(4);
  });
});
