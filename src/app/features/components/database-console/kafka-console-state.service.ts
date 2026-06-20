import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { KafkaConsoleService } from '../../service/kafka-console.service';
import {
  KafkaClusterInfo,
  KafkaCommandResult,
  KafkaGroupSummary,
  KafkaTopicSummary,
} from '../../model/kafka-console.models';
import { AssistFn } from './db-assistant-chat.component';
import { consoleError } from './kafka-format';

type ConnState = 'connecting' | 'connected' | 'error';

export interface KafkaExample {
  label: string;
  text: string;
  write?: boolean;
}

export const KAFKA_EXAMPLES: KafkaExample[] = [
  { label: 'topics list', text: 'topics list' },
  { label: 'cluster info', text: 'cluster info' },
  { label: 'groups list', text: 'groups list' },
  { label: 'create topic', text: 'topic create my-topic --partitions 3 --replication 1', write: true },
  { label: 'produce', text: 'produce my-topic key "hello"', write: true },
  { label: 'consume tail', text: 'consume my-topic --from-end 20' },
];

@Injectable()
export class KafkaConsoleStateService {
  private readonly api = inject(KafkaConsoleService);
  private readonly router = inject(Router);

  readonly appId = signal<string | null>(null);

  readonly conn = signal<ConnState>('connecting');
  readonly errorMsg = signal('');
  readonly cluster = signal<KafkaClusterInfo | null>(null);
  readonly topics = signal<KafkaTopicSummary[]>([]);
  readonly groups = signal<KafkaGroupSummary[]>([]);

  commandText = 'topics list';
  readonly readOnly = signal(true);
  readonly running = signal(false);
  readonly result = signal<KafkaCommandResult | null>(null);
  readonly runError = signal('');

  readonly examples = KAFKA_EXAMPLES;

  // NL→kafka-shell copilot. The "code" is the single command; mutation comes
  // from the backend (which parses the command to classify it).
  readonly chatAssist: AssistFn = (prompt, conversation, model) =>
    this.api
      .assist(this.appId() ?? '', {
        prompt,
        conversation,
        model: model?.model,
        provider: model?.provider,
        connectionId: model?.connectionId,
      })
      .pipe(
        map((r) => ({
          text: r.explanation,
          code: r.command || undefined,
          mutation: r.mutation,
        })),
      );

  onChatRun(ev: { code: string; mutation: boolean }): void {
    this.commandText = ev.code;
    // A write the user already confirmed in chat runs once as a one-off (forceWrite) —
    // the persistent read-only toggle is left untouched, so the runner doesn't stay armed.
    this.runCommand(ev.mutation);
  }

  onChatInsert(code: string): void {
    this.commandText = code;
  }

  connect(): void {
    const id = this.appId();
    if (!id) return;
    this.conn.set('connecting');
    this.api.getClusterInfo(id).subscribe({
      next: (info) => {
        this.cluster.set(info);
        this.conn.set('connected');
        this.refreshOverview();
      },
      error: (e) => {
        this.errorMsg.set(consoleError(e));
        this.conn.set('error');
      },
    });
  }

  private refreshOverview(): void {
    const id = this.appId();
    if (!id) return;
    this.api.topics(id).subscribe({ next: (t) => this.topics.set(t) });
    this.api.groups(id).subscribe({ next: (g) => this.groups.set(g) });
  }

  loadExample(ex: KafkaExample): void {
    // Populate the runner only — never auto-execute and never enable write mode. Write mode
    // is turned on solely by the user via the explicit toggle; the chip's "write" badge flags
    // it. A write example left under read-only is rejected by the backend with a clear message.
    this.commandText = ex.text;
  }

  describeTopic(name: string): void {
    this.commandText = `topic describe ${name}`;
    this.runCommand();
  }

  groupLag(groupId: string): void {
    this.commandText = `group lag ${groupId}`;
    this.runCommand();
  }

  runCommand(forceWrite = false): void {
    const id = this.appId();
    const command = this.commandText.trim();
    if (!id || !command) return;
    this.runError.set('');
    this.running.set(true);
    this.api
      .run(id, { command, readOnly: forceWrite ? false : this.readOnly() })
      .subscribe({
      next: (r) => {
        this.result.set(r);
        this.running.set(false);
        // A successful write may have changed topics/groups — refresh the overview.
        if (r.mutation) this.refreshOverview();
      },
      error: (e) => {
        this.runError.set(consoleError(e));
        this.running.set(false);
      },
    });
  }

  back(): void {
    void this.router.navigate(['/apps/applications', this.appId()]);
  }
}
