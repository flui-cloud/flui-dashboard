import { SectionGroup } from '../../model/scaling-section.models';
import { GroupDraft } from './group-draft';

function draftWithCap(maxMonthlyCost: number | null): GroupDraft {
  return new GroupDraft({
    limits: { maxMonthlyCost, hourlyBillingOnly: true },
  } as unknown as SectionGroup);
}

describe('GroupDraft.setCost', () => {
  it('keeps a monthly ceiling above the node-count range', () => {
    const draft = draftWithCap(25);
    draft.setCost('30');
    expect(draft.group().limits.maxMonthlyCost).toBe(30);
    draft.setCost(250);
    expect(draft.group().limits.maxMonthlyCost).toBe(250);
  });

  it('keeps cents and accepts zero', () => {
    const draft = draftWithCap(25);
    draft.setCost('29.426');
    expect(draft.group().limits.maxMonthlyCost).toBe(29.43);
    draft.setCost(0);
    expect(draft.group().limits.maxMonthlyCost).toBe(0);
  });

  it('reads an empty field as no ceiling and refuses a negative one', () => {
    const draft = draftWithCap(25);
    draft.setCost('');
    expect(draft.group().limits.maxMonthlyCost).toBeNull();
    draft.setCost(-5);
    expect(draft.group().limits.maxMonthlyCost).toBeNull();
  });
});

describe('GroupDraft node limits', () => {
  const draft = () =>
    new GroupDraft({
      bounds: { min: 1, desired: 1, max: 5 },
      limits: { maxMonthlyCost: null, hourlyBillingOnly: true },
    } as unknown as SectionGroup);

  it('keeps a max above 20 and names it beside the field instead of dropping it', () => {
    const d = draft();
    d.setBound('max', 25);
    expect(d.group().bounds.max).toBe(25);
    expect(d.boundProblems().max).toBe('At most 20 nodes, master included.');
  });

  it('says when max sits below min, and when the target is outside them', () => {
    const d = draft();
    d.setBound('min', 3);
    d.setBound('max', 2);
    expect(d.boundProblems().max).toBe('Max nodes cannot be below min nodes.');
    d.setBound('max', 5);
    expect(d.boundProblems().desired).toBe('The target sits between min and max nodes.');
    d.setBound('desired', 3);
    expect(d.boundProblems()).toEqual({});
  });
});
