import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLock,
  lucideFileText,
  lucideLoader,
  lucidePlus,
  lucideTrash2,
  lucideInfo,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { DeployWizardStateService, GhaEnvVarEntry } from '../../service/deploy-wizard-state.service';
import { RepositoryService } from '../../service/repository.service';

@Component({
  selector: 'app-extract-env-step',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({ lucideLock, lucideFileText, lucideLoader, lucidePlus, lucideTrash2, lucideInfo, lucideTriangleAlert }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Security notice -->
      <div class="flex items-start gap-2 p-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 text-sm text-blue-800 dark:text-blue-300">
        <ng-icon name="lucideInfo" class="h-4 w-4 shrink-0 mt-0.5" />
        <span>Variable values are never written to the GitHub repository. They are injected by Flui securely at deploy time.</span>
      </div>

      <!-- Loading -->
      @if (isLoading()) {
        <div class="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <ng-icon name="lucideLoader" class="h-4 w-4 animate-spin" />
          Scanning repository for environment variables...
        </div>
      }

      <!-- Error -->
      @if (!isLoading() && error()) {
        <div class="flex items-start gap-2 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 text-sm text-yellow-800 dark:text-yellow-300">
          <ng-icon name="lucideTriangleAlert" class="h-4 w-4 shrink-0 mt-0.5" />
          <span>{{ error() }}. Add variables manually below.</span>
        </div>
      }

      <!-- Env vars table -->
      @if (!isLoading()) {
        <div class="space-y-2">
          @if (envVars().length > 0) {
            <div class="rounded-md border border-border overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-muted/50">
                  <tr>
                    <th class="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-2/5">Key</th>
                    <th class="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Value</th>
                    <th class="px-3 py-2 text-xs font-medium text-muted-foreground w-24 text-center">Type</th>
                    <th class="w-10"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (entry of envVars(); track entry.key; let i = $index) {
                    <tr class="bg-background hover:bg-muted/20">
                      <td class="px-3 py-2">
                        <span class="font-mono text-xs">{{ entry.key }}</span>
                        @if (entry.source) {
                          <span class="ml-1.5 text-xs text-muted-foreground opacity-60">{{ entry.source }}</span>
                        }
                      </td>
                      <td class="px-3 py-2">
                        @if (entry.isSecret) {
                          <input
                            type="password"
                            [ngModel]="entry.value"
                            (ngModelChange)="updateValue(i, $event)"
                            placeholder="Enter secret value"
                            class="w-full bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
                            autocomplete="off"
                          />
                        } @else {
                          <input
                            type="text"
                            [ngModel]="entry.value"
                            (ngModelChange)="updateValue(i, $event)"
                            placeholder="Enter value"
                            class="w-full bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
                          />
                        }
                      </td>
                      <td class="px-3 py-2 text-center">
                        <button
                          type="button"
                          (click)="toggleSecret(i)"
                          [class]="getTypeButtonClass(entry.isSecret)"
                          [title]="entry.isSecret ? 'Switch to Plain' : 'Switch to Secret'"
                        >
                          <ng-icon [name]="entry.isSecret ? 'lucideLock' : 'lucideFileText'" class="h-3 w-3" />
                          {{ entry.isSecret ? 'Secret' : 'Plain' }}
                        </button>
                      </td>
                      <td class="px-1 py-2 text-center">
                        <button
                          type="button"
                          (click)="removeVar(i)"
                          class="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <ng-icon name="lucideTrash2" class="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else if (!error()) {
            <p class="text-sm text-muted-foreground py-2">No environment variables detected. Add them manually below.</p>
          }

          <!-- Add variable -->
          @if (showAddForm()) {
            <div class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20">
              <input
                type="text"
                [(ngModel)]="newKey"
                placeholder="KEY_NAME"
                class="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50 uppercase"
                (keyup.enter)="addVar()"
              />
              <span class="text-muted-foreground text-xs">=</span>
              <input
                type="text"
                [(ngModel)]="newValue"
                placeholder="value"
                class="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
                (keyup.enter)="addVar()"
              />
              <button type="button" (click)="addVar()" class="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">Add</button>
              <button type="button" (click)="showAddForm.set(false)" class="text-xs px-2 py-1 rounded border border-border hover:bg-accent">Cancel</button>
            </div>
          } @else {
            <button
              type="button"
              (click)="showAddForm.set(true)"
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ng-icon name="lucidePlus" class="h-4 w-4" />
              Add variable manually
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ExtractEnvStepComponent implements OnInit {
  private readonly state = inject(DeployWizardStateService);
  private readonly repoService = inject(RepositoryService);

  isLoading = signal(false);
  error = signal<string | null>(null);
  envVars = this.state.envVars;
  showAddForm = signal(false);
  newKey = '';
  newValue = '';

  ngOnInit(): void {
    void (async () => {
      if (this.envVars().length === 0) {
        await this.loadEnvVars();
      }
    })();
  }

  private async loadEnvVars(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const extracted = await this.repoService.extractEnvVars(
        this.state.repositoryId(),
        this.state.branch(),
        this.state.confirmedFramework()
      );
      this.state.setEnvVarsFromExtracted(extracted);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to extract environment variables');
    } finally {
      this.isLoading.set(false);
    }
  }

  updateValue(index: number, value: string): void {
    this.state.envVars.update(vars =>
      vars.map((v, i) => i === index ? { ...v, value } : v)
    );
  }

  toggleSecret(index: number): void {
    this.state.envVars.update(vars =>
      vars.map((v, i) => i === index ? { ...v, isSecret: !v.isSecret } : v)
    );
  }

  removeVar(index: number): void {
    this.state.envVars.update(vars => vars.filter((_, i) => i !== index));
  }

  addVar(): void {
    const key = this.newKey.trim().toUpperCase();
    if (!key) return;
    const entry: GhaEnvVarEntry = { key, value: this.newValue, isSecret: false };
    this.state.envVars.update(vars => [...vars, entry]);
    this.newKey = '';
    this.newValue = '';
    this.showAddForm.set(false);
  }

  getTypeButtonClass(isSecret: boolean): string {
    const base = 'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors';
    return isSecret
      ? `${base} bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`
      : `${base} bg-muted text-muted-foreground hover:bg-accent`;
  }
}
