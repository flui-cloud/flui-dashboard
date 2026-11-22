import { appDetailNav } from './app-detail-sections';

describe('appDetailNav', () => {
  const sections = [
    { label: 'Overview', route: 'overview' },
    { label: 'Monitoring', route: 'monitoring' },
    { label: 'Logs', route: 'logs' },
    { label: 'Releases', route: 'releases' },
    { label: 'Configuration', route: 'configuration' },
    { label: 'Backup', route: 'snapshots' },
    { label: 'Diagnoses', route: 'diagnoses' },
  ];

  it('groups the sections by task, overview first and empty groups left out', () => {
    const groups = appDetailNav(sections, { off: () => null, diagnoses: 0 });
    expect(groups.map((g) => g.label)).toEqual([null, 'Operate', 'Deliver', 'Configure', 'Data']);
    expect(groups[0].items.map((i) => i.label)).toEqual(['Overview']);
    expect(groups[1].items.map((i) => i.label)).toEqual(['Monitoring', 'Logs', 'Diagnoses']);
  });

  it('carries the reason a section is off and the open diagnoses count', () => {
    const groups = appDetailNav(sections, {
      off: (route) => (route === 'logs' ? 'Not running' : null),
      diagnoses: 2,
    });
    const operate = groups.find((g) => g.label === 'Operate')!.items;
    expect(operate.find((i) => i.label === 'Logs')!.disabledReason).toBe('Not running');
    expect(operate.find((i) => i.label === 'Diagnoses')!.count).toBe(2);
  });
});
