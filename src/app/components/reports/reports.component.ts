import { Component, OnInit, ElementRef, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NseService, ReportData, ReportType, Column, SearchOptions, GenericReportData } from '../../services/nse.service';
import { ReportSearchComponent } from '../report-search/report-search.component';

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [CommonModule, FormsModule, ReportSearchComponent],
    templateUrl: './reports.component.html',
    styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
    @ViewChild('dropdown') dropdownElement!: ElementRef;
    @ViewChild('dropdownButton') dropdownButton!: ElementRef;
    @ViewChild('columnManager') columnManagerRef!: ElementRef;
    @ViewChild('columnManagerButton') columnManagerButtonRef!: ElementRef;

    reports: ReportData[] = [];
    filteredReports: ReportData[] = [];
    selectedReport: ReportData | null = null;
    loading = false;
    error: string | null = null;
    availableCompanies: string[] = [];
    selectedCompanies: Set<string> = new Set();
    showCompanyDropdown = false;
    companySearchTerm: string = '';
    filteredCompanies: string[] = [];

    // Column Management
    showColumnManager = false;
    availableColumns: Column[] = [];
    visibleColumns: Set<string> = new Set();

    // Sorting
    sortField: string | null = null;
    sortDirection: 'asc' | 'desc' = 'asc';

    // Filters
    filters = {
        search: '',
        startDate: '',
        endDate: ''
    };

    // Column filters
    columnFilters: { [key: string]: { value: string, operator: string } } = {};

    constructor(private nseService: NseService) {
        this.filteredCompanies = [...this.availableCompanies];
    }

    ngOnInit(): void {
        // No longer loading report types here, it's handled by the child component
        // this.loadReportTypes();
    }

    ngOnDestroy(): void {
        // Cleanup if needed
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        // Handle dropdown clicks
        if (this.dropdownElement && this.dropdownButton) {
            const clickedInside =
                this.dropdownElement.nativeElement.contains(event.target) ||
                this.dropdownButton.nativeElement.contains(event.target);

            // Check if clicked element is the search input
            const isSearchInput = (event.target as HTMLElement).closest('.company-search') !== null;

            if (!clickedInside && !isSearchInput) {
                this.showCompanyDropdown = false;
            }
        }

        // Handle column manager clicks
        if (this.columnManagerRef && this.columnManagerButtonRef) {
            const clickedInsideColumnManager =
                this.columnManagerRef.nativeElement.contains(event.target) ||
                this.columnManagerButtonRef.nativeElement.contains(event.target);

            if (!clickedInsideColumnManager) {
                this.showColumnManager = false;
            }
        }
    }

    toggleDropdown(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.showCompanyDropdown = !this.showCompanyDropdown;
        if (this.showCompanyDropdown) {
            this.filterCompanies(); // Refresh filtered companies when opening dropdown
        }
    }

    toggleCompany(company: string, event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        if (this.selectedCompanies.has(company)) {
            this.selectedCompanies.delete(company);
        } else {
            this.selectedCompanies.add(company);
        }
        this.applyFilters(); // Ensure table updates after company selection
    }

    toggleAllCompanies(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        if (this.selectedCompanies.size === this.availableCompanies.length) {
            this.selectedCompanies.clear();
        } else {
            this.availableCompanies.forEach(company => this.selectedCompanies.add(company));
        }
        this.applyFilters(); // Ensure table updates after select all/none
    }

    updateAvailableCompanies(): void {
        if (this.reports.length > 0) {
            const companyField = this.getCompanyField();
            this.availableCompanies = Array.from(new Set(this.reports.map(report => report[companyField]))).sort();
            this.filterCompanies();
        }
    }

    isCompanySelected(company: string): boolean {
        return this.selectedCompanies.has(company);
    }

    isAllCompaniesSelected(): boolean {
        return this.selectedCompanies.size === this.availableCompanies.length;
    }

    getSelectedCompaniesText(): string {
        if (this.selectedCompanies.size === 0) return 'All Companies';
        if (this.selectedCompanies.size === this.availableCompanies.length) return 'All Companies';
        if (this.selectedCompanies.size === 1) return Array.from(this.selectedCompanies)[0];
        return `${this.selectedCompanies.size} companies selected`;
    }

    // Column visibility methods
    toggleColumnManager(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.showColumnManager = !this.showColumnManager;
        console.log('Column manager toggled:', this.showColumnManager);
    }

    toggleColumn(column: string, event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        console.log('Toggling column:', column);

        if (this.visibleColumns.has(column)) {
            // Prevent hiding the last visible column
            if (this.visibleColumns.size > 1) {
                this.visibleColumns.delete(column);
                console.log('Column hidden:', column);
            }
        } else {
            this.visibleColumns.add(column);
            console.log('Column shown:', column);
        }
    }

    isColumnVisible(column: string): boolean {
        const isVisible = this.visibleColumns.has(column);
        console.log('Checking column visibility:', column, isVisible);
        return isVisible;
    }

    // Sorting
    sort(field: string): void {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        this.applySorting();
    }

    getSortIndicator(field: string): string {
        if (this.sortField !== field) return '';
        return this.sortDirection === 'asc' ? '↑' : '↓';
    }

    private applySorting(): void {
        if (!this.sortField) return;

        this.filteredReports.sort((a, b) => {
            const aVal = a[this.sortField as keyof ReportData] ?? '';
            const bVal = b[this.sortField as keyof ReportData] ?? '';

            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    formatDate(date: string): string {
        return this.nseService.formatDate(date) || date;
    }

    applyFilters(): void {
        let tempReports = [...this.reports];

        // Company filter (dynamic field)
        const companyField = this.getCompanyField();
        console.log('Company field used for filtering:', companyField);
        console.log('Available companies:', this.availableCompanies);
        console.log('Selected companies:', Array.from(this.selectedCompanies));
        console.log('Company values in reports:', tempReports.map(r => r[companyField]));
        if (this.selectedCompanies.size > 0 && this.selectedCompanies.size !== this.availableCompanies.length) {
            tempReports = tempReports.filter(report => this.selectedCompanies.has(report[companyField]));
        }
        console.log('Filtered reports after company filter:', tempReports.map(r => r[companyField]));

        // Global search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            tempReports = tempReports.filter(report =>
                Object.values(report).some(value =>
                    String(value).toLowerCase().includes(searchTerm)
                )
            );
        }

        // Date range filter
        if (this.filters.startDate || this.filters.endDate) {
            tempReports = tempReports.filter(report => {
                const reportDate = new Date(report['date']);
                const startDate = this.filters.startDate ? new Date(this.filters.startDate) : null;
                const endDate = this.filters.endDate ? new Date(this.filters.endDate) : null;

                if (startDate && reportDate < startDate) return false;
                if (endDate && reportDate > endDate) return false;
                return true;
            });
        }

        // Column-specific filters
        tempReports = tempReports.filter(report => {
            return this.availableColumns.every(col => {
                const filter = this.columnFilters[col.key];
                if (!filter || !filter.value) return true;

                const cellValue = report[col.key];
                if (cellValue === undefined || cellValue === null) return false;

                const filterValue = filter.value;
                const operator = filter.operator;

                switch (col.filterType) {
                    case 'text':
                        return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
                    case 'number':
                        const numValue = parseFloat(String(cellValue));
                        const numFilter = parseFloat(filterValue);
                        if (isNaN(numValue) || isNaN(numFilter)) return false;
                        switch (operator) {
                            case 'equals': return numValue === numFilter;
                            case 'greater': return numValue > numFilter;
                            case 'less': return numValue < numFilter;
                            case 'between':
                                // This operator needs two values, handled separately if implemented fully
                                return true;
                            default: return false;
                        }
                    case 'date':
                        const dateValue = new Date(cellValue);
                        const dateFilter = new Date(filterValue);
                        if (isNaN(dateValue.getTime()) || isNaN(dateFilter.getTime())) return false;
                        switch (operator) {
                            case 'equals': return dateValue.toDateString() === dateFilter.toDateString();
                            case 'greater': return dateValue > dateFilter;
                            case 'less': return dateValue < dateFilter;
                            case 'between':
                                // This operator needs two values, handled separately if implemented fully
                                return true;
                            default: return false;
                        }
                    default: return true;
                }
            });
        });

        this.filteredReports = tempReports;
        this.applySorting(); // Re-apply sorting after filtering
    }

    updateColumnFilter(column: string, value: string): void {
        this.columnFilters[column].value = value;
        this.applyFilters();
    }

    handleFilterInput(event: Event, column: string): void {
        const inputElement = event.target as HTMLInputElement;
        this.updateColumnFilter(column, inputElement.value);
    }

    clearColumnFilter(column: string): void {
        this.columnFilters[column].value = '';
        this.applyFilters();
    }

    viewReport(report: ReportData): void {
        this.selectedReport = report;
    }

    closeReport(): void {
        this.selectedReport = null;
    }

    filterCompanies(): void {
        const searchTerm = this.companySearchTerm.toLowerCase();
        this.filteredCompanies = this.availableCompanies.filter(company =>
            company.toLowerCase().includes(searchTerm)
        );
    }

    // Helper to get all keys for type safety in template iteration
    getReportKeys(report: ReportData): string[] {
        if (!report) return [];
        // Return only visible column keys for iteration
        return this.availableColumns.filter(col => this.visibleColumns.has(col.key)).map(col => col.key);
    }

    // Get current column label for header display (if key changes like 'date' for 'period_end_dt')
    getColumnLabel(key: string): string {
        const column = this.availableColumns.find(col => col.key === key);
        return column ? column.label : key; // Fallback to key if label not found
    }

    // Get column type for filter input
    getColumnFilterType(key: string): string {
        const column = this.availableColumns.find(col => col.key === key);
        return column ? column.filterType || 'text' : 'text';
    }

    // Get column filter operator
    getColumnFilterOperator(key: string): string {
        const column = this.availableColumns.find(col => col.key === key);
        return column ? column.filterOperator || 'equals' : 'equals';
    }

    onReportDataLoaded(data: { columns: string[], rows: any[] } | null): void {
        if (!data) {
            this.reports = [];
            this.filteredReports = [];
            this.availableColumns = [];
            this.error = null;
            this.loading = false;
            return;
        }

        this.loading = true;
        this.error = null;

        this.availableColumns = data.columns.map(col => ({ key: col, label: col }));
        this.visibleColumns = new Set(data.columns);

        this.reports = data.rows as ReportData[];
        this.filteredReports = [...this.reports];

        this.updateAvailableCompanies();
        this.applyFilters();

        this.loading = false;
    }

    // Helper to get the company field key for the current report data
    private getCompanyField(): string {
        if (this.availableColumns.some(col => col.key === 'company')) {
            return 'company';
        } else if (this.availableColumns.some(col => col.key === 'company_name')) {
            return 'company_name';
        }
        // Fallback: try to find any column containing 'company'
        const found = this.availableColumns.find(col => col.key.toLowerCase().includes('company'));
        return found ? found.key : 'company';
    }
} 