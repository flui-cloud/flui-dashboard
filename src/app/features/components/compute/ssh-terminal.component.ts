import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  input,
  inject,
  computed,
  effect,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';

import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalService } from '../../../core/services/terminal.service';
import { FlStatus } from '../../../ui/primitives/status';
import { FlSpinner } from '../../../ui/primitives/spinner';

/**
 * SSH Terminal Component
 * Renders an interactive xterm terminal connected to a server via WebSocket
 */
@Component({
  selector: 'app-ssh-terminal',
  imports: [FlStatus, FlSpinner],
  template: `
    <div class="terminal-container">
      @if (showOverlay()) {
        <div class="status-overlay" role="status">
          <div class="status-content">
            @if (connectionState() === 'connecting') {
              <fl-spinner label="Connecting" />
              <p class="status-title">Connecting to the server…</p>
            }
            @if (connectionState() === 'error') {
              <fl-status tone="error" [label]="errorMessage() || 'Could not connect'" />
              <p class="status-hint">Check the server status and try again.</p>
            }
            @if (connectionState() === 'disconnected' && hasAttemptedConnection()) {
              <fl-status tone="neutral" label="Disconnected from the server" />
            }
          </div>
        </div>
      }

      <div #terminalContainer class="xterm-wrapper" (click)="focusTerminal()"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .terminal-container {
        position: relative;
        height: 100%;
        background: #1e1e1e;
        border-radius: var(--fl-radius-md);
        overflow: hidden;
        border: 1px solid var(--fl-border);
      }

      .xterm-wrapper {
        width: 100%;
        height: 100%;
        padding: 8px 8px 16px 8px;
        box-sizing: border-box;
      }

      .status-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--fl-surface);
        color: var(--fl-ink);
        z-index: 10;
      }

      .status-content {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--fl-space-2);
        max-width: 420px;
        padding: var(--fl-space-4);
        color: var(--fl-ink-muted);
      }

      .status-title {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--fl-ink);
      }

      .status-content fl-status {
        white-space: normal;
      }

      .status-hint {
        margin: 0;
        font-size: 12px;
        color: var(--fl-ink-muted);
      }

      :host ::ng-deep .xterm {
        height: 100%;
      }

      :host ::ng-deep .xterm-viewport {
        overflow-y: auto;
      }

      :host ::ng-deep .xterm-screen {
        cursor: text;
      }
    `,
  ],
})
export class SshTerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  serverId = input.required<string>();
  serverIp = input.required<string>();
  useBootstrapKey = input<boolean>(false);
  clusterId = input<string | undefined>(undefined);

  private readonly terminalService = inject(TerminalService);

  readonly terminalContainer = viewChild.required<ElementRef<HTMLDivElement>>('terminalContainer');

  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private hasAttempted = false;

  connectionState = this.terminalService.connectionState;
  errorMessage = this.terminalService.errorMessage;

  showOverlay = computed(() => {
    const state = this.connectionState();
    return (
      state === 'connecting' || state === 'error' || (state === 'disconnected' && this.hasAttempted)
    );
  });

  hasAttemptedConnection = computed(() => this.hasAttempted);

  constructor() {
    effect(() => {
      if (this.connectionState() === 'connected' && this.terminal) {
        this.terminal.clear();
        this.terminal.writeln('\x1b[32mConnected to SSH session\x1b[0m');
        this.terminal.writeln('');

        this.terminalService.resizeTerminal(this.terminal.cols, this.terminal.rows);

        setTimeout(() => {
          this.terminal?.focus();
        }, 100);
      }
    });
  }

  ngOnInit(): void {
    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      fontWeight: '400',
      fontWeightBold: '700',
      letterSpacing: 0,
      lineHeight: 1.0,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      cols: 80,
      rows: 24,
      scrollback: 10000,
      tabStopWidth: 8,
      allowProposedApi: true,
      allowTransparency: false,
      windowOptions: {},
      convertEol: false,
      disableStdin: false,
      screenReaderMode: false,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.onData((data) => {
      if (this.connectionState() !== 'connected') return;
      this.terminalService.sendInput(data);
    });
  }

  ngAfterViewInit(): void {
    const terminalContainer = this.terminalContainer();
    if (!this.terminal || !terminalContainer) return;

    this.terminal.open(terminalContainer.nativeElement);

    this.wheelListener = (e: WheelEvent) => {
      e.stopPropagation();
    };
    terminalContainer.nativeElement.addEventListener('wheel', this.wheelListener, {
      passive: false,
    });

    this.terminal.writeln('\x1b[36mFlui Cloud Terminal\x1b[0m');
    this.terminal.writeln('Initializing terminal...');
    this.terminal.writeln('');

    setTimeout(() => {
      this.fitAddon?.fit();
      const dims = this.fitAddon?.proposeDimensions();

      if (dims) {
        const adjustedRows = Math.max(dims.rows - 1, 10);
        this.terminal?.resize(dims.cols, adjustedRows);
      }

      setTimeout(() => {
        this.terminal?.writeln('Connecting to server...');
        this.connect();
      }, 50);
    }, 150);

    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    const terminalContainer = this.terminalContainer();
    if (!terminalContainer) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.fitAddon && this.terminal) {
        this.fitAddon.fit();
        const dims = this.fitAddon.proposeDimensions();

        if (dims) {
          const adjustedRows = Math.max(dims.rows - 1, 10);
          this.terminal.resize(dims.cols, adjustedRows);

          if (this.connectionState() === 'connected') {
            this.terminalService.resizeTerminal(dims.cols, adjustedRows);
          }
        }
      }
    });

    this.resizeObserver.observe(terminalContainer.nativeElement);
  }

  private connect(): void {
    this.hasAttempted = true;

    const actualCols = this.terminal?.cols || 80;
    const actualRows = this.terminal?.rows || 24;

    this.terminalService.connect(
      this.serverId(),
      this.serverIp(),
      (data: string | Uint8Array) => {
        if (!this.terminal) return;
        this.terminal.write(data);
      },
      {
        cols: actualCols,
        rows: actualRows,
        useBootstrapKey: this.useBootstrapKey(),
        clusterId: this.clusterId(),
      },
    );
  }

  focusTerminal(): void {
    this.terminal?.focus();
  }

  ngOnDestroy(): void {
    const terminalContainer = this.terminalContainer();
    if (this.wheelListener && terminalContainer) {
      terminalContainer.nativeElement.removeEventListener('wheel', this.wheelListener);
      this.wheelListener = null;
    }
    this.resizeObserver?.disconnect();
    this.terminal?.dispose();
    this.terminalService.disconnect();
  }
}
