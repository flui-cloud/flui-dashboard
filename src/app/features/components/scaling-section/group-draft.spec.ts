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
