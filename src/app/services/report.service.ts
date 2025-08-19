import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Report } from '../models/report.model';

export interface SearchParams {
    companies?: string[];
    startDate?: string;
    endDate?: string;
    search?: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReportService {
    private apiUrl = environment.apiBaseUrl;

    constructor(private http: HttpClient) { }

    searchReports(params: SearchParams): Observable<Report[]> {
        let httpParams = new HttpParams();

        if (params.companies && params.companies.length > 0) {
            params.companies.forEach(company => {
                httpParams = httpParams.append('companies', company);
            });
        }
        if (params.startDate) {
            httpParams = httpParams.set('start_date', params.startDate);
        }
        if (params.endDate) {
            httpParams = httpParams.set('end_date', params.endDate);
        }
        if (params.search) {
            httpParams = httpParams.set('search_term', params.search);
        }

        return this.http.get<Report[]>(`${this.apiUrl}/reports/search`, { params: httpParams });
    }

    getReport(id: number): Observable<Report> {
        return this.http.get<Report>(`${this.apiUrl}/reports/${id}`);
    }

    getAllReportTypes(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/report-types`);
    }

    getReports(
        reportType: string,
        companies: string[] | null,
        startDate: string | null,
        endDate: string | null,
        searchTerm: string | null
    ): Observable<any> {
        let params = new HttpParams().set('report_type', reportType);
        if (companies && companies.length) {
            companies.forEach(company => {
                params = params.append('companies', company);
            });
        }
        if (startDate) {
            params = params.set('start_date', startDate);
        }
        if (endDate) {
            params = params.set('end_date', endDate);
        }
        if (searchTerm) {
            params = params.set('search_term', searchTerm);
        }
        return this.http.get<any>(`${this.apiUrl}/reports/search`, { params });
    }

    runSavedQuery(name: string): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/api/run-saved-query`, { params: { name } });
    }

    runSavedQueryById(id: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/api/run-saved-query`, { params: { id: id.toString() } });
    }
} 