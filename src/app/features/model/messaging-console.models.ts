export type MessagingEngine = 'nats' | 'rabbitmq';

export interface MessagingServerInfo {
  serverName: string;
  version: string;
  uptime: string;
  connections: number;
  inMsgs: number;
  outMsgs: number;
  inBytes: number;
  outBytes: number;
  memBytes: number;
  cores: number;
  jetStream: {
    enabled: boolean;
    memoryBytes: number;
    storageBytes: number;
    accounts: number;
    apiTotal: number;
    apiErrors: number;
  };
}

export interface JsConsumer {
  name: string;
  stream: string;
  numPending: number;
  numAckPending: number;
  numRedelivered: number;
  numWaiting: number;
  deliveredStreamSeq: number;
  ackFloorStreamSeq: number;
  ackPolicy?: string;
  deliverPolicy?: string;
  durable: boolean;
}

export interface JsStream {
  name: string;
  account: string;
  subjects: string[];
  retention?: string;
  storage?: string;
  messages: number;
  bytes: number;
  firstSeq: number;
  lastSeq: number;
  consumerCount: number;
  consumers: JsConsumer[];
}

export interface MessagingConnectionInfo {
  engine: MessagingEngine;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
}

export interface MessagingPublishRequest {
  subject: string;
  payload: string;
  headers?: Record<string, string>;
}

export interface MessagingPublishResult {
  stream?: string;
  seq?: number;
}

export interface MessagingPeekRequest {
  stream: string;
  limit?: number;
  startSeq?: number;
}

export interface QueueMessage {
  seq?: number;
  subject: string;
  data: string;
  encoding: 'utf8' | 'base64';
  timestamp?: string;
  headers?: Record<string, string[]>;
}

export interface QueueStream {
  name: string;
  subjects: string[];
  storage?: string;
  retention?: string;
  messages: number;
  bytes: number;
  firstSeq: number;
  lastSeq: number;
  consumerCount: number;
}

export interface MessagingCreateStreamRequest {
  name: string;
  subjects: string[];
  storage?: 'file' | 'memory';
  retention?: 'limits' | 'workqueue' | 'interest';
  maxMsgs?: number;
  maxBytes?: number;
  maxAgeSeconds?: number;
}
