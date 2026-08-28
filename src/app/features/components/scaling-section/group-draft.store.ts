import { Injectable, inject } from '@angular/core';
import { GroupDraft } from './group-draft';
import { ScalingGroupStore } from './scaling-group.store';

@Injectable()
export class GroupDraftStore {
  private readonly groups = inject(ScalingGroupStore);
  private readonly open = new Map<string, GroupDraft>();

  draft(groupId: string | null): GroupDraft | null {
    if (!groupId) return null;

    const held = this.open.get(groupId);
    if (held) return held;

    const found = this.groups.group().data;
    if (found?.id !== groupId) return null;

    const fresh = new GroupDraft(found);
    this.open.set(groupId, fresh);
    return fresh;
  }
}
