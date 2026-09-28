import type { AppGroupView, Application } from '../../model/application.models';
import { backLabel, backLink, endpointHostOf, headerMeta, hostnameOf, kindChip, listRouteForKind, openUrlOf } from './app-recap-header';

const primary = { id: 'p', kind: 'DATABASE', sourceType: 'docker_image', imageRef: 'postgres:16', labels: {} } as unknown as Application;
const group = (over: Partial<AppGroupView> = {}): AppGroupView =>
  ({ id: 'g', type: 'standalone', name: 'g', clusterId: 'c1', createdAt: 'not a date', components: [primary], ...over }) as AppGroupView;

describe('app recap header', () => {
  it('goes back to the list of the primary kind, or to the catalog it came from', () => {
    expect(listRouteForKind('DATABASE' as Application['kind'])).toBe('/apps/databases');
    expect(listRouteForKind(undefined)).toBe('/apps/applications');
    expect(backLink('catalog', 'TOOL' as Application['kind'])).toBe('/apps/catalog');
    expect(backLink(null, 'TOOL' as Application['kind'])).toBe('/apps/tools');
    expect(backLabel('catalog', undefined)).toBe('Back to catalog');
  });

  it('labels a bundle by its component count and a single app by its kind', () => {
    expect(kindChip(group({ type: 'composed' as AppGroupView['type'], components: [primary, primary] }), primary)).toBe('Bundle · 2 components');
    expect(kindChip(group(), primary)).toBe('Database');
  });

  it('heads a single image app with its image, the cluster and the creation date as written when unparseable', () => {
    expect(headerMeta(group(), primary, 'wc-1')).toEqual([
      { text: 'postgres:16', mono: true },
      { text: 'wc-1', mono: false },
      { text: 'created not a date', mono: false },
    ]);
  });

  it('reads the endpoint host and downgrades the link when the endpoint has no TLS', () => {
    expect(endpointHostOf('https://a.example.com/')).toBe('a.example.com');
    expect(hostnameOf('https://a.example.com/x')).toBe('a.example.com');
    expect(openUrlOf('https://a.example.com', false)).toBe('http://a.example.com');
    expect(openUrlOf('https://a.example.com', null)).toBe('https://a.example.com');
    expect(openUrlOf('', true)).toBe('');
  });
});
