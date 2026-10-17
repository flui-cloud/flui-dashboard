import { mcpServerName } from './mcp-server-name';

describe('mcpServerName', () => {
  const cases: Array<[string, string]> = [
    ['https://api.flui.cloud/api/v1/mcp', 'flui-flui-cloud'],
    ['https://API.Flui.Cloud/api/v1/mcp', 'flui-flui-cloud'],
    ['https://api.shiny-panda-pf.62-238-51-202.nip.io/api/v1/mcp', 'flui-shiny-panda-pf'],
    ['https://api.62-238-51-202.nip.io/api/v1/mcp', 'flui-62-238-51-202'],
    ['https://api.blue-fox.10.0.0.7.sslip.io/api/v1/mcp', 'flui-blue-fox'],
    ['https://app-acme.example.com/api/v1/mcp', 'flui-acme-example-com'],
    ['http://localhost:3000/api/v1/mcp', 'flui-localhost-3000'],
    ['http://62.238.51.202:3000/api/v1/mcp', 'flui-62-238-51-202-3000'],
    ['https://api.staging.acme-corporation.example.com/api/v1/mcp', 'flui-staging-acme'],
  ];

  for (const [endpoint, name] of cases) {
    it(`names ${endpoint} ${name}`, () => {
      expect(mcpServerName(endpoint)).toBe(name);
    });
  }

  it('gives two instances two names', () => {
    expect(mcpServerName('https://api.one.example.com/api/v1/mcp')).not.toBe(
      mcpServerName('https://api.two.example.com/api/v1/mcp'),
    );
  });

  it('falls back to flui when the endpoint is not a URL', () => {
    expect(mcpServerName('/api/v1/mcp')).toBe('flui');
  });

  it('keeps every name short enough for agent tool names', () => {
    for (const [endpoint] of cases) {
      expect(mcpServerName(endpoint).length).toBeLessThanOrEqual(25);
    }
  });
});
