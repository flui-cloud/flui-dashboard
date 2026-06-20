import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog.component';
import { MessagingConsoleService } from '../../service/messaging-console.service';
import {
  JsStream,
  MessagingEngine,
  MessagingPublishResult,
  MessagingServerInfo,
  QueueMessage,
} from '../../model/messaging-console.models';
import { consoleError } from './messaging-format';

type ConnState = 'connecting' | 'connected' | 'error';

interface MessagingNouns {
  collection: string;
  item: string;
  itemTitle: string;
  routing: string;
  storageChoice: boolean;
  storeFile: string;
  storeMem: string;
  subjectEg: string;
}

const NOUNS: Record<MessagingEngine, MessagingNouns> = {
  nats: {
    collection: 'JetStream streams',
    item: 'stream',
    itemTitle: 'Stream',
    routing: 'Subjects',
    storageChoice: true,
    storeFile: 'file storage',
    storeMem: 'memory storage',
    subjectEg: 'orders.>',
  },
  rabbitmq: {
    collection: 'Queues',
    item: 'queue',
    itemTitle: 'Queue',
    routing: 'Bindings',
    storageChoice: false,
    storeFile: 'durable',
    storeMem: 'transient',
    subjectEg: 'orders.#',
  },
};

@Injectable()
export class MessagingConsoleStateService {
  private readonly api = inject(MessagingConsoleService);
  private readonly router = inject(Router);

  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly server = signal<MessagingServerInfo | null>(null);
  readonly streams = signal<JsStream[]>([]);
  readonly expanded = signal<string | null>(null);

  readonly engine = signal<MessagingEngine>('nats');
  readonly engineLabel = signal('NATS');
  nouns(): MessagingNouns {
    return NOUNS[this.engine()];
  }

  readonly publishing = signal(false);
  readonly publishResult = signal<MessagingPublishResult | null>(null);
  readonly publishError = signal<string | null>(null);

  readonly peekStreamName = signal('');
  readonly peeking = signal(false);
  readonly peeked = signal(false);
  readonly peekMessages = signal<QueueMessage[]>([]);
  readonly peekError = signal<string | null>(null);

  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly pendingDelete = signal<string | null>(null);

  init(): void {
    const id = this.appId();
    if (id) {
      this.api.getConnectionInfo(id).subscribe({
        next: (info) => {
          this.engine.set(info.engine);
          this.engineLabel.set(info.label);
        },
        error: () => {
          /* fall back to NATS terminology */
        },
      });
    }
    this.connect();
  }

  connect(): void {
    const id = this.appId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getServerInfo(id).subscribe({
      next: (info) => {
        this.server.set(info);
        this.api.getStreams(id).subscribe({
          next: (s) => {
            this.streams.set(s);
            this.conn.set('connected');
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  /**
   * Silent refresh of stats + streams after a publish/create/delete — updates
   * only the affected numbers, without flipping the connection state (which
   * would flash the whole page back to the "Connecting…" placeholder).
   */
  refreshStats(): void {
    const id = this.appId();
    if (!id) return;
    this.api.getServerInfo(id).subscribe({ next: (info) => this.server.set(info) });
    this.api.getStreams(id).subscribe({ next: (s) => this.streams.set(s) });
  }

  private fail(e: unknown): void {
    this.errorMsg.set(consoleError(e));
    this.conn.set('error');
  }

  toggle(name: string): void {
    this.expanded.set(this.expanded() === name ? null : name);
  }

  createStream(
    name: string,
    subjects: string[],
    storage: 'file' | 'memory',
    onDone: () => void,
  ): void {
    const id = this.appId();
    if (!id || !name || !subjects.length) return;
    this.creating.set(true);
    this.createError.set(null);
    this.api.createStream(id, { name, subjects, storage }).subscribe({
      next: () => {
        this.creating.set(false);
        this.peekStreamName.set(name);
        onDone();
        this.refreshStats();
      },
      error: (e) => {
        this.createError.set(consoleError(e));
        this.creating.set(false);
      },
    });
  }

  askDelete(name: string, dialog?: ConfirmationDialogComponent): void {
    this.pendingDelete.set(name);
    dialog?.open();
  }

  confirmDelete(dialog?: ConfirmationDialogComponent): void {
    const id = this.appId();
    const name = this.pendingDelete();
    if (!id || !name) return;
    dialog?.setProcessing(true);
    this.api.deleteStream(id, name).subscribe({
      next: () => {
        dialog?.close();
        this.pendingDelete.set(null);
        if (this.peekStreamName() === name) this.peekStreamName.set('');
        this.refreshStats();
      },
      error: (e) => {
        dialog?.setProcessing(false);
        dialog?.close();
        this.pendingDelete.set(null);
        this.peekError.set(consoleError(e));
      },
    });
  }

  publish(subject: string, payload: string): void {
    const id = this.appId();
    const trimmed = subject.trim();
    if (!id || !trimmed) return;
    this.publishing.set(true);
    this.publishError.set(null);
    this.publishResult.set(null);
    this.api.publish(id, { subject: trimmed, payload }).subscribe({
      next: (r) => {
        this.publishResult.set(r);
        this.publishing.set(false);
        this.refreshStats();
      },
      error: (e) => {
        this.publishError.set(consoleError(e));
        this.publishing.set(false);
      },
    });
  }

  peek(): void {
    const id = this.appId();
    const stream = this.peekStreamName();
    if (!id || !stream) return;
    this.peeking.set(true);
    this.peekError.set(null);
    this.api.peek(id, { stream, limit: 20 }).subscribe({
      next: (msgs) => {
        this.peekMessages.set(msgs);
        this.peeked.set(true);
        this.peeking.set(false);
      },
      error: (e) => {
        this.peekError.set(consoleError(e));
        this.peeking.set(false);
      },
    });
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
