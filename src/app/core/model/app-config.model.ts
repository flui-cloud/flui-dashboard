export type CertificateMode = 'staging' | 'preflight' | 'production';

export interface AppConfig {
  apiBaseUrl: string;
  wsUrl: string;
  authMode: 'local' | 'oidc';
  oidcIssuer: string;
  oidcClientId: string;
  certificateMode: CertificateMode;
}
