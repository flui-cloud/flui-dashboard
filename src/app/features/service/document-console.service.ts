import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/services/app-config.service';
import {
  CommandResult,
  DocAssistRequest,
  DocAssistResult,
  DocCommandRequest,
  DocFindRequest,
  DocShellRequest,
  DocShellResult,
  DocumentCollection,
  DocumentDatabase,
  DocumentField,
  DocumentPage,
  DocumentStoreSummary,
} from '../model/document-console.models';

@Injectable({ providedIn: 'root' })
export class DocumentConsoleService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private base(appId: string): string {
    return `${this.appConfig.apiBaseUrl}/api/v1/applications/${appId}/doc`;
  }

  getSummary(appId: string): Observable<DocumentStoreSummary> {
    return this.http.get<DocumentStoreSummary>(`${this.base(appId)}/summary`);
  }

  getDatabases(appId: string): Observable<DocumentDatabase[]> {
    return this.http.get<DocumentDatabase[]>(`${this.base(appId)}/databases`);
  }

  getCollections(
    appId: string,
    database: string,
  ): Observable<DocumentCollection[]> {
    return this.http.post<DocumentCollection[]>(
      `${this.base(appId)}/collections`,
      { database },
    );
  }

  findDocuments(appId: string, req: DocFindRequest): Observable<DocumentPage> {
    return this.http.post<DocumentPage>(`${this.base(appId)}/documents`, req);
  }

  getFields(
    appId: string,
    database: string,
    collection: string,
  ): Observable<DocumentField[]> {
    return this.http.post<DocumentField[]>(`${this.base(appId)}/fields`, {
      database,
      collection,
    });
  }

  runCommand(appId: string, req: DocCommandRequest): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.base(appId)}/command`, req);
  }

  runShell(appId: string, req: DocShellRequest): Observable<DocShellResult> {
    return this.http.post<DocShellResult>(`${this.base(appId)}/shell`, req);
  }

  assist(appId: string, req: DocAssistRequest): Observable<DocAssistResult> {
    return this.http.post<DocAssistResult>(`${this.base(appId)}/assist`, req);
  }
}
