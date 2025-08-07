import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl } from '@angular/forms';
import { QueryService, DeveloperQuery } from '../../services/query.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap, take, filter } from 'rxjs/operators';

@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './query-builder.component.html',
  styleUrl: './query-builder.component.css'
})
export class QueryBuilderComponent implements OnDestroy {
  queryForm: FormGroup;
  reports = [
    { id: 'stock_prices', name: 'Stock Prices' },
    { id: 'financial_metrics', name: 'Financial Metrics' },
    { id: 'performance', name: 'Performance' },
    { id: 'dividend', name: 'Dividend' },
    { id: 'technical_indicators', name: 'Technical Indicators' },
    { id: 'profit_report', name: 'Profit Report' },
  ];
  // Sample groupings for each report type
  columnGroups: { [key: string]: { group: string, columns: string[] }[] } = {
    'stock_prices': [
      { group: 'Price Data', columns: ['open_price', 'high_price', 'low_price', 'close_price'] },
      { group: 'Volume Data', columns: ['volume'] },
      { group: 'Meta', columns: ['date', 'company'] }
    ],
    'financial_metrics': [
      { group: 'Ratios', columns: ['pe_ratio', 'debt_to_equity', 'current_ratio', 'roce'] },
      { group: 'Values', columns: ['market_cap', 'book_value'] },
      { group: 'Meta', columns: ['date', 'company'] }
    ],
    'performance': [
      { group: 'Returns', columns: ['returns_1m', 'returns_3m', 'returns_6m', 'returns_1y'] },
      { group: 'Risk', columns: ['volatility', 'beta'] },
      { group: 'Meta', columns: ['date', 'company'] }
    ],
    'dividend': [
      { group: 'Dividend Info', columns: ['dividend_yield', 'payout_ratio', 'dividend_per_share', 'dividend_growth'] },
      { group: 'Eligibility', columns: ['is_eligible'] },
      { group: 'Meta', columns: ['date', 'company'] }
    ],
    'technical_indicators': [
      { group: 'Momentum', columns: ['rsi_14', 'macd', 'macd_signal'] },
      { group: 'Moving Averages', columns: ['ma_20', 'ma_50', 'ma_200'] },
      { group: 'Bands', columns: ['bollinger_upper', 'bollinger_middle', 'bollinger_lower'] },
      { group: 'Other', columns: ['atr', 'stochastic_k', 'stochastic_d'] },
      { group: 'Meta', columns: ['date', 'company'] }
    ],
    'profit_report': [
      { group: 'Company Info', columns: ['application_no', 'symbol', 'company_name'] },
      { group: 'Period', columns: ['period_type', 'period_end_dt', 'from_date', 'to_date'] },
      { group: 'Financials', columns: ['net_profit_loss_for_t'] },
      { group: 'Audit', columns: ['audited_unaudited', 'consolidated', 'indasnonind', 'rf_result_format'] }
    ]
  };
  selectedReportId: string = '';
  // For dynamic group/column selection
  get selectedColumnGroups() {
    return this.columnGroups[this.selectedReportId] || [];
  }
  // For results
  queryResult: any[] | null = null;
  resultColumns: string[] = [];
  isLoading = false;
  error: string | null = null;
  isWaitingForApproval = false;
  private pollingSubscription?: Subscription;

  constructor(private fb: FormBuilder, private queryService: QueryService, private router: Router) {
    this.queryForm = this.fb.group({
      report: [''],
      groups: this.fb.array([]),
      orderBy: [''],
      orderDirection: ['ASC'],
      operation: ['']
    });
    this.queryForm.get('report')?.valueChanges.subscribe(reportId => {
      this.selectedReportId = reportId;
      this.updateGroupsFormArray();
    });
  }

  get groupsFormArray() {
    return this.queryForm.get('groups') as FormArray;
  }

  updateGroupsFormArray() {
    const groups = this.selectedColumnGroups;
    this.groupsFormArray.clear();
    groups.forEach(group => {
      this.groupsFormArray.push(this.fb.array(group.columns.map(() => false)));
    });
    this.queryForm.get('orderBy')?.setValue('');
  }

  buildQueryString(): string {
    const formValue = this.queryForm.value;
    let selectParts: string[] = [];
    const groups = this.selectedColumnGroups;
    groups.forEach((group, gIdx) => {
      const selectedCols = formValue.groups[gIdx]
        .map((checked: boolean, cIdx: number) => checked ? group.columns[cIdx] : null)
        .filter((v: string | null) => v !== null);
      selectParts.push(...selectedCols.map((col: string) => col));
    });
    if (selectParts.length === 0 || !formValue.report) {
      return '';
    }
    let sql = `SELECT ${selectParts.join(', ')} FROM ${formValue.report}`;
    if (formValue.orderBy) {
      const direction = formValue.orderDirection || 'ASC';
      sql += ` ORDER BY ${formValue.orderBy} ${direction}`;
    }
    if (formValue.operation) {
      sql += ` ${formValue.operation}`;
    }
    return sql;
  }

  onSubmit() {
    this.error = null;
    const queryString = this.buildQueryString();
    if (!queryString) {
      this.error = "Please select at least one column to build a query.";
      return;
    }
    // Generate a temporary name for the user's query
    const tempName = `user_query_${Date.now()}`;
    this.queryService.createQuery({ name: tempName, query: queryString, status: 'pending' }).subscribe({
      next: (savedQuery) => {
        this.isWaitingForApproval = true;
        this.startPolling(savedQuery.id);
      },
      error: (err: HttpErrorResponse) => {
        this.error = `Could not submit query: ${err.error?.detail || 'Unknown error'}`;
      }
    });
  }

  startPolling(queryId: number) {
    this.pollingSubscription = timer(0, 5000) // Poll every 5 seconds
      .pipe(
        switchMap(() => this.queryService.getQuery(queryId)),
        filter(query => query.status === 'approved')
      )
      .subscribe(approvedQuery => {
        this.stopPolling();
        this.isWaitingForApproval = false;
        this.router.navigate(['/'], { queryParams: { report: approvedQuery.name } });
      });
  }

  stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  get allColumnsForOrderBy(): string[] {
    // Flatten all columns from all groups for the selected report
    return this.selectedColumnGroups.flatMap(group => group.columns);
  }
}
