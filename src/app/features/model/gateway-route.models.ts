export type GatewayMinRole = 'viewer' | 'editor' | 'manager';

export interface GatewayAuthPolicy {
  sso: boolean;
  minRole?: GatewayMinRole;
}

export interface GatewayRateLimitPolicy {
  average: number;
  burst?: number;
  period?: string;
}

export interface GatewayRoute {
  endpointId: string;
  host: string;
  path: string;
  applicationId: string;
  service: string;
  endpointType: string;
  tlsEnabled: boolean;
  certificateStatus?: string | null;
  auth?: GatewayAuthPolicy | null;
  rateLimit?: GatewayRateLimitPolicy | null;
  allowIps?: string[] | null;
  reconciliationStatus: string;
  errorMessage?: string | null;
}

export interface AddGatewayRouteRequest {
  host: string;
  path?: string;
  certificateRequired?: boolean;
  auth?: GatewayAuthPolicy;
  rateLimit?: GatewayRateLimitPolicy;
  allowIps?: string[];
}

export interface SetGatewayPolicyRequest {
  path?: string | null;
  auth?: GatewayAuthPolicy | null;
  rateLimit?: GatewayRateLimitPolicy | null;
  allowIps?: string[] | null;
}

export interface GatewayStatus {
  total: number;
  synced: number;
  routes: GatewayRoute[];
}
