import { ClusterOverviewTabComponent } from './cluster-overview-tab.component';

/**
 * Built off the prototype rather than through TestBed: this is a pure mapping,
 * and standing up the component would pull in every service it injects to test
 * six lines of switch.
 */
const dot = (status?: string): string =>
  (
    Object.create(
      ClusterOverviewTabComponent.prototype,
    ) as ClusterOverviewTabComponent
  ).nodeStatusDot(status);

describe('cluster overview — a node dot says what Flui knows', () => {
  it('is healthy only when the node actually joined', () => {
    expect(dot('ready')).toBe('dot-healthy');
  });

  it('shows a node that never joined as a problem', () => {
    // The case this exists for: the server is up, the bootstrap failed, and the
    // provider still calls it running.
    expect(dot('error')).toBe('dot-degraded');
  });

  it('shows work in progress as pending, not as health', () => {
    expect(dot('creating')).toBe('dot-pending');
    expect(dot('joining')).toBe('dot-pending');
    expect(dot('deleting')).toBe('dot-pending');
  });

  it('never calls a provider status healthy', () => {
    // `running` describes the machine, and a machine can be running with
    // nothing on it.
    expect(dot('running')).not.toBe('dot-healthy');
  });

  it('promises nothing about a value it does not recognise', () => {
    expect(dot(undefined)).toBe('dot-pending');
    expect(dot('something-new')).toBe('dot-pending');
  });
});
