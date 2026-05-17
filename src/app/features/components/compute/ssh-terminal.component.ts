import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  input,
  inject,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalService } from '../../../core/services/terminal.service';

/**
 * SSH Terminal Component
 * Renders an interactive xterm terminal connected to a server via WebSocket
 */
@Component({
  selector: 'app-ssh-terminal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="terminal-container">
      <!-- Status overlay -->
      @if (showOverlay()) {
        <div class="status-overlay">
          <div class="status-content">
            @if (connectionState() === 'connecting') {
              <div class="spinner"></div>
              <p>Connecting to server...</p>
            }
            @if (connectionState() === 'error') {
              <div class="error-icon">⚠</div>
              <p class="error-message">{{ errorMessage() }}</p>
              <p class="error-hint">Check server status and try again</p>
            }
            @if (connectionState() === 'disconnected' && hasAttemptedConnection()) {
              <div class="info-icon">ℹ</div>
              <p>Disconnected from server</p>
            }
          </div>
        </div>
      }

      <!-- Terminal container -->
      <div #terminalContainer class="xterm-wrapper" (click)="focusTerminal()"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .terminal-container {
      position: relative;
      height: 100%;
      background: #1e1e1e;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid hsl(var(--border));
    }

    .xterm-wrapper {
      width: 100%;
      height: 100%;
      padding: 8px 8px 16px 8px; /* top right bottom left - more space at bottom */
      box-sizing: border-box;
    }

    .status-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      color: white;
      z-index: 10;
    }

    .status-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-icon, .info-icon {
      font-size: 48px;
    }

    .error-message {
      font-weight: 600;
      font-size: 16px;
    }

    .error-hint {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
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
  `]
})
export class SshTerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  // Inputs
  serverId = input.required<string>();
  serverIp = input.required<string>();
  useBootstrapKey = input<boolean>(false);
  clusterId = input<string | undefined>(undefined);

  // Services
  private readonly terminalService = inject(TerminalService);

  // Terminal elements
  @ViewChild('terminalContainer', { static: true })
  terminalContainer!: ElementRef<HTMLDivElement>;

  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private wheelListener: ((e: WheelEvent) => void) | null = null;
  private hasAttempted = false;

  // Computed states
  connectionState = this.terminalService.connectionState;
  errorMessage = this.terminalService.errorMessage;

  showOverlay = computed(() => {
    const state = this.connectionState();
    return state === 'connecting' || state === 'error' ||
           (state === 'disconnected' && this.hasAttempted);
  });

  hasAttemptedConnection = computed(() => this.hasAttempted);

  constructor() {
    // Auto-focus terminal when connection is established
    effect(() => {
      if (this.connectionState() === 'connected' && this.terminal) {
        this.terminal.clear();
        this.terminal.writeln('\x1b[32mConnected to SSH session\x1b[0m');
        this.terminal.writeln('');

        // Force resize after connection to ensure PTY has correct dimensions
        this.terminalService.resizeTerminal(this.terminal.cols, this.terminal.rows);

        // Focus terminal for user interaction
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
        brightWhite: '#ffffff'
      },
      cols: 80,
      rows: 24,
      scrollback: 10000,
      tabStopWidth: 8,
      allowProposedApi: true,
      allowTransparency: false,
      windowOptions: {},
      // Critical for proper character handling
      convertEol: false,  // Don't convert line endings - let the server handle it
      disableStdin: false, // Enable stdin
      screenReaderMode: false,
      // Better scrolling
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.onData((data) => {
      if (this.connectionState() !== 'connected') return;
      this.terminalService.sendInput(data);
    });
  }

  ngAfterViewInit(): void {
    if (!this.terminal || !this.terminalContainer) return;

    this.terminal.open(this.terminalContainer.nativeElement);

    this.wheelListener = (e: WheelEvent) => { e.stopPropagation(); };
    this.terminalContainer.nativeElement.addEventListener('wheel', this.wheelListener, { passive: false });

    this.terminal.writeln('\x1b[36mFlui Cloud Terminal\x1b[0m');
    this.terminal.writeln('Initializing terminal...');
    this.terminal.writeln('');

    setTimeout(() => {
      this.fitAddon?.fit();
      const dims = this.fitAddon?.proposeDimensions();

      if (dims) {
        // Subtract 1 row to prevent last line from being cut off
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

  /**
   * Setup resize observer to auto-fit terminal on container resize
   */
  private setupResizeObserver(): void {
    if (!this.terminalContainer) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.fitAddon && this.terminal) {
        // Fit addon to container
        this.fitAddon.fit();
        const dims = this.fitAddon.proposeDimensions();

        if (dims) {
          const adjustedRows = Math.max(dims.rows - 1, 10);
          this.terminal.resize(dims.cols, adjustedRows);

          // Notify server of new dimensions (only if connected)
          if (this.connectionState() === 'connected') {
            this.terminalService.resizeTerminal(dims.cols, adjustedRows);
          }
        }
      }
    });

    this.resizeObserver.observe(this.terminalContainer.nativeElement);
  }

  /**
   * Connect to SSH session
   */
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
      }
    );
  }

  focusTerminal(): void {
    this.terminal?.focus();
  }

  ngOnDestroy(): void {
    if (this.wheelListener && this.terminalContainer) {
      this.terminalContainer.nativeElement.removeEventListener('wheel', this.wheelListener);
      this.wheelListener = null;
    }
    this.resizeObserver?.disconnect();
    this.terminal?.dispose();
    this.terminalService.disconnect();
  }
}
