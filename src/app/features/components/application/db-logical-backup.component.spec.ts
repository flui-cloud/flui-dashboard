import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DbBackupInfo, DbBackupService } from '../../service/db-backup.service';
import { DbLogicalBackupComponent } from './db-logical-backup.component';

const info = (over: Partial<DbBackupInfo> = {}): DbBackupInfo => ({
  engine: 'postgres',
  database: 'postgresql-6ed2c8',
  format: 'sql',
  supported: true,
  restoreSupported: true,
  reason: null,
  suggestedFilename: 'postgresql-6ed2c8-2026-10-01.sql',
  ...over,
});

describe('DbLogicalBackupComponent', () => {
  let fixture: ComponentFixture<DbLogicalBackupComponent>;
  let current: DbBackupInfo;

  beforeEach(async () => {
    current = info();
    await TestBed.configureTestingModule({
      imports: [DbLogicalBackupComponent],
      providers: [{ provide: DbBackupService, useValue: { info: () => of(current) } }],
    }).compileComponents();
  });

  const render = (): string => {
    fixture = TestBed.createComponent(DbLogicalBackupComponent);
    fixture.componentRef.setInput('appId', 'a-1');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('names the database inside the server as a database, not as the app', () => {
    expect(render()).toContain('dump of database “postgresql-6ed2c8”');
  });

  it('names nothing when the engine has no database name', () => {
    current = info({ database: null, engine: 'redis', format: 'rdb' });
    const text = render();
    expect(text).toContain('A portable engine-native dump —');
    expect(text).not.toContain('database “');
  });
});
