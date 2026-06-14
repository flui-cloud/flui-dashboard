import { ApplicationResponseDto } from '../../core/api';
import { isBuildingBlock, isComposedComponent } from './app-exposure';

export type DbEngine = 'postgres' | 'mariadb' | 'redis' | 'valkey';

export type DbEngineFamily = 'sql' | 'keyvalue';

export interface DbEngineDescriptor {
  engine: DbEngine;
  family: DbEngineFamily;
  label: string;
  imagePattern: RegExp;
  tunnelPort: number;
  defaultPort: number;
  urlScheme: string;
  externalClients: string;
  quoteIdent?: (name: string) => string;
}

const doubleQuote = (n: string): string => `"${n.replaceAll('"', '""')}"`;
const backtick = (n: string): string => `\`${n.replaceAll('`', '``')}\``;

export const DB_ENGINES: readonly DbEngineDescriptor[] = [
  {
    engine: 'postgres',
    family: 'sql',
    label: 'PostgreSQL',
    imagePattern: /postgres/i,
    tunnelPort: 55432,
    defaultPort: 5432,
    urlScheme: 'postgresql',
    externalClients: 'psql, pgAdmin, DBeaver',
    quoteIdent: doubleQuote,
  },
  {
    engine: 'mariadb',
    family: 'sql',
    label: 'MariaDB',
    imagePattern: /maria|mysql/i,
    tunnelPort: 53306,
    defaultPort: 3306,
    urlScheme: 'mysql',
    externalClients: 'mariadb, mysql CLI, DBeaver',
    quoteIdent: backtick,
  },
  {
    engine: 'valkey',
    family: 'keyvalue',
    label: 'Valkey',
    imagePattern: /valkey/i,
    tunnelPort: 56379,
    defaultPort: 6379,
    urlScheme: 'redis',
    externalClients: 'redis-cli, valkey-cli, RedisInsight',
  },
  {
    engine: 'redis',
    family: 'keyvalue',
    label: 'Redis',
    imagePattern: /redis/i,
    tunnelPort: 56379,
    defaultPort: 6379,
    urlScheme: 'redis',
    externalClients: 'redis-cli, RedisInsight',
  },
];

const BY_ENGINE = new Map(DB_ENGINES.map((d) => [d.engine, d]));

export function engineDescriptor(engine: DbEngine): DbEngineDescriptor {
  const d = BY_ENGINE.get(engine);
  if (!d) throw new Error(`Unknown database engine: ${engine}`);
  return d;
}

export function databaseEngineOf(
  app: ApplicationResponseDto | null | undefined,
): DbEngine | null {
  if (!app || (!isBuildingBlock(app) && !isComposedComponent(app))) return null;
  const ref = app.imageRef ?? '';
  return DB_ENGINES.find((d) => d.imagePattern.test(ref))?.engine ?? null;
}

export function engineFamilyOf(
  app: ApplicationResponseDto | null | undefined,
): DbEngineFamily | null {
  const engine = databaseEngineOf(app);
  return engine ? engineDescriptor(engine).family : null;
}

export function isQueryableDatabase(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'sql';
}

export function isKeyValueDatabase(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'keyvalue';
}

export function consoleRouteFor(
  app: ApplicationResponseDto | null | undefined,
): string | null {
  switch (engineFamilyOf(app)) {
    case 'sql':
      return '/db-console';
    case 'keyvalue':
      return '/kv-console';
    default:
      return null;
  }
}
