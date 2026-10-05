import type { AppGroupView } from '../../model/application.models';
import { EMPTY_FILTERS, activeFilterCount, listCopy, listSummary, providerName } from './applications-list-kind';

describe('applications list kind', () => {
  it('words the title and the empty state per list', () => {
    expect(listCopy('data').title).toBe('Data');
    expect(listCopy('data').emptyTitle).toBe('No data stores yet');
    expect(listCopy('applications').emptyTitle).toBe('No applications yet');
    expect(listCopy('system').title).toBe('System');
  });

  it('names the provider from its definition, a known name, or as written', () => {
    expect(providerName(undefined, () => 'x')).toBe('');
    expect(providerName('hetzner', () => undefined)).toBe('Hetzner');
    expect(providerName('acme', () => undefined)).toBe('acme');
    expect(providerName('ovh', () => 'OVHcloud')).toBe('OVHcloud');
  });

  it('counts apps and clusters in the summary', () => {
    const g = (clusterId: string) => ({ clusterId }) as AppGroupView;
    expect(listSummary([], 'applications')).toBe('No applications yet');
    expect(listSummary([g('c1')], 'applications')).toBe('1 application on 1 cluster');
    expect(listSummary([g('c1'), g('c2')], 'data')).toBe('2 data stores on 2 clusters');
  });

  it('counts each active filter once', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ search: 'x', view: 'running', type: 'tool', cluster: 'c1', project: 'p' })).toBe(5);
  });
});
