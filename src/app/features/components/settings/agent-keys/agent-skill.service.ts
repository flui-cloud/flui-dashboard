import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../../core/services/app-config.service';

export interface AgentSkill {
  version: string;
  digest: string;
  filename: string;
  mediaType: string;
  mcpEndpoint: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class AgentSkillService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  skill(): Observable<AgentSkill> {
    return this.http.get<AgentSkill>(
      `${this.appConfig.apiBaseUrl}/api/v1/auth/agent-skill`,
    );
  }
}
