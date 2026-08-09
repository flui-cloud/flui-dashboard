export interface AlertEvent {
  id: string;
  status: 'firing' | 'resolved';
  resolved_by?: 'alertmanager' | 'timeout' | null;
  alertname: string;
  severity: string;
  flui_kind?: string | null;
  summary: string;
  description?: string | null;
  application_id?: string | null;
  application_slug?: string | null;
  namespace?: string | null;
  cluster_id?: string | null;
  node_instance?: string | null;
  starts_at: string;
  ends_at?: string | null;
  last_seen_at: string;
}

export interface AlertsResponse {
  alerts: AlertEvent[];
  firing: number;
  queried_at: string;
}
