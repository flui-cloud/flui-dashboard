import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProjectPickerComponent, selectableProjects } from './project-picker.component';
import { ProjectsService } from '../../service/projects.service';
import { Project } from '../../model/project.model';

describe('ProjectPickerComponent', () => {
  const build = (projects: Project[]) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProjectsService,
          useValue: { projects: signal(projects), loadProjects: () => undefined },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProjectPickerComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('never offers a personal project, not even the viewer own', () => {
    expect(
      selectableProjects([
        { id: 'a', name: 'Personal', slug: 'personal-1', ownerUserId: 'u1' },
        { id: 'b', name: 'Web team', slug: 'web-team' },
      ]).map((p) => p.id),
    ).toEqual(['b']);
  });

  it('stays out of the way when there is nothing to choose', () => {
    const fixture = build([
      { id: 'a', name: 'Personal', slug: 'personal-1', ownerUserId: 'u1' },
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="project-picker"]'),
    ).toBeNull();
  });

  it('offers the shared projects after the personal default, and says what was picked', () => {
    const fixture = build([{ id: 'b', name: 'Web team', slug: 'web-team' }]);
    const picked: Array<string | null> = [];
    fixture.componentInstance.valueChange.subscribe((v) => picked.push(v));

    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['Personal', 'Web team']);

    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(picked).toEqual(['b', null]);
  });
});
