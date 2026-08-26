import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  AgentActivityPage,
  AgentIdentity,
  AgentIdentityActivityPage,
} from '../model/agent-activity.models';
import {
  AgentConcession,
  AgentProposal,
  ConcessionOperation,
  DecideResult,
  ProposalDecision,
  RevokeResult,
} from '../model/agent-cycle.models';

const ACTIVITY_PAGE = 50;

@Injectable({ providedIn: 'root' })
export class AgentCycleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private get root(): string {
    return `${this.appConfig.apiBaseUrl}/api/v1`;
  }

  private get base(): string {
    return `${this.root}/agent`;
  }

  listProposals(): Observable<AgentProposal[]> {
    return this.http.get<AgentProposal[]>(`${this.base}/proposals`);
  }

  proposal(id: string): Observable<AgentProposal> {
    return this.http.get<AgentProposal>(
      `${this.base}/proposals/${encodeURIComponent(id)}`,
    );
  }

  decide(id: string, decision: ProposalDecision): Observable<DecideResult> {
    return this.http.post<DecideResult>(
      `${this.base}/proposals/${encodeURIComponent(id)}/decide`,
      { decision },
    );
  }

  listConcessions(): Observable<AgentConcession[]> {
    return this.http.get<AgentConcession[]>(`${this.base}/concessions`);
  }

  runningUnder(concessionId: string): Observable<ConcessionOperation[]> {
    return this.http.get<ConcessionOperation[]>(
      `${this.base}/concessions/${encodeURIComponent(concessionId)}/operations`,
    );
  }

  revoke(concessionId: string, alsoStop: boolean): Observable<RevokeResult> {
    const query = alsoStop ? '?stop=true' : '';
    return this.http.delete<RevokeResult>(
      `${this.base}/concessions/${encodeURIComponent(concessionId)}${query}`,
    );
  }

  estimate(estimateRef: string): Observable<unknown> {
    const path = estimateRef.startsWith('/')
      ? estimateRef
      : `/${estimateRef}`;
    return this.http.get<unknown>(`${this.root}${path}`);
  }

  activity(limit = ACTIVITY_PAGE): Observable<AgentActivityPage> {
    return this.http.get<AgentActivityPage>(`${this.base}/activity`, {
      params: { limit: String(limit) },
    });
  }

  activityIdentities(): Observable<AgentIdentityActivityPage> {
    return this.http.get<AgentIdentityActivityPage>(
      `${this.base}/activity/identities`,
    );
  }

  agentIdentities(): Observable<AgentIdentity[]> {
    return this.http.get<AgentIdentity[]>(`${this.root}/auth/agent-identities`);
  }
}
