// Mirrors the backend Kafka console contracts (kafka-client library + controller).

export interface KafkaBroker {
  nodeId: number;
  host: string;
  port: number;
  rack?: string;
}

export interface KafkaClusterInfo {
  clusterId?: string;
  controllerId?: number;
  brokers: KafkaBroker[];
}

export interface KafkaTopicSummary {
  name: string;
  partitions: number;
  replicationFactor: number;
  internal: boolean;
}

export interface KafkaGroupSummary {
  groupId: string;
  protocolType?: string;
}

export interface KafkaConsumedMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  timestamp?: string;
  encoding: 'utf8' | 'base64';
}

export type KafkaResultKind = 'table' | 'messages' | 'detail' | 'ack';

export interface KafkaCommandResult {
  command: string;
  verb: string;
  mutation: boolean;
  kind: KafkaResultKind;
  columns?: string[];
  rows?: Array<Array<string | number | null>>;
  messages?: KafkaConsumedMessage[];
  detail?: Record<string, unknown>;
  text?: string;
}

export interface KafkaConnectionInfo {
  engine: string;
  label: string;
  namespace: string;
  podLabelSelector: string;
  clusterId: string;
  remotePort: number;
}

export interface KafkaAssistResult {
  command: string;
  explanation: string;
  mutation: boolean;
}
