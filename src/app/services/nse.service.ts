import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BaseData {
    id: number;
    company: string;
    date: string;
}

export interface StockData extends BaseData {
    open_price: number;
    high_price: number;
    low_price: number;
    close_price: number;
    volume: number;
}

export interface FinancialMetricsData extends BaseData {
    pe_ratio: number;
    market_cap: number;
    book_value: number;
    debt_to_equity: number;
    current_ratio: number;
    roce: number;
}

export interface PerformanceData extends BaseData {
    returns_1m: number;
    returns_3m: number;
    returns_6m: number;
    returns_1y: number;
    volatility: number;
    beta: number;
}

export interface DividendData extends BaseData {
    dividend_yield: number;
    payout_ratio: number;
    dividend_per_share: number;
    dividend_growth: number;
}

export interface Dividend {
    company: string;
    date: string;
    dividend_amount: number;
    dividend_type: string;
    is_eligible: string;
}

export interface TechnicalIndicatorsData extends BaseData {
    rsi_14: number;
    macd: number;
    macd_signal: number;
    ma_20: number;
    ma_50: number;
    ma_200: number;
    bollinger_upper: number;
    bollinger_middle: number;
    bollinger_lower: number;
    atr: number;
    stochastic_k: number;
    stochastic_d: number;
}

export interface ProfitReportData extends BaseData {
    application_no: string;
    symbol: string;
    company_name: string;
    period_type: string;
    period_end_dt: string;
    net_profit_loss_for_t: number;
    from_date: string;
    to_date: string;
    audited_unaudited: string;
    consolidated: string;
    indasnonind: string;
    rf_result_format: string;
}

export interface ReportData {
    id: number;
    [key: string]: any;  // Allow string indexing for dynamic column access
}

export type GenericReportData = StockData | FinancialMetricsData | PerformanceData | DividendData | TechnicalIndicatorsData | ProfitReportData;

export interface ReportType {
    type: string;
    name: string;
    description: string;
    columns: Column[];
    query_name?: string;
}

export interface Column {
    key: string;
    label: string;
    filterType?: 'text' | 'number' | 'date';
    filterOperator?: 'equals' | 'contains' | 'greater' | 'less' | 'between';
}

export interface SearchOptions {
    reportType: string;
    companies?: string[];
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
}

export interface RunQueryResult {
    columns: string[];
    rows: any[];
}

@Injectable({
    providedIn: 'root'
})
export class DataService {
    private apiUrl = environment.apiBaseUrl;  // FastAPI backend URL

    constructor(private http: HttpClient) { }

    getCompanies(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/companies`);
    }

    getReportTypes(): Observable<ReportType[]> {
        return this.http.get<ReportType[]>(`${this.apiUrl}/report-types`);
    }

    searchData(options: SearchOptions): Observable<ReportData[]> {
        let params = new HttpParams()
            .set('report_type', options.reportType);

        if (options.searchTerm) {
            params = params.set('search_term', options.searchTerm);
        }
        if (options.startDate) {
            params = params.set('start_date', options.startDate);
        }
        if (options.endDate) {
            params = params.set('end_date', options.endDate);
        }
        if (options.companies && options.companies.length) {
            options.companies.forEach(company => {
                params = params.append('companies', company);
            });
        }

        return this.http.get<ReportData[]>(`${this.apiUrl}/reports/search`, { params });
    }

    downloadDataAsCSV(data: ReportData[], columns: Column[], filename: string = 'data-analysis.csv'): void {
        if (!data || data.length === 0) return;

        // Create CSV header row from visible columns
        const header = columns.map(col => col.label).join(',');

        // Convert data to CSV rows
        const csvRows = data.map(item => {
            return columns.map(col => {
                let value = item[col.key];

                // Format date values
                if (value) {
                    // Try to detect and format date values
                    const formattedDate = this.formatDate(value);
                    if (formattedDate) {
                        value = formattedDate;
                    }
                }

                // Handle values that might contain commas by wrapping in quotes
                return value ? `\"${value}\"` : '';
            }).join(',');
        });

        // Combine header and rows
        const csvContent = [header, ...csvRows].join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    public formatDate(value: any): string | null {
        return this._formatDate(value);
    }

    private _formatDate(value: any): string | null {
        // If it's already a Date object
        if (value instanceof Date) {
            return this._toLocaleDateString(value);
        }

        // If it's a string, try different date formats
        if (typeof value === 'string') {
            // Remove any surrounding quotes
            value = value.replace(/^["\']|["\']$/g, '');

            // Try parsing ISO format
            if (this._isISODateString(value)) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return this._toLocaleDateString(date);
                }
            }

            // Try parsing Unix timestamp (both seconds and milliseconds)
            if (/^\\d+$/.test(value)) {
                const timestampMs = value.length === 10 ? parseInt(value) * 1000 : parseInt(value);
                const date = new Date(timestampMs);
                if (!isNaN(date.getTime()) && date.getFullYear() > 1970 && date.getFullYear() < 2100) {
                    return this._toLocaleDateString(date);
                }
            }

            // Try parsing other common date formats
            const date = new Date(value);
            if (!isNaN(date.getTime()) && date.getFullYear() > 1970 && date.getFullYear() < 2100) {
                return this._toLocaleDateString(date);
            }
        }

        // If it's a number (timestamp)
        if (typeof value === 'number') {
            const date = new Date(value);
            if (!isNaN(date.getTime()) && date.getFullYear() > 1970 && date.getFullYear() < 2100) {
                return this._toLocaleDateString(date);
            }
        }

        return null;
    }

    private _toLocaleDateString(date: Date): string {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    private _isISODateString(value: string): boolean {
        // Check if string matches ISO date format (YYYY-MM-DD or with time)
        const isoDatePattern = /^\\d{4}-\\d{2}-\\d{2}(T|\\s)?/;
        return isoDatePattern.test(value) && !isNaN(Date.parse(value));
    }

    runSavedQuery(reportName: string): Observable<RunQueryResult> {
        return this.http.get<RunQueryResult>(`${this.apiUrl}/api/run-saved-query`, { params: { name: reportName } });
    }
} 