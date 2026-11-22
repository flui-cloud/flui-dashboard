import { ResourceNavGroup, ResourceNavItem } from '../../../ui/frame/resource-nav';

export interface DetailSection {
  readonly label: string;
  readonly route: string;
}

const GROUP_OF: Record<string, string> = {
  monitoring: 'Operate',
  logs: 'Operate',
  diagnoses: 'Operate',
  'debug-pods': 'Operate',
  sessions: 'Operate',
  revisions: 'Deliver',
  builds: 'Deliver',
  releases: 'Deliver',
  configuration: 'Configure',
  resources: 'Configure',
  dns: 'Configure',
  clients: 'Configure',
  identity: 'Configure',
  gateway: 'Configure',
  messaging: 'Configure',
  schedules: 'Configure',
  snapshots: 'Data',
};

const ORDER = ['Operate', 'Deliver', 'Configure', 'Data'];

export interface SectionState {
  readonly off: (route: string) => string | null;
  readonly diagnoses: number;
}

export function appDetailNav(
  sections: readonly DetailSection[],
  state: SectionState,
): ResourceNavGroup[] {
  const item = (s: DetailSection): ResourceNavItem => ({
    label: s.label,
    link: [s.route],
    disabledReason: state.off(s.route),
    count: s.route === 'diagnoses' && state.diagnoses > 0 ? state.diagnoses : null,
    testId: s.route,
  });
  const ungrouped = sections.filter((s) => !GROUP_OF[s.route]).map(item);
  const groups = ORDER.map((label) => ({
    label,
    items: sections.filter((s) => GROUP_OF[s.route] === label).map(item),
  })).filter((g) => g.items.length > 0);
  return [{ label: null, items: ungrouped }, ...groups];
}
