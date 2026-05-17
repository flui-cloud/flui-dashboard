// Development-only environment. Override per-deployment via environment.production.ts
// or by providing values at build time with `--configuration production`.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',
  enableLogging: true,
  features: {
    railpackEnabled: false,
  },
};
