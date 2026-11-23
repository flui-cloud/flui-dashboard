import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GithubCredentialProblem } from '../../core/state/github-credential';
import { FlAlert } from '../../ui/patterns/alert';
import { FlButton } from '../../ui/primitives/button';

@Component({
  selector: 'app-github-credential-alert',
  imports: [RouterLink, FlAlert, FlButton],
  host: { class: 'block' },
  template: `
    <fl-alert tone="warning" [title]="problem().title">
      {{ problem().message }}
      <a alertActions flButton size="sm" routerLink="/apps/repositories">Open repositories</a>
    </fl-alert>
  `,
})
export class GithubCredentialAlert {
  readonly problem = input.required<GithubCredentialProblem>();
}
