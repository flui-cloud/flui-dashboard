import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBookOpen,
  lucideCheck,
  lucideChevronDown,
  lucideCopy,
  lucidePlugZap,
} from '@ng-icons/lucide';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { AgentSkill } from './agent-skill.service';

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
function buildChatPrompt(mcpEndpoint: string): string {
  return [
    "I'm connected to a Flui instance. Before anything else, get yourself talking to it directly.",
    '',
    '1. Ask the person guiding you to open a terminal — not this chat — and run, replacing the placeholder with the key they were given:',
    '',
    "   export FLUI_MCP_TOKEN='paste-the-key-here'",
    '',
    '2. Then, in that same terminal, run whichever of these matches you:',
    '',
    '   Claude Code:',
    `     claude mcp add --transport http flui ${mcpEndpoint} --header "Authorization: Bearer \${FLUI_MCP_TOKEN}"`,
    '',
    '   Codex CLI:',
    `     codex mcp add flui --url ${mcpEndpoint} --bearer-token-env-var FLUI_MCP_TOKEN`,
    '',
    '   OpenCode (add to opencode.json):',
    `     {"mcp":{"flui":{"type":"remote","url":"${mcpEndpoint}","headers":{"Authorization":"Bearer {env:FLUI_MCP_TOKEN}"}}}}`,
    '',
    "3. Once connected, call the `get_started` tool it offers — it explains how to operate here, in the same session, no separate fetch or header needed.",
  ].join('\n');
}

@Component({
  selector: 'app-connect-agent',
  standalone: true,
  // A custom element defaults to `display: inline`, which starves it of the
  // block box every sibling spacing utility (`space-y-*`) assumes — the one
  // reason this looked cramped next to plain `<div hlmCard>` siblings that
  // never had to think about it.
  host: { class: 'block' },
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideBookOpen,
      lucideCheck,
      lucideChevronDown,
      lucideCopy,
      lucidePlugZap,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        data-testid="connect-agent-toggle"
        (click)="open.set(!open())"
        class="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <ng-icon name="lucidePlugZap" class="h-4 w-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-foreground">Connect an agent</span>
          <span class="block text-xs text-muted-foreground">
            {{ apiKey() ? 'Copy this before you leave — the key is shown once.' : 'Instructions to paste into a coding agent chat, any time.' }}
          </span>
        </span>
        <ng-icon
          name="lucideChevronDown"
          class="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
          [class.rotate-180]="open()"
        />
      </button>

      @if (open()) {
        <div class="space-y-4 border-t border-border p-4">
          @if (apiKey(); as key) {
            <div class="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p class="text-xs text-muted-foreground">
                This is the only time the value is shown. If you lose it, revoke this key and issue another.
              </p>
              <div class="flex items-center gap-2">
                <code
                  data-testid="minted-key"
                  class="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                >{{ key }}</code>
                <button
                  type="button"
                  data-testid="copy-key"
                  (click)="copy(key)"
                  class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ng-icon [name]="keyCopied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                  {{ keyCopied() ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
          }

          <div class="space-y-1.5">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Paste this into your agent's chat
            </p>
            <p class="text-xs text-muted-foreground">
              Covers Claude Code, Codex CLI and OpenCode — the agent reads the section that matches
              it. The key never appears in this text; it tells whoever is guiding the agent to put it
              in a terminal instead.
            </p>
            <div class="relative">
              <pre
                data-testid="connect-agent-prompt"
                class="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-3 pr-16 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre"
              >{{ chatPrompt() }}</pre>
              <button
                type="button"
                data-testid="connect-agent-copy-prompt"
                (click)="copyPrompt()"
                class="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ng-icon [name]="promptCopied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                {{ promptCopied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
          </div>

          @if (skill(); as doc) {
            <div class="rounded-md border border-border bg-background" data-testid="skill-handoff">
              <button
                type="button"
                data-testid="skill-section-toggle"
                (click)="skillSectionOpen.set(!skillSectionOpen())"
                class="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <ng-icon name="lucideBookOpen" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span class="flex-1 text-xs text-muted-foreground">
                  Not using MCP? Get <span class="font-mono">{{ doc.filename }}</span> directly
                </span>
                <ng-icon
                  name="lucideChevronDown"
                  class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                  [class.rotate-180]="skillSectionOpen()"
                />
              </button>
              @if (skillSectionOpen()) {
                <div class="space-y-2 border-t border-border px-3 py-2">
                  <span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" data-testid="skill-version">
                    skill {{ doc.version }}
                  </span>
                  <p class="text-xs text-muted-foreground">
                    Already included the moment your agent calls <code>get_started</code> over MCP,
                    in step 3 above — that is the same document. This is only for an agent that
                    cannot make MCP tool calls at all; it carries no credential, so it is safe to
                    commit.
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="copy-skill"
                      (click)="copySkill(doc.content)"
                      class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <ng-icon [name]="skillCopied() ? 'lucideCheck' : 'lucideCopy'" class="h-3.5 w-3.5" />
                      {{ skillCopied() ? 'Copied' : 'Copy ' + doc.filename }}
                    </button>
                    <button
                      type="button"
                      data-testid="show-skill"
                      (click)="skillOpen.set(!skillOpen())"
                      class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {{ skillOpen() ? 'Hide it' : 'Read it first' }}
                    </button>
                  </div>
                  @if (skillOpen()) {
                    <pre
                      data-testid="skill-content"
                      class="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap"
                    >{{ doc.content }}</pre>
                  }
                </div>
              }
            </div>
          } @else if (skillError()) {
            <div class="rounded-md border border-border bg-background px-3 py-2" data-testid="skill-missing">
              <p class="text-xs text-muted-foreground">{{ skillError() }}</p>
            </div>
          }

          @if (apiKey()) {
            <button
              type="button"
              data-testid="dismiss-minted"
              (click)="dismiss.emit()"
              class="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              I have copied it
            </button>
          }
        </div>
      }
    </div>
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
    buildChatPrompt(`${this.cfg.apiBaseUrl}/api/v1/mcp`),
  );

  ngOnInit(): void {
    // Open by the moment that matters most — right after a mint, closed
    // otherwise, so revisiting the section stays compact until asked for.
    this.open.set(!!this.apiKey());
  }

  protected copy(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        this.keyCopied.set(true);
        setTimeout(() => this.keyCopied.set(false), 2_000);
      })
      .catch(() => {
        // Clipboard unavailable (insecure context) — the key is already
        // rendered in full above, so there is no fallback to offer.
      });
  }

  protected copyPrompt(): void {
    void navigator.clipboard
      ?.writeText(this.chatPrompt())
      .then(() => {
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
