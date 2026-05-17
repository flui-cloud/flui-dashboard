import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeployWizardStateService } from '../../service/deploy-wizard-state.service';

const NODE_VERSIONS = ['22', '20', '18', '16'];
const JAVA_VERSIONS = ['21', '17', '11'];
const DOTNET_VERSIONS = ['8.0', '7.0', '6.0'];
const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;
const BUILD_TOOLS = ['maven', 'gradle'] as const;

@Component({
  selector: 'app-runtime-config-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      @if (state.needsNodeConfig()) {
        <!-- Node.js config -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">Node.js Version</label>
          <div class="flex flex-wrap gap-2">
            @for (v of nodeVersions; track v) {
              <button type="button" (click)="setRuntime('nodeVersion', v)" [class]="getVersionButtonClass(runtime().nodeVersion === v)">
                {{ v }}
              </button>
            }
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium">Package Manager</label>
          <div class="flex flex-wrap gap-2">
            @for (pm of packageManagers; track pm) {
              <button type="button" (click)="setRuntime('packageManager', pm)" [class]="getVersionButtonClass(runtime().packageManager === pm)">
                {{ pm }}
              </button>
            }
          </div>
        </div>
      }

      @if (state.needsJvmConfig()) {
        <!-- JVM config -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">Java Version</label>
          <div class="flex flex-wrap gap-2">
            @for (v of javaVersions; track v) {
              <button type="button" (click)="setRuntime('javaVersion', v)" [class]="getVersionButtonClass(runtime().javaVersion === v)">
                {{ v }}
              </button>
            }
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium">Build Tool</label>
          <div class="flex flex-wrap gap-2">
            @for (bt of buildTools; track bt) {
              <button type="button" (click)="setRuntime('buildTool', bt)" [class]="getVersionButtonClass(runtime().buildTool === bt)">
                {{ bt }}
              </button>
            }
          </div>
        </div>
      }

      @if (state.needsDotnetConfig()) {
        <!-- .NET config -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium">.NET Version</label>
          <div class="flex flex-wrap gap-2">
            @for (v of dotnetVersions; track v) {
              <button type="button" (click)="setRuntime('dotnetVersion', v)" [class]="getVersionButtonClass(runtime().dotnetVersion === v)">
                {{ v }}
              </button>
            }
          </div>
        </div>
      }

      @if (!state.needsRuntimeConfig()) {
        <p class="text-sm text-muted-foreground py-2">No additional runtime configuration required for this framework.</p>
      }
    </div>
  `,
})
export class RuntimeConfigStepComponent {
  state = inject(DeployWizardStateService);
  runtime = this.state.runtimeConfig;

  readonly nodeVersions = NODE_VERSIONS;
  readonly javaVersions = JAVA_VERSIONS;
  readonly dotnetVersions = DOTNET_VERSIONS;
  readonly packageManagers = PACKAGE_MANAGERS;
  readonly buildTools = BUILD_TOOLS;

  setRuntime<K extends keyof ReturnType<typeof this.state.runtimeConfig>>(
    key: K,
    value: ReturnType<typeof this.state.runtimeConfig>[K]
  ): void {
    this.state.runtimeConfig.update(r => ({ ...r, [key]: value }));
  }

  getVersionButtonClass(isSelected: boolean): string {
    const base = 'px-3 py-1.5 rounded-md border text-sm transition-colors';
    return isSelected
      ? `${base} border-primary bg-primary/10 text-foreground font-medium`
      : `${base} border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground`;
  }
}
