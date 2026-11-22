import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronDown, lucideChevronUp, lucideCopy } from '@ng-icons/lucide';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { FlAlert } from '../../../../ui/patterns/alert';
import { FlPanel } from '../../../../ui/patterns/panel';
import { FlButton } from '../../../../ui/primitives/button';
import { FlIcon } from '../../../../ui/primitives/icon';
import { FlTag } from '../../../../ui/primitives/tag';
import { AgentSkill } from './agent-skill.service';
import { mcpServerName } from './mcp-server-name';

/**
 * The copy-paste-into-chat message, built once and shown identically whether
 * a key was just minted or this block is being revisited days later.
 *
 * It never carries the key itself, on purpose: this text is meant to be
 * pasted into a coding agent's chat, and anything typed there sits in the
 * model's own context. The one place the real value is allowed to appear is
 * the human's own terminal, in a step this text only *describes* — which is
 * also why the text is the same in both modes. A key minted five minutes ago
 * and one minted five weeks ago are told to do the exact same thing.
 */
export function buildChatPrompt(mcpEndpoint: string): string {
  const name = mcpServerName(mcpEndpoint);
  const host = hostOf(mcpEndpoint);
  return [
    `I'm connected to the Flui instance at ${host}. Before anything else, get yourself talking to it directly.`,
    '',
    '1. Ask the person guiding you to open a terminal (not this chat) and run, replacing the placeholder with the key they were given:',
    '',
    "   export FLUI_MCP_TOKEN='paste-the-key-here'",
    '',
    `2. Then, in that same terminal, run whichever of these matches you. The server is named \`${name}\` so it never collides with another Flui instance:`,
    '',
    '   Claude Code:',
    `     claude mcp add --transport http ${name} ${mcpEndpoint} --header "Authorization: Bearer \${FLUI_MCP_TOKEN}"`,
    '',
    '   Codex CLI:',
    `     codex mcp add ${name} --url ${mcpEndpoint} --bearer-token-env-var FLUI_MCP_TOKEN`,
    '',
    '   OpenCode (add to opencode.json):',
    `     {"mcp":{"${name}":{"type":"remote","url":"${mcpEndpoint}","headers":{"Authorization":"Bearer {env:FLUI_MCP_TOKEN}"}}}}`,
    '',
    `   If a server named \`${name}\` already exists, remove it first (\`claude mcp remove ${name}\` or \`codex mcp remove ${name}\`) or choose another name.`,
    '',
    '3. Reload so the new server is picked up:',
    '',
    '   Claude Code: run `/mcp` in the session, or restart it.',
    '   Codex CLI and OpenCode: restart the session.',
    '',
    '4. Call the `get_started` tool it offers. It explains how to operate here, in the same session, with no separate fetch or header.',
    '',
    `5. Call \`my_permissions\` and check that \`instance.apiUrl\` is on ${host}, so you know you are connected to the right instance.`,
  ].join('\n');
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

@Component({
  selector: 'app-connect-agent',
  host: { class: 'block' },
  imports: [FlAlert, FlPanel, FlButton, FlIcon, FlTag],
  providers: [provideIcons({ lucideCheck, lucideChevronDown, lucideChevronUp, lucideCopy })],
  template: `
    <fl-panel title="Connect an agent">
      <button
        panelActions
        flButton="ghost"
        size="sm"
        type="button"
        data-testid="connect-agent-toggle"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        {{ open() ? 'Hide' : 'Show' }}
        <fl-icon [name]="open() ? 'lucideChevronUp' : 'lucideChevronDown'" [size]="14" />
      </button>
      <div class="flex flex-col gap-4">
        <p class="m-0 text-fl-body-sm text-fl-ink-muted">
          {{
            apiKey()
              ? 'Copy this before you leave. The key is shown once.'
              : 'Instructions to paste into a coding agent chat, any time.'
          }}
        </p>

        @if (open()) {
          @if (apiKey(); as key) {
            <fl-alert tone="warning" title="Copy the key now">
              This is the only time the value is shown. If you lose it, revoke this key and issue
              another.
            </fl-alert>
            <div class="flex items-center gap-2">
              <code
                data-testid="minted-key"
                class="fl-mono min-w-0 flex-1 truncate rounded-fl-md border border-fl-border bg-fl-surface-subtle px-3 py-2"
                >{{ key }}</code
              >
              <button
                flButton="primary"
                size="sm"
                type="button"
                data-testid="copy-key"
                (click)="copy(key)"
              >
                <fl-icon [name]="keyCopied() ? 'lucideCheck' : 'lucideCopy'" [size]="14" />
                {{ keyCopied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
          }

          <section class="flex flex-col gap-2" aria-label="Paste this into your agent's chat">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="m-0 text-fl-body-sm font-semibold">Paste this into your agent's chat</h3>
              <button
                flButton
                size="sm"
                type="button"
                data-testid="connect-agent-copy-prompt"
                (click)="copyPrompt()"
              >
                <fl-icon [name]="promptCopied() ? 'lucideCheck' : 'lucideCopy'" [size]="14" />
                {{ promptCopied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p class="m-0 text-fl-caption text-fl-ink-muted">
              Covers Claude Code, Codex CLI and OpenCode: the agent reads the section that matches
              it. The key never appears in this text; it tells whoever is guiding the agent to put
              it in a terminal instead.
            </p>
            <pre
              data-testid="connect-agent-prompt"
              class="fl-mono m-0 max-h-72 overflow-auto whitespace-pre rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
              >{{ chatPrompt() }}</pre>
          </section>

          @if (skill(); as doc) {
            <section class="flex flex-col gap-2" data-testid="skill-handoff">
              <button
                type="button"
                class="fl-link inline-flex items-center gap-1 self-start text-fl-caption"
                data-testid="skill-section-toggle"
                [attr.aria-expanded]="skillSectionOpen()"
                (click)="skillSectionOpen.set(!skillSectionOpen())"
              >
                <fl-icon
                  [name]="skillSectionOpen() ? 'lucideChevronUp' : 'lucideChevronDown'"
                  [size]="13"
                />
                Not using MCP? Get <span class="fl-mono">{{ doc.filename }}</span> directly
              </button>
              @if (skillSectionOpen()) {
                <div class="flex flex-col gap-2">
                  <fl-tag class="self-start" data-testid="skill-version"
                    >skill {{ doc.version }}</fl-tag
                  >
                  <p class="m-0 text-fl-caption text-fl-ink-muted">
                    Already included the moment your agent calls
                    <code class="fl-mono">get_started</code> over MCP, in step 4 above: that is the
                    same document. This is only for an agent that cannot make MCP tool calls at all;
                    it carries no credential, so it is safe to commit.
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      flButton
                      size="sm"
                      type="button"
                      data-testid="copy-skill"
                      (click)="copySkill(doc.content)"
                    >
                      <fl-icon [name]="skillCopied() ? 'lucideCheck' : 'lucideCopy'" [size]="14" />
                      {{ skillCopied() ? 'Copied' : 'Copy ' + doc.filename }}
                    </button>
                    <button
                      flButton="ghost"
                      size="sm"
                      type="button"
                      data-testid="show-skill"
                      (click)="skillOpen.set(!skillOpen())"
                    >
                      {{ skillOpen() ? 'Hide it' : 'Read it first' }}
                    </button>
                  </div>
                  @if (skillOpen()) {
                    <pre
                      data-testid="skill-content"
                      class="fl-mono m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded-fl-md border border-fl-border bg-fl-surface-subtle p-3"
                      >{{ doc.content }}</pre>
                  }
                </div>
              }
            </section>
          } @else if (skillError()) {
            <p class="m-0 text-fl-body-sm text-fl-ink-muted" data-testid="skill-missing">
              {{ skillError() }}
            </p>
          }

          @if (apiKey()) {
            <div class="flex justify-end">
              <button
                flButton="ghost"
                size="sm"
                type="button"
                data-testid="dismiss-minted"
                (click)="dismiss.emit()"
              >
                I have copied it
              </button>
            </div>
          }
        }
      </div>
    </fl-panel>
  `,
})
export class ConnectAgentComponent implements OnInit {
  /** The live plaintext value — only ever present in the moment right after minting. */
  readonly apiKey = input<string | null>(null);
  readonly skill = input<AgentSkill | null>(null);
  readonly skillError = input<string | null>(null);

  /** Emitted only from the fresh-key panel's "I have copied it" affordance. */
  readonly dismiss = output<void>();

  private readonly cfg = inject(AppConfigService);

  protected readonly open = signal(false);
  protected readonly keyCopied = signal(false);
  protected readonly promptCopied = signal(false);
  protected readonly skillSectionOpen = signal(false);
  protected readonly skillOpen = signal(false);
  protected readonly skillCopied = signal(false);

  protected readonly chatPrompt = computed(() =>
    buildChatPrompt(`${this.cfg.apiBaseUrl || globalThis.location?.origin || ''}/api/v1/mcp`),
  );

  ngOnInit(): void {
    this.open.set(!!this.apiKey());
  }

  protected copy(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        this.keyCopied.set(true);
        setTimeout(() => this.keyCopied.set(false), 2_000);
      })
      .catch(() => undefined);
  }

  protected copyPrompt(): void {
    void navigator.clipboard?.writeText(this.chatPrompt()).then(() => {
      this.promptCopied.set(true);
      setTimeout(() => this.promptCopied.set(false), 2_000);
    });
  }

  protected copySkill(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        this.skillCopied.set(true);
        setTimeout(() => this.skillCopied.set(false), 2_000);
      })
      .catch(() => this.skillOpen.set(true));
  }
}
