export type SecretsEngine = 'openbao';

export interface SecretsConnectionInfo {
  engine: SecretsEngine;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
  mount: string;
}

export interface SecretsServerInfo {
  version: string;
  initialized: boolean;
  sealed: boolean;
  mount: string;
}

export interface SecretListEntry {
  name: string;
  isFolder: boolean;
}

export interface SecretVersionMeta {
  version: number;
  createdTime?: string;
  deleted: boolean;
  destroyed: boolean;
}

export interface SecretRead {
  path: string;
  data: Record<string, string>;
  version: number;
  createdTime?: string;
  versions: SecretVersionMeta[];
}

export interface SecretReadResult {
  found: boolean;
  secret: SecretRead | null;
}
