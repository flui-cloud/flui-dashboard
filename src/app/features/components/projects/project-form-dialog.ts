import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Injectable, TemplateRef, computed, inject, signal } from '@angular/core';
import { Project } from '../../model/project.model';
import { ProjectsService } from '../../service/projects.service';
import { ProjectFormValue } from './project-form.component';

@Injectable()
export class ProjectFormDialog {
  private readonly dialog = inject(Dialog);
  private readonly projects = inject(ProjectsService);
  private ref: DialogRef<unknown> | null = null;

  readonly creating = signal(false);
  readonly editing = signal<Project | null>(null);
  readonly busy = signal(false);
  readonly submitLabel = computed(() => (this.editing() ? 'Save changes' : 'Create project'));

  open(template: TemplateRef<unknown>, project: Project | null = null): void {
    this.ref?.close();
    this.creating.set(!project);
    this.editing.set(project);
    const ref = this.dialog.open(template, {
      backdropClass: 'fl-backdrop',
      ariaModal: true,
      ariaLabel: project ? `Edit ${project.name}` : 'New project',
    });
    this.ref = ref;
    ref.closed.subscribe(() => {
      if (this.ref !== ref) return;
      this.ref = null;
      this.creating.set(false);
      this.editing.set(null);
      this.busy.set(false);
    });
  }

  close(): void {
    this.ref?.close();
  }

  save(value: ProjectFormValue): void {
    const project = this.editing();
    if (!project) {
      this.projects.create(value);
      this.close();
      return;
    }
    this.busy.set(true);
    this.projects.update(
      project.id,
      {
        name: value.name,
        description: value.description ?? null,
        color: value.color ?? null,
      },
      () => {
        this.busy.set(false);
        this.close();
      },
    );
  }
}
