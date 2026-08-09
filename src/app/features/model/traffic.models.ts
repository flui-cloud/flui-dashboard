export interface TrafficRate {
  requests_per_second: number | null;
  requests_in_window: number | null;
}

export interface TrafficStatus {
  rate_2xx: number | null;
  rate_3xx: number | null;
  rate_4xx: number | null;
  rate_5xx: number | null;
  server_error_percent: number | null;
  client_error_percent: number | null;
}

export interface TrafficLatency {
  p50_seconds: number | null;
  p90_seconds: number | null;
  p95_seconds: number | null;
  p99_seconds: number | null;
  mean_seconds: number | null;
  estimates_are_coarse: boolean;
  bucket_boundaries_seconds: number[];
}

export interface TrafficMethodBreakdown {
  method: string;
  requests_per_second: number | null;
}

export interface TrafficStatusCodeBreakdown {
  code: string;
  requests_per_second: number | null;
}

export interface ApplicationTraffic {
  rate: TrafficRate;
  status: TrafficStatus;
  latency: TrafficLatency;
  by_method: TrafficMethodBreakdown[];
  by_status_code: TrafficStatusCodeBreakdown[];
}

export interface AppTrafficResponse {
  app_id: string;
  app_name: string;
  namespace: string;
  cluster_id: string;
  traefik_service: string | null;
  is_routable: boolean;
  window: string;
  traffic: ApplicationTraffic;
  queried_at: string;
}

export interface TrafficHistoryPoint {
  timestamp: string;
  requests_per_second: number | null;
  rate_4xx: number | null;
  rate_5xx: number | null;
  p95_seconds: number | null;
}

export interface AppTrafficHistoryResponse {
  app_id: string;
  app_name: string;
  namespace: string;
  cluster_id: string;
  traefik_service: string | null;
  is_routable: boolean;
  range_start: string;
  range_end: string;
  step: string;
  window: string;
  data_points: TrafficHistoryPoint[];
  queried_at: string;
}
