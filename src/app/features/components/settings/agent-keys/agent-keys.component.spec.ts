import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AuthService as ApiAuthService } from '../../../../core/api/api/auth.service';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { ApiKeyResponseDto } from '../../../../core/api/model/apiKeyResponseDto';
import { PermissionGroupDto } from '../../../../core/api/model/permissionGroupDto';
import { AgentKeysComponent } from './agent-keys.component';
import { AgentSkill, AgentSkillService } from './agent-skill.service';

const SKILL: AgentSkill = {
  version: '1.0.0',
  digest: 'f62a7fd77a9f',
  filename: 'SKILL.md',
  mediaType: 'text/markdown',
  mcpEndpoint: 'http://api.test/api/v1/mcp',
  content: '---\nname: flui\n---\n\n# Working with Flui\n\nPOST http://api.test/api/v1/mcp\n',
};

const group = (
  key: string,
  area: string,
  label: string,
  scopes: string[],
  grantable: boolean,
): PermissionGroupDto =>
  ({
    key,
    area,
    depth: key.split(':')[1],
    label,
    summary: `${label}.`,
    scopes,
    grantable,
    blockedScopes: grantable ? [] : scopes,
  }) as unknown as PermissionGroupDto;

const CATALOGUE = (grantableKeys: string[]): PermissionGroupDto[] =>
  [
    ['apps:look', 'apps', 'See applications', ['mcp:catalog:read', 'mcp:app:read', 'mcp:spec:validate']],
    ['apps:change', 'apps', 'Deploy and operate applications', ['mcp:catalog:read', 'mcp:app:read', 'mcp:spec:validate', 'mcp:app:write', 'mcp:obs:read']],
    ['apps:destroy', 'apps', 'Delete applications', ['mcp:app:destructive']],
    ['observability:look', 'observability', 'Read logs and health', ['mcp:app:read', 'mcp:obs:read']],
    ['backups:look', 'backups', 'See backups', ['mcp:backup:read']],
    ['backups:change', 'backups', 'Run backups', ['mcp:backup:write']],
    ['migrations:look', 'migrations', 'See migrations', ['mcp:migration:read']],
    ['migrations:change', 'migrations', 'Run migrations', ['mcp:migration:write']],
    ['migrations:destroy', 'migrations', 'Abort and tear down migrations', ['mcp:migration:destructive']],
    ['mail:look', 'mail', 'See mail delivery', ['mcp:mail:read']],
  ].map(([key, area, label, scopes]) =>
    group(
      key as string,
      area as string,
      label as string,
      scopes as string[],
      grantableKeys.includes(key as string),
    ),
  );

const GUEST_GRANTS = ['apps:look', 'apps:change', 'apps:destroy', 'observability:look'];
const ADMIN_GRANTS = CATALOGUE([]).map((g) => g.key);

const OLD_KEY: ApiKeyResponseDto = {
  id: 'k-old',
  name: 'agent minted last week',
  revoked: false,
  createdAt: '2026-08-15T10:00:00.000Z',
  scopes: ['mcp:catalog:read', 'mcp:app:read', 'mcp:spec:validate', 'mcp:app:write'],
  groups: ['apps:look'] as ApiKeyResponseDto.GroupsEnum[],
  ungroupedScopes: ['mcp:app:write'],
  current: false,
};

const STALE_AGENT_KEY = {
  id: 'k-stale',
  name: 'release bot',
  revoked: false,
  createdAt: '2026-08-01T10:00:00.000Z',
  lastUsedAt: new Date().toISOString(),
  scopes: ['mcp:app:read'],
  groups: ['apps:look'],
  ungroupedScopes: [],
  current: false,
  skillVersion: '0.1.0',
} as unknown as ApiKeyResponseDto;

const SESSION_KEY: ApiKeyResponseDto = {
  id: 'k-session',
  name: 'sandbox-user-guest-abc',
  revoked: false,
  createdAt: '2026-08-22T09:00:00.000Z',
  lastUsedAt: new Date().toISOString(),
  scopes: null as unknown as string[],
  groups: null as unknown as ApiKeyResponseDto.GroupsEnum[],
  ungroupedScopes: null as unknown as string[],
  current: true,
};

describe('the agent keys screen', () => {
  let fixture: ComponentFixture<AgentKeysComponent>;
  let api: jasmine.SpyObj<ApiAuthService>;

  const build = async (
    grants: string[],
    keys: ApiKeyResponseDto[] = [],
    skill: AgentSkill | null = SKILL,
  ): Promise<void> => {
    api = jasmine.createSpyObj<ApiAuthService>('ApiAuthService', [
      'apiKeysControllerListPermissionGroups',
      'apiKeysControllerListApiKeys',
      'apiKeysControllerCreateApiKey',
      'apiKeysControllerRevokeApiKey',
    ]);
    api.apiKeysControllerListPermissionGroups.and.returnValue(
      of(CATALOGUE(grants)) as never,
    );
    api.apiKeysControllerListApiKeys.and.returnValue(of(keys) as never);
    api.apiKeysControllerCreateApiKey.and.returnValue(
      of({
        id: 'k-new',
        name: 'laptop',
        revoked: false,
        createdAt: '2026-08-22T10:00:00.000Z',
        scopes: ['mcp:app:write'],
        groups: ['apps:change'],
        ungroupedScopes: [],
        current: false,
        key: 'flui_test_value',
      }) as never,
    );
    api.apiKeysControllerRevokeApiKey.and.returnValue(of({}) as never);

    await TestBed.configureTestingModule({
      imports: [AgentKeysComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: ApiAuthService, useValue: api },
        {
          provide: AgentSkillService,
          useValue: {
            skill: () =>
              skill ? of(skill) : throwError(() => ({ status: 404 })),
          },
        },
        {
          provide: AppConfigService,
          useValue: { authMode: 'oidc', apiBaseUrl: 'http://api.test' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentKeysComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const el = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);
  const all = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));
  const text = (selector: string): string => el(selector)?.textContent?.trim() ?? '';

  it('offers every group to a guest and switches off the ones they cannot hand on', async () => {
    await build(GUEST_GRANTS);

    expect(all('[data-testid^="group-"]')).toHaveSize(10);
    const refused = all('[data-grantable="false"]');
    expect(refused).toHaveSize(6);
    expect(refused[0].textContent).toContain('Not yours to grant');
    expect(refused[0].textContent).toContain(
      'your own permissions do not cover',
    );
    expect(text('[data-testid="ceiling"]')).toContain(
      '4 of the 10 permission groups',
    );
  });

  it('serves an administrator the same screen, with more switches and no other difference', async () => {
    await build(ADMIN_GRANTS);

    expect(all('[data-testid^="group-"]')).toHaveSize(10);
    expect(all('[data-grantable="false"]')).toHaveSize(0);
    expect(text('[data-testid="ceiling"]')).toContain('All 10 permission groups');
    expect(text('[data-testid="ceiling"]')).toContain(
      'An agent can never do more than you can',
    );
  });

  it('will not mint a key with nothing switched on, because that key would be unscoped', async () => {
    await build(GUEST_GRANTS);

    const mint = el('[data-testid="mint-key"]') as HTMLButtonElement;
    const name = el('[data-testid="key-name"]') as HTMLInputElement;
    name.value = 'laptop';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(mint.disabled).toBe(true);
    mint.click();
    expect(api.apiKeysControllerCreateApiKey).not.toHaveBeenCalled();
  });

  it('asks for exactly the groups that were switched on, and shows the value once', async () => {
    await build(GUEST_GRANTS);

    const name = el('[data-testid="key-name"]') as HTMLInputElement;
    name.value = 'laptop';
    name.dispatchEvent(new Event('input'));
    (el('[data-testid="check-apps:change"]') as HTMLInputElement).click();
    fixture.detectChanges();

    (el('[data-testid="mint-key"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const body = api.apiKeysControllerCreateApiKey.calls.mostRecent().args[0];
    expect(body.name).toBe('laptop');
    expect(body.groups).toEqual(['apps:change'] as never);
    expect(body.expiresAt).toBeDefined();

    expect(text('[data-testid="minted-key"]')).not.toContain('flui_test_value');
    expect(el('[data-testid="copy-key"]')).not.toBeNull();
  });

  it('repeats the API refusal word for word, because it names the switch that was too big', async () => {
    await build(GUEST_GRANTS);
    api.apiKeysControllerCreateApiKey.and.returnValue(
      throwError(() => ({
        status: 403,
        error: {
          message:
            'You cannot grant what you do not hold: mcp:backup:read (from group backups:look)',
        },
      })),
    );

    const name = el('[data-testid="key-name"]') as HTMLInputElement;
    name.value = 'laptop';
    name.dispatchEvent(new Event('input'));
    (el('[data-testid="check-apps:change"]') as HTMLInputElement).click();
    fixture.detectChanges();
    (el('[data-testid="mint-key"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text('[data-testid="mint-error"]')).toBe(
      'You cannot grant what you do not hold: mcp:backup:read (from group backups:look)',
    );
    expect(el('[data-testid="minted-key"]')).toBeNull();
  });

  it('never describes a key by the smallest group that fits inside it', async () => {
    await build(GUEST_GRANTS, [OLD_KEY]);

    expect(text('[data-testid="headline-k-old"]')).toBe(
      'See applications, and more',
    );
    expect(el('[data-testid="beyond-groups"]')).not.toBeNull();
    const caution = text('[data-testid="caution-k-old"]');
    expect(caution).toContain('does more than those names say');
    expect(caution).toContain('mcp:app:write');
    expect(caution).toContain('Deploy and operate applications');
  });

  it('revokes only after the question is answered', async () => {
    await build(GUEST_GRANTS, [OLD_KEY]);

    (el('[data-testid="revoke-k-old"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.apiKeysControllerRevokeApiKey).not.toHaveBeenCalled();

    const confirm = all('button').find((b) => b.textContent?.trim() === 'Revoke' && b !== el('[data-testid="revoke-k-old"]'));
    confirm!.click();
    fixture.detectChanges();

    expect(api.apiKeysControllerRevokeApiKey).toHaveBeenCalledWith('k-old');
  });

  it('names the scopes that put a switch out of reach', async () => {
    await build(GUEST_GRANTS);

    const blocked = el('[data-testid="blocked-backups:look"]');
    expect(blocked).not.toBeNull();
    expect(blocked!.textContent).toContain('mcp:backup:read');
  });

  it('says nothing of the sort next to a switch the caller may hand on', async () => {
    await build(GUEST_GRANTS);
    expect(el('[data-testid="blocked-apps:change"]')).toBeNull();
  });

  it('marks the row the caller is signed in with', async () => {
    await build(GUEST_GRANTS, [OLD_KEY, SESSION_KEY]);
    const badges = all('[data-testid="current-key"]');
    expect(badges).toHaveSize(1);
  });

  it('warns about being signed out only on that row', async () => {
    await build(GUEST_GRANTS, [OLD_KEY, SESSION_KEY]);

    (el('[data-testid="revoke-k-old"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'your own session is unaffected',
    );
  });

  it('says when a key was last seen, and does not call silence "never"', async () => {
    await build(GUEST_GRANTS, [OLD_KEY, SESSION_KEY]);

    expect(text('[data-testid="when-k-old"]')).toContain('no use recorded yet');
    expect(text('[data-testid="when-k-session"]')).toContain('in use right now');
  });

  describe('handing over the instructions with the key', () => {
    const mintOne = () => {
      const name = el('[data-testid="key-name"]') as HTMLInputElement;
      name.value = 'laptop';
      name.dispatchEvent(new Event('input'));
      (el('[data-testid="check-apps:change"]') as HTMLInputElement).click();
      fixture.detectChanges();
      (el('[data-testid="mint-key"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    const openSkillSection = () => {
      (el('[data-testid="skill-section-toggle"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    it('offers the skill beside the key, collapsed behind an explicit "not using MCP" toggle', async () => {
      await build(GUEST_GRANTS);
      mintOne();

      // Collapsed by default: MCP's get_started already carries this, so it
      // is not a second thing to do — the toggle label says so up front.
      expect(el('[data-testid="skill-handoff"]')).not.toBeNull();
      expect(el('[data-testid="skill-version"]')).toBeNull();
      expect(text('[data-testid="skill-handoff"]')).toContain('SKILL.md');

      openSkillSection();
      expect(text('[data-testid="skill-version"]')).toBe('skill 1.0.0');
    });

    it('lets the instructions be read before they are taken', async () => {
      await build(GUEST_GRANTS);
      mintOne();
      openSkillSection();

      expect(el('[data-testid="skill-content"]')).toBeNull();
      (el('[data-testid="show-skill"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text('[data-testid="skill-content"]')).toContain(
        'Working with Flui',
      );
    });

    it('shows no credential inside the document', async () => {
      await build(GUEST_GRANTS);
      mintOne();
      openSkillSection();
      (el('[data-testid="show-skill"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(text('[data-testid="skill-content"]')).not.toContain('flui_test_value');
    });

    it('still hands over the key when the instructions cannot be read', async () => {
      await build(GUEST_GRANTS, [], null);
      mintOne();

      expect(el('[data-testid="minted-key"]')).not.toBeNull();
      expect(el('[data-testid="skill-handoff"]')).toBeNull();
      expect(text('[data-testid="skill-missing"]')).toContain(
        'operating without them',
      );
    });
  });

  describe('the state of the connection, on the row', () => {
    it('says an agent has never spoken', async () => {
      await build(GUEST_GRANTS, [OLD_KEY]);
      const line = text('[data-testid="connection-k-old"]');
      expect(line).toContain('Never spoken to this instance');
      expect(line).toContain('never said which instructions it is working from');
    });

    it('names the version a busy agent is behind on', async () => {
      await build(GUEST_GRANTS, [STALE_AGENT_KEY]);

      expect(text('[data-testid="when-k-stale"]')).toContain('in use right now');
      expect(text('[data-testid="connection-k-stale"]')).toContain(
        'working from skill 0.1.0 — this instance publishes 1.0.0',
      );
    });

    it('carries the last contact into the question that revokes it', async () => {
      await build(GUEST_GRANTS, [OLD_KEY]);
      (el('[data-testid="revoke-k-old"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('never used');
    });
  });

});