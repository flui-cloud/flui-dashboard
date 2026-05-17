import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyServerDto } from '../../../core/api/model/topologyServerDto';

export type ZoomLevel = 'galaxy' | 'star' | 'orbit' | 'world';
export type LabelMode = 'auto' | 'all' | 'off';
export type ShowMode = 'all' | 'user';

export interface MoonNode {
  app: AppNode;
  hostServer: ServerNode;
  moonIdx: number;
  moA: number;
  moS: number;
  moR: number;
  r: number;
  x: number;
  y: number;
}

export interface AppNode {
  id: string;
  raw: TopologyAppDto;
  galaxy: GalaxyNode;
  primaryServer: ServerNode;
  replicaServers: Array<{ server: ServerNode; count: number }>;
  category: TopologyAppDto.CategoryEnum;
  kind: TopologyAppDto.KindEnum;
  status: TopologyAppDto.StatusEnum;
  color: string;
  slug: string;
  ramRequestMB: number;
  replicaCount: number;
  oR: number;
  oA: number;
  oS: number;
  r: number;
  x: number;
  y: number;
  moons: MoonNode[];
  ringLevel: number;
}

export interface ServerNode {
  id: string;
  name: string;
  raw: TopologyServerDto;
  galaxy: GalaxyNode;
  role: TopologyServerDto.RoleEnum;
  x: number;
  y: number;
  r: number;
}

export interface GalaxyNode {
  id: string;
  name: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  r: number;
  servers: ServerNode[];
  apps: AppNode[];
}

export const CATEGORY_COLORS: Record<TopologyAppDto.CategoryEnum, string> = {
  database: '#FF6B9D',
  cache: '#FFC75F',
  storage: '#845EC2',
  automation: '#00C9A7',
  media: '#F9A84B',
  monitoring: '#4FC3F7',
  web: '#9FE1CB',
  business: '#D85A30',
  infra: '#7F77DD',
};

export const SYSTEM_COLOR = '#5A6678';

export const GALAXY_COLORS = [
  '#7F77DD',
  '#1D9E75',
  '#D85A30',
  '#4FC3F7',
  '#FFC75F',
  '#FF6B9D',
  '#00C9A7',
  '#845EC2',
];
