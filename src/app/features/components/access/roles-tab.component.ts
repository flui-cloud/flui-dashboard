import { Component, computed, inject } from '@angular/core';
import { FlPanel } from '../../../ui/patterns/panel';
import { FlEmptyState } from '../../../ui/patterns/states';
import { FlTable } from '../../../ui/patterns/table';
import { IamService } from '../../service/iam.service';
import { RoleDef } from '../../model/iam.model';

@Component({
  selector: 'app-roles-tab',
  imports: [FlPanel, FlEmptyState, FlTable],
  host: { class: 'fl-stack' },
  template: `
    <fl-panel title="Roles" [count]="iam.roles().length" [flush]="true">
      @if (iam.roles().length) {
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">What it allows</th>
                <th scope="col">Who confers it</th>
                <th scope="col" class="is-num">Permissions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of iam.roles(); track r.key) {
                <tr>
                  <td class="font-medium">{{ r.name }}</td>
                  <td class="whitespace-normal text-fl-ink-secondary">{{ r.description }}</td>
                  <td class="text-fl-ink-secondary">{{ conferredBy(r) }}</td>
                  <td class="is-num">{{ r.permissions.length }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <fl-empty-state [compact]="true" title="No roles to show" />
      }
      <p class="border-t border-fl-border px-4 py-3 text-fl-body-sm text-fl-ink-muted">
        Built-in roles are read-only. Custom roles are not available at launch. Viewer, Operator,
        Maintainer and Owner are a ladder: each one carries everything the one before it carries,
        and adds to it. <span class="font-medium text-fl-ink">Owner</span> is conferred only by
        another owner. <span class="font-medium text-fl-ink">Platform operator</span> sits outside
        the ladder: it runs the installation without reaching any application data.
      </p>
    </fl-panel>

    @if (permissions().length) {
      <fl-panel title="Permissions" [count]="permissions().length" [flush]="true">
        <div class="fl-table-wrap">
          <table flTable density="dense">
            <thead>
              <tr>
                <th scope="col">Permission</th>
                @for (r of iam.roles(); track r.key) {
                  <th scope="col" class="text-center">{{ r.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (p of permissions(); track p) {
                <tr>
                  <td class="fl-mono">{{ p }}</td>
                  @for (r of iam.roles(); track r.key) {
                    <td class="text-center">
                      <label class="fl-check">
                        <input type="checkbox" disabled [checked]="holds(r, p)" />
                        <span class="fl-sr">{{ p }} in {{ r.name }}</span>
                      </label>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </fl-panel>
    }
  `,
})
export class RolesTabComponent {
  protected readonly iam = inject(IamService);

  protected readonly permissions = computed(() => {
    const seen = new Set<string>();
    for (const r of this.iam.roles()) for (const p of r.permissions) seen.add(p);
    return [...seen];
  });

  protected holds(r: RoleDef, permission: string): boolean {
    return r.permissions.includes(permission);
  }

  protected conferredBy(r: RoleDef): string {
    if (r.grantable) return 'You can grant it';
    return r.assignable ? 'Not yours to grant' : 'Assigned by the platform';
  }
}
