import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../services/report.service';
import { QueryService, DeveloperQuery } from '../../services/query.service';

@Component({
    selector: 'app-report-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './report-search.component.html',
    styleUrls: ['./report-search.component.css']
})
export class ReportSearchComponent implements OnInit {
    reportTypes: any[] = [];
    selectedReport: any = null;
    queryVariations: DeveloperQuery[] = [];
    selectedVariationId: number | null = null;

    @Output() search = new EventEmitter<any>();
    @Output() reportData = new EventEmitter<any>();

    constructor(private reportService: ReportService, private queryService: QueryService) { }

    ngOnInit(): void {
        this.reportService.getAllReportTypes().subscribe((data: any[]) => {
            this.reportTypes = data;
        });
    }

    onReportSelect(): void {
        if (this.selectedReport) {
            console.log('Selected report:', this.selectedReport);
            console.log('Using report type:', this.selectedReport.type);
            // Get queries that are compatible with this report type by checking table references
            this.queryService.getQueriesForReport(this.selectedReport.type).subscribe((compatibleQueries: DeveloperQuery[]) => {
                console.log('Compatible queries found:', compatibleQueries);
                this.queryVariations = compatibleQueries;

                if (compatibleQueries.length > 0) {
                    // Find the latest variation to select by default
                    const latestVariation = compatibleQueries.reduce((latest, current) =>
                        new Date(current.created_at) > new Date(latest.created_at) ? current : latest
                    );
                    this.selectedVariationId = latestVariation.id;
                    this.onVariationSelect(); // Auto-load data for the latest variation
                } else {
                    this.selectedVariationId = null;
                    this.reportData.emit(null); // Clear data if no variations found
                }
            });
        } else {
            this.queryVariations = [];
            this.selectedVariationId = null;
            this.reportData.emit(null); // Clear data if no report is selected
        }
    }

    onVariationSelect(): void {
        if (this.selectedVariationId) {
            this.reportService.runSavedQueryById(this.selectedVariationId).subscribe((data: any) => {
                this.reportData.emit(data);
            });
        }
    }

    onSearch(): void {
        if (this.selectedReport) {
            this.search.emit({
                reportType: this.selectedReport.type,
            });
        }
    }
} 