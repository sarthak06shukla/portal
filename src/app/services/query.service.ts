import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface DeveloperQuery {
  id: number;
  name: string;
  variation_name?: string;
  query: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface CustomQueryPayload {
  report: string;
  columns: string[];
  orderBy?: string;
  orderDirection?: string;
  operation?: string;
}

export interface RunQueryResult {
  columns: string[];
  rows: any[];
}

@Injectable({
  providedIn: 'root'
})
export class QueryService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  getQueries(filters: { name?: string; status?: string } = {}): Observable<DeveloperQuery[]> {
    let params = new HttpParams();
    if (filters.name) {
      params = params.set('name', filters.name);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    return this.http.get<DeveloperQuery[]>(`${this.apiUrl}/developer-queries`, { params });
  }

  createQuery(query: { name: string, variation_name?: string, query: string, status: string }): Observable<DeveloperQuery> {
    return this.http.post<DeveloperQuery>(`${this.apiUrl}/developer-queries`, query);
  }

  runQuery(query: string): Observable<RunQueryResult> {
    return this.http.post<RunQueryResult>(`${this.apiUrl}/run-query`, { query });
  }

  runCustomQuery(payload: CustomQueryPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/custom-query`, payload);
  }

  getQuery(id: number): Observable<DeveloperQuery> {
    return this.http.get<DeveloperQuery>(`${this.apiUrl}/developer-queries/${id}`);
  }

  updateQuery(id: number, data: { name?: string, status?: string, variation_name?: string }): Observable<DeveloperQuery> {
    return this.http.put<DeveloperQuery>(`${this.apiUrl}/developer-queries/${id}`, data);
  }

  deleteQuery(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/developer-queries/${id}`);
  }

  getQueriesByName(name: string): Observable<DeveloperQuery[]> {
    return this.http.get<DeveloperQuery[]>(`${this.apiUrl}/developer-queries`, { params: { name } });
  }

  linkQueryToReport(reportTypeName: string, developerQueryName: string): Observable<any> {
    const body = {
      report_type_name: reportTypeName,
      developer_query_name: developerQueryName
    };
    return this.http.post(`${this.apiUrl}/link-query-to-report`, body);
  }

  getQueriesForReport(reportType: string): Observable<DeveloperQuery[]> {
    return this.http.get<DeveloperQuery[]>(`${this.apiUrl}/queries-for-report/${reportType}`);
  }

  getReportTypeForQuery(queryName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/report-type-for-query/${queryName}`);
  }
}
