import { CapacityAdvice, adviceView } from './app-capacity-advice.service';

describe('adviceView', () => {
  it('names an action for every advice that asks for one', () => {
    const act: CapacityAdvice[] = ['add_replicas', 'add_node', 'raise_autoscale_max', 'one_copy_only'];
    for (const advice of act) expect(adviceView(advice)!.tone).toBe('act');
  });

  it('keeps calm for copies that keep up and stays silent when nothing was measured', () => {
    expect(adviceView('none')).toEqual({ title: 'Copies keep up', tone: 'ok' });
    expect(adviceView('unknown')).toBeNull();
  });

  it('marks what is already under way as a wait', () => {
    for (const advice of ['wait_for_node', 'autoscaler_adding', 'watch_memory'] as CapacityAdvice[]) {
      expect(adviceView(advice)!.tone).toBe('wait');
    }
  });
});
