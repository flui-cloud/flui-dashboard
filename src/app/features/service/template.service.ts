import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TemplatesService } from '../../core/api/api/templates.service';
import { TemplateResponseDto } from '../../core/api/model/templateResponseDto';
import { UseTemplateDto } from '../../core/api/model/useTemplateDto';
import { UseTemplateResponseDto } from '../../core/api/model/useTemplateResponseDto';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly templatesApi = inject(TemplatesService);

  private readonly templatesList = signal<TemplateResponseDto[]>([]);
  private readonly isLoading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly selectedFramework = signal<string | null>(null);

  readonly templates = this.templatesList.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly errorMessage = this.error.asReadonly();
  readonly hasTemplates = computed(() => this.templatesList().length > 0);

  readonly selectedTemplate = computed(() => {
    const fw = this.selectedFramework();
    if (!fw) return null;
    return this.templatesList().find(t => t.framework === fw) ?? null;
  });

  async loadTemplates(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const templates = await firstValueFrom(
        this.templatesApi.templatesControllerListTemplates()
      );
      this.templatesList.set(templates);
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || 'Failed to load templates';
      this.error.set(errorMessage);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Create a new GitHub repository in the user's account starting from a Flui template.
   * The user's OAuth token must have the `repo` scope.
   */
  async useTemplate(framework: string, dto: UseTemplateDto): Promise<UseTemplateResponseDto> {
    try {
      return await firstValueFrom(
        this.templatesApi.templatesControllerUseTemplate(framework, dto)
      );
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Failed to create repository from template';
      this.error.set(msg);
      throw error;
    }
  }

  selectTemplate(framework: string): void {
    this.selectedFramework.set(framework);
  }

  clearSelection(): void {
    this.selectedFramework.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
