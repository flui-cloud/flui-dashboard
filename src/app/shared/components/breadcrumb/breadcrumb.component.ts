import { Component } from '@angular/core';
import {
  HlmBreadcrumbDirective,
  HlmBreadcrumbEllipsisComponent,
  HlmBreadcrumbItemDirective,
  HlmBreadcrumbLinkDirective,
  HlmBreadcrumbListDirective,
  HlmBreadcrumbPageDirective,
  HlmBreadcrumbSeparatorComponent,
} from '@spartan-ng/ui-breadcrumb-helm';

@Component({
  selector: 'breadcrumb',
  standalone: true,
  imports: [
    HlmBreadcrumbDirective,
    HlmBreadcrumbSeparatorComponent,
    HlmBreadcrumbEllipsisComponent,
    HlmBreadcrumbListDirective,
    HlmBreadcrumbItemDirective,
    HlmBreadcrumbPageDirective,
    HlmBreadcrumbLinkDirective
  ],
  template: `
  <nav hlmBreadcrumb>
    <ol hlmBreadcrumbList>
        <li hlmBreadcrumbItem>
            <a hlmBreadcrumbLink href="/home">Home</a>
        </li>
        <li hlmBreadcrumbSeparator></li>
        <li hlmBreadcrumbItem>
            <hlm-breadcrumb-ellipsis />
        </li>
        <li hlmBreadcrumbSeparator></li>
        <li hlmBreadcrumbItem>
            <span hlmBreadcrumbPage>Breadcrumb</span>
        </li>
    </ol>
</nav>
  `
})
export class BreadcrumbComponent {
}
