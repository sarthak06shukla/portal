import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueryService, DeveloperQuery } from '../../services/query.service';
import { Router } from '@angular/router';
import { ReportService } from '../../services/report.service';

interface QueryResults {
  columns: string[];
  rows: any[];
}

@Component({
  selector: 'app-query-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './query-editor.component.html',
  styleUrls: ['./query-editor.component.css']
})
export class QueryEditorComponent implements OnInit {
  queryName: string = '';
  variationName: string = '';
  queryText: string = '';

  queryHistory: DeveloperQuery[] = [];
  pendingQueries: DeveloperQuery[] = [];
  approvedQueries: DeveloperQuery[] = [];

  queryResults: QueryResults | null = null;
  queryVersions: DeveloperQuery[] = [];
  selectedQueryName: string = '';

  validateMessage: string | null = null;
  queryError: string | null = null;

  reportTypes: any[] = [];

  constructor(
    private queryService: QueryService,
    private reportService: ReportService,
    private router: Router
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { query: string };
    if (state?.query) {
      this.queryText = state.query;
    }
  }

  ngOnInit(): void {
    this.loadHistory();
    this.reportService.getAllReportTypes().subscribe({
      next: (types) => { this.reportTypes = types; },
      error: (err) => { console.error('Failed to load report types', err); }
    });
  }

  loadHistory(): void {
    this.queryService.getQueries().subscribe({
      next: (history) => {
        this.queryHistory = history;
        this.pendingQueries = history.filter(q => q.status === 'pending');
        this.approvedQueries = history.filter(q => q.status === 'approved');
      },
      error: (err) => {
        console.error('Failed to load query history', err);
      }
    });
  }

  deleteQuery(query: DeveloperQuery): void {
    if (confirm(`Are you sure you want to delete the query '${query.name}'?`)) {
      this.queryService.deleteQuery(query.id).subscribe({
        next: () => {
          this.validateMessage = `Query '${query.name}' deleted.`;
          this.loadHistory();
        },
        error: (err) => {
          this.queryError = `Failed to delete query: ${err.error?.detail || 'Unknown error'}`;
        }
      });
    }
  }

  validateAndSaveQuery(): void {
    if (!this.queryName.trim() || !this.queryText.trim()) {
      alert('Query name and text cannot be empty.');
      return;
    }

    this.validateMessage = null;
    this.queryError = null;
    this.queryService.runQuery(this.queryText).subscribe({
      next: (results) => {
        this.queryError = null;
        this.validateMessage = 'Query validated and saved!';
        this.queryResults = results;
        this.saveQuery();
      },
      error: (err) => {
        this.validateMessage = null;
        this.queryError = err.error?.detail || 'Query failed.';
      }
    });
  }

  runQuery(): void {
    if (!this.queryText.trim()) {
      return;
    }

    this.validateMessage = null;
    this.queryError = null;
    this.queryService.runQuery(this.queryText).subscribe({
      next: (results) => {
        this.queryResults = results;
        this.queryError = null;
      },
      error: (err) => {
        this.queryResults = null;
        this.queryError = err.error?.detail || 'Query failed.';
      }
    });
  }

  saveQuery(): void {
    const newQuery = {
      name: this.queryName,
      variation_name: this.variationName,
      query: this.queryText,
      status: 'approved' // Developers' queries are auto-approved
    };
    this.queryService.createQuery(newQuery).subscribe({
      next: (savedQuery) => {
        this.validateMessage = `Query '${savedQuery.name}' saved successfully!`;
        this.queryName = '';
        this.variationName = '';
        this.queryText = '';
        this.loadHistory();
      },
      error: (err) => {
        this.queryError = `Failed to save query: ${err.error?.detail || 'Unknown error'}`;
      }
    });
  }

  loadVersionsForName(name: string): void {
    this.selectedQueryName = name;
    this.queryService.getQueriesByName(name).subscribe({
      next: (versions) => {
        this.queryVersions = versions;
      },
      error: (err) => {
        this.queryVersions = [];
        console.error('Failed to load query versions', err);
      }
    });
  }

  selectQuery(query: DeveloperQuery): void {
    this.queryName = query.name;
    this.queryText = query.query;
    this.variationName = query.variation_name || '';
    this.loadVersionsForName(query.name);
  }

  approveQuery(query: DeveloperQuery): void {
    const reportType = prompt('Enter the report type to link this query to (or leave blank to keep current name):\n' + this.reportTypes.map(t => t.type).join(', '), query.name);
    if (reportType !== null) {
      let variationName = query.variation_name || '';
      variationName = prompt('Enter a variation name (optional):', variationName) || '';
      const updateData: any = {
        name: reportType,
        status: 'approved',
        variation_name: variationName
      };
      this.queryService.updateQuery(query.id, updateData).subscribe({
        next: () => {
          this.validateMessage = `Query linked to report type '${reportType}' and approved successfully.`;
          this.loadHistory();
        },
        error: (err) => {
          this.queryError = `Failed to approve query: ${err.error?.detail || 'Unknown error'}`;
        }
      });
    }
  }
}
