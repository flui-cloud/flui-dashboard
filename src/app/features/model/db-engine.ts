import { ApplicationResponseDto } from '../../core/api';
import { isBuildingBlock, isComposedComponent } from './app-exposure';

export type DbEngine =
  | 'postgres'
  | 'mariadb'
  | 'redis'
  | 'valkey'
  | 'ferretdb'
  | 'garage'
  | 'opensearch'
  | 'nats'
  | 'rabbitmq'
  | 'memcached'
  | 'openbao'
  | 'kafka'
  | 'meilisearch';

export type DbEngineFamily =
  | 'sql'
  | 'keyvalue'
  | 'document'
  | 'object-storage'
  | 'search'
  | 'messaging'
  | 'cache'
  | 'secrets'
  | 'streaming'
  | 'fulltext';

/** Label the installer stamps from the catalog manifest's declared `engine`. */
export const DB_ENGINE_LABEL = 'flui.cloud/db-engine';

export interface DbEngineDescriptor {
  engine: DbEngine;
  family: DbEngineFamily;
  label: string;
  /**
   * Legacy fallback only — matched against the image NAME (see `imageNameOf`) when an install
   * predates the `flui.cloud/db-engine` label. Anchored on purpose: a substring match turns
   * companions like opensearch-dashboards or redis-commander into databases.
   */
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
    // pgvector (Postgres + vector ext) and flui-postgres (our BB) speak the same wire/console;
    // postgres-documentdb is FerretDB's Postgres store.
    imagePattern: /^(flui-)?postgres(ql|-documentdb)?$|^pgvector$/i,
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
    imagePattern: /^(mariadb|mysql)$/i,
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
    imagePattern: /^valkey$/i,
    tunnelPort: 56379,
    defaultPort: 6379,
    urlScheme: 'redis',
    externalClients: 'redis-cli, valkey-cli, RedisInsight',
  },
  {
    engine: 'redis',
    family: 'keyvalue',
    label: 'Redis',
    imagePattern: /^redis$/i,
    tunnelPort: 56379,
    defaultPort: 6379,
    urlScheme: 'redis',
    externalClients: 'redis-cli, RedisInsight',
  },
  {
    engine: 'ferretdb',
    family: 'document',
    label: 'FerretDB',
    imagePattern: /^ferretdb$/i,
    tunnelPort: 57017,
    defaultPort: 27017,
    urlScheme: 'mongodb',
    externalClients: 'mongosh, MongoDB Compass',
  },
  {
    engine: 'garage',
    family: 'object-storage',
    label: 'Garage',
    imagePattern: /^garage$/i,
    tunnelPort: 53900,
    defaultPort: 3900,
    urlScheme: 's3',
    externalClients: 'aws-cli, rclone, s3cmd',
  },
  {
    engine: 'opensearch',
    family: 'search',
    label: 'OpenSearch',
    imagePattern: /^opensearch$/i,
    tunnelPort: 59200,
    defaultPort: 9200,
    urlScheme: 'https',
    externalClients: 'curl, OpenSearch Dashboards, Kibana',
  },
  {
    engine: 'nats',
    family: 'messaging',
    label: 'NATS',
    imagePattern: /^nats$/i,
    tunnelPort: 54222,
    defaultPort: 4222,
    urlScheme: 'nats',
    externalClients: 'nats CLI, nats-box',
  },
  {
    engine: 'rabbitmq',
    family: 'messaging',
    label: 'RabbitMQ',
    imagePattern: /^rabbitmq$/i,
    tunnelPort: 55672,
    defaultPort: 5672,
    urlScheme: 'amqp',
    externalClients: 'amqp clients, rabbitmqadmin, Management UI (:15672)',
  },
  {
    engine: 'memcached',
    family: 'cache',
    label: 'Memcached',
    imagePattern: /^memcached$/i,
    tunnelPort: 51211,
    defaultPort: 11211,
    urlScheme: 'memcached',
    externalClients: 'telnet/nc, libmemcached, php-memcached',
  },
  {
    engine: 'openbao',
    family: 'secrets',
    label: 'OpenBao',
    imagePattern: /^openbao$/i,
    tunnelPort: 58200,
    defaultPort: 8200,
    urlScheme: 'http',
    externalClients: 'bao CLI, Vault SDKs, OpenBao UI',
  },
  {
    engine: 'kafka',
    family: 'streaming',
    label: 'Apache Kafka',
    imagePattern: /^kafka(-native)?$/i,
    tunnelPort: 59092,
    defaultPort: 9092,
    urlScheme: 'kafka',
    externalClients: 'kafka CLI, kcat, kafkajs',
  },
  {
    engine: 'meilisearch',
    family: 'fulltext',
    label: 'Meilisearch',
    imagePattern: /^meilisearch$/i,
    tunnelPort: 57700,
    defaultPort: 7700,
    urlScheme: 'http',
    externalClients: 'Meilisearch SDKs, curl, Meilisearch dashboard',
  },
];

const BY_ENGINE = new Map(DB_ENGINES.map((d) => [d.engine, d]));

export function engineDescriptor(engine: DbEngine): DbEngineDescriptor {
  const d = BY_ENGINE.get(engine);
  if (!d) throw new Error(`Unknown database engine: ${engine}`);
  return d;
}

/**
 * The image name alone — registry, org and tag stripped. Patterns must never see the tag or the
 * org: umami ships as `umami-software/umami:postgresql-v2.20.2`, which reads as Postgres on a
 * full-ref match.
 */
export function imageNameOf(imageRef: string | null | undefined): string {
  const ref = (imageRef ?? '').split('@')[0];
  const lastSlash = ref.lastIndexOf('/');
  const lastColon = ref.lastIndexOf(':');
  const repository = lastColon > lastSlash ? ref.slice(0, lastColon) : ref;
  return repository.slice(repository.lastIndexOf('/') + 1);
}

export function databaseEngineOf(
  app: ApplicationResponseDto | null | undefined,
): DbEngine | null {
  if (!app || (!isBuildingBlock(app) && !isComposedComponent(app))) return null;
  const labels = (app.labels ?? {}) as Record<string, string>;
  const declared = labels[DB_ENGINE_LABEL] as DbEngine | undefined;
  if (declared && BY_ENGINE.has(declared)) return declared;
  const name = imageNameOf(app.imageRef);
  return DB_ENGINES.find((d) => d.imagePattern.test(name))?.engine ?? null;
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

export function isDocumentDatabase(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'document';
}

export function isObjectStore(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'object-storage';
}

export function isSearchEngine(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'search';
}

export function isMessagingServer(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'messaging';
}

export function isCacheServer(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'cache';
}

export function isSecretsServer(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'secrets';
}

export function isStreamingServer(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'streaming';
}

export function isFulltextServer(
  app: ApplicationResponseDto | null | undefined,
): boolean {
  return engineFamilyOf(app) === 'fulltext';
}

export function consoleRouteFor(
  app: ApplicationResponseDto | null | undefined,
): string | null {
  switch (engineFamilyOf(app)) {
    case 'sql':
      return '/db-console';
    case 'keyvalue':
      return '/kv-console';
    case 'document':
      return '/doc-console';
    case 'object-storage':
      return '/object-store-console';
    case 'search':
      return '/search-console';
    case 'messaging':
      return '/messaging-console';
    case 'cache':
      return '/cache-console';
    case 'secrets':
      return '/secrets-console';
    case 'streaming':
      return '/kafka-console';
    case 'fulltext':
      return '/meilisearch-console';
    default:
      return null;
  }
}
