import { buildChatPrompt } from './connect-agent.component';

describe('buildChatPrompt', () => {
  const endpoint = 'https://api.shiny-panda-pf.62-238-51-202.nip.io/api/v1/mcp';
  const text = buildChatPrompt(endpoint);

  it('registers the server under the per-instance name in every agent command', () => {
    expect(text).toContain(`claude mcp add --transport http flui-shiny-panda-pf ${endpoint}`);
    expect(text).toContain(`codex mcp add flui-shiny-panda-pf --url ${endpoint}`);
    expect(text).toContain('{"mcp":{"flui-shiny-panda-pf":{"type":"remote"');
    expect(text).not.toContain('add --transport http flui ');
  });

  it('says what to do when the name is already taken', () => {
    expect(text).toContain('claude mcp remove flui-shiny-panda-pf');
  });

  it('tells each agent how to reload', () => {
    expect(text).toContain('Claude Code: run `/mcp` in the session, or restart it.');
    expect(text).toContain('Codex CLI and OpenCode: restart the session.');
  });

  it('ends by checking the connection with my_permissions against this host', () => {
    expect(text).toContain('`get_started`');
    expect(text).toContain('`my_permissions`');
    expect(text).toContain('api.shiny-panda-pf.62-238-51-202.nip.io, so you know');
  });

  it('never carries a key', () => {
    expect(text).toContain("export FLUI_MCP_TOKEN='paste-the-key-here'");
    expect(text).toContain('${FLUI_MCP_TOKEN}');
  });
});
