import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DataService, ReportData, ReportType, Column } from '../../services/nse.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { debounceTime, distinctUntilChanged, filter, switchMap, take } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { QueryService } from '../../services/query.service';

@Component({
    selector: 'app-nse-data',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        ClickOutsideDirective
    ],
    templateUrl: './nse-data.component.html',
    styleUrls: ['./nse-data.component.css']
})
export class NseDataComponent implements OnInit {
    searchForm: FormGroup;
    filterForm: FormGroup;  // Separate form for filters
    reportData: ReportData[] = [];
    companies: string[] = [];
    filteredCompanies: string[] = [];
    companySearchTerm: string = '';
    isLoading = false;

    // Report Types
    reportTypes: ReportType[] = [];
    selectedReportType?: ReportType;
    filteredReportTypes: ReportType[] = [];
    showReportSuggestions = false;

    // Dropdowns State
    isCompanyDropdownOpen = false;
    isColumnDropdownOpen = false;

    // Filters and Columns
    showFilters = false;
    isFiltersApplied = false;
    availableColumns: Column[] = [];
    visibleColumns = new Set<string>();

    // Row Selection
    selectedRows = new Set<number>();
    visibility = true;

    private originalReportData: ReportData[] = [];

    constructor(private fb: FormBuilder, private dataService: DataService, private route: ActivatedRoute, private queryService: QueryService) {
        this.searchForm = this.fb.group({
            reportType: [''],
            selectedCompanies: [[]],
            companySearch: [''],
            startDate: [''],
            endDate: ['']
        });

        this.filterForm = this.fb.group({});  // Initialize empty filter form
        this.initializeForm();
    }

    ngOnInit(): void {
        this.loadCompanies();
        this.setupSubscriptions();
        // Load report types and then check for query params
        this.loadReportTypes().then(() => {
            this.route.queryParams.pipe(take(1)).subscribe(params => {
                const reportName = params['report'];
                if (reportName) {
                    // First try to find a report type with this query_name
                    const reportToSelect = this.reportTypes.find(rt => rt.query_name === reportName);
                    if (reportToSelect) {
                        this.selectReportType(reportToSelect.type);
                        this.searchForm.get('reportType')?.disable(); // Lock the dropdown
                    } else {
                        // If no direct match, check if it's a custom query name
                        this.queryService.getReportTypeForQuery(reportName).subscribe({
                            next: (result) => {
                                console.log('Found report type for query:', result);
                                const reportType = this.reportTypes.find(rt => rt.type === result.report_type);
                                if (reportType) {
                                    this.selectReportType(reportType.type);
                                    this.searchForm.get('reportType')?.disable(); // Lock the dropdown
                                    // Update URL to show the correct report type
                                    this.updateUrlWithReportType(result.report_type);
                                }
                            },
                            error: (error) => {
                                console.error('Error finding report type for query:', error);
                                // If we can't find the report type, show all reports but don't lock
                            }
                        });
                    }
                }
            });
        });
    }

    private initializeForm(): void {
        // Subscribe to report type changes for suggestions
        this.searchForm.get('reportType')?.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(value => this.filterReportTypes(value));

        // Subscribe to company search changes
        this.searchForm.get('companySearch')?.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(value => this.filterCompanies(value));

        // Subscribe to company selection changes
        this.searchForm.get('selectedCompanies')?.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(() => {
                if (this.selectedReportType) {
                    this.loadData();
                }
            });

        // Subscribe to date range changes
        const startDateControl = this.searchForm.get('startDate');
        const endDateControl = this.searchForm.get('endDate');

        startDateControl?.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(() => {
                if (this.selectedReportType && startDateControl.value && endDateControl?.value) {
                    this.loadData();
                }
            });

        endDateControl?.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(() => {
                if (this.selectedReportType && startDateControl?.value && endDateControl.value) {
                    this.loadData();
                }
            });

        // Subscribe to filter form changes
        this.filterForm.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe(() => {
                this.applyFilters();
            });
    }

    // Initialize or update filter controls based on available columns
    private initializeFilterControls(): void {
        // Remove old controls
        Object.keys(this.filterForm.controls).forEach(key => {
            this.filterForm.removeControl(key);
        });

        // Add new controls for each column
        this.availableColumns.forEach(col => {
            this.filterForm.addControl(col.key, new FormControl(''));
        });
    }

    private loadData(): void {
        this.isLoading = true;
        const formValue = this.searchForm.value;

        // Validate date range
        if (formValue.startDate && formValue.endDate) {
            const startDate = new Date(formValue.startDate);
            const endDate = new Date(formValue.endDate);

            if (startDate > endDate) {
                console.error('Start date cannot be after end date');
                this.isLoading = false;
                return;
            }
        }

        const searchOptions = {
            reportType: this.selectedReportType?.type || '',
            companies: formValue.selectedCompanies || [],
            startDate: formValue.startDate ? new Date(formValue.startDate).toISOString().split('T')[0] : '',
            endDate: formValue.endDate ? new Date(formValue.endDate).toISOString().split('T')[0] : '',
            searchTerm: formValue.searchTerm || ''
        };

        this.dataService.searchData(searchOptions).subscribe({
            next: (data: ReportData[]) => {
                this.originalReportData = [...data];
                this.reportData = [...data];

                if (data.length > 0) {
                    const firstRow = data[0];
                    // First, get all columns except id
                    const allColumns = Object.keys(firstRow)
                        .filter(key => key !== 'id')
                        .map(key => ({
                            key,
                            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                        }));

                    // Separate company and date columns
                    const companyColumn = allColumns.find(col => col.key === 'company');
                    const dateColumn = allColumns.find(col => col.key === 'date');
                    const otherColumns = allColumns.filter(col => col.key !== 'company' && col.key !== 'date');

                    // Combine columns in the desired order
                    this.availableColumns = [
                        ...(companyColumn ? [companyColumn] : []),
                        ...(dateColumn ? [dateColumn] : []),
                        ...otherColumns
                    ];

                    // Initialize visible columns if empty
                    if (this.visibleColumns.size === 0) {
                        this.visibleColumns = new Set(this.availableColumns.map(col => col.key));
                    }

                    // Initialize filter controls
                    this.initializeFilterControls();
                }

                this.isLoading = false;
            },
            error: (error: Error) => {
                console.error('Error loading data:', error);
                this.isLoading = false;
            }
        });
    }

    // Apply filters to the data
    applyFilters(): void {
        const filters = this.filterForm.value;
        let filteredData = [...this.originalReportData];

        // Apply filters if any exist
        Object.keys(filters).forEach(key => {
            const filterValue = filters[key]?.toString().toLowerCase().trim();
            if (filterValue) {
                filteredData = filteredData.filter(item => {
                    const cellValue = item[key];
                    if (cellValue === null || cellValue === undefined) {
                        return false;
                    }

                    // Handle different data types
                    if (typeof cellValue === 'number') {
                        // Try exact numeric match first
                        const numericFilter = parseFloat(filterValue);
                        if (!isNaN(numericFilter) && cellValue === numericFilter) {
                            return true;
                        }
                        // Fall back to string includes for partial matches
                        return cellValue.toString().toLowerCase().includes(filterValue);
                    } else if (cellValue instanceof Date || this.isDateValue(cellValue)) {
                        const dateStr = this.formatDateForFilter(cellValue);
                        return dateStr.toLowerCase().includes(filterValue);
                    } else {
                        return cellValue.toString().toLowerCase().includes(filterValue);
                    }
                });
            }
        });

        this.reportData = filteredData;
        this.isFiltersApplied = this.hasActiveFilters();
    }

    // Helper method to get filter control
    getFilterControl(key: string): FormControl {
        return this.filterForm.get(key) as FormControl;
    }

    // Check if there are any active filters
    hasActiveFilters(): boolean {
        const filters = this.filterForm.value;
        return Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);
    }

    // Remove all filters
    removeColumnFilters(): void {
        this.isFiltersApplied = false;
        Object.keys(this.filterForm.controls).forEach(key => {
            this.filterForm.get(key)?.setValue('');
        });
        this.reportData = [...this.originalReportData];
    }

    private filterReportTypes(searchTerm: string): void {
        if (!searchTerm) {
            this.filteredReportTypes = [];
            this.showReportSuggestions = false;
            return;
        }

        searchTerm = searchTerm.toLowerCase();
        this.filteredReportTypes = this.reportTypes.filter(type =>
            type.name.toLowerCase().includes(searchTerm) ||
            type.description.toLowerCase().includes(searchTerm)
        );
        this.showReportSuggestions = true;
    }

    private loadReportTypes(): Promise<void> {
        return new Promise((resolve) => {
            this.dataService.getReportTypes().subscribe({
                next: (types: ReportType[]) => {
                    this.reportTypes = types;
                    this.filteredReportTypes = types;
                    resolve();
                },
                error: (error) => {
                    console.error('Error loading report types:', error);
                    resolve(); // Resolve even on error to not block app flow
                }
            });
        });
    }

    private loadCompanies(): void {
        this.dataService.getCompanies().subscribe({
            next: (companies) => {
                this.companies = companies;
                this.filteredCompanies = [...companies];
                this.searchForm.patchValue({ selectedCompanies: companies }, { emitEvent: false });
            },
            error: (error) => console.error('Error loading companies:', error)
        });
    }

    filterCompanies(searchTerm: string): void {
        if (!searchTerm) {
            this.filteredCompanies = [...this.companies];
            return;
        }
        const term = searchTerm.toLowerCase().trim();
        this.filteredCompanies = this.companies.filter(company =>
            company.toLowerCase().includes(term)
        );
    }

    // Report Type Dropdown
    toggleReportTypeDropdown(event?: Event): void {
        if (event) {
            event.stopPropagation();
        }
        this.showReportSuggestions = !this.showReportSuggestions;
        if (this.showReportSuggestions) {
            this.isCompanyDropdownOpen = false;
            this.isColumnDropdownOpen = false;
        }
    }

    selectReportType(type: string): void {
        const reportType = this.reportTypes.find(rt => rt.type === type);
        if (reportType) {
            this.selectedReportType = reportType;
            this.searchForm.patchValue({ reportType: reportType.name });
            this.showReportSuggestions = false;
            this.availableColumns = reportType.columns;
            this.visibleColumns = new Set(reportType.columns.map(col => col.key));

            // Update column filters
            const columnFilters = this.fb.group({});
            reportType.columns.forEach(col => {
                columnFilters.addControl(col.key, this.fb.control(''));
            });
            this.searchForm.setControl('columnFilters', columnFilters);

            // Clear any existing filters and selections
            this.selectedRows.clear();
            this.visibility = true;

            // Load data immediately
            this.loadData();
        }
    }

    // Companies Dropdown
    toggleCompanyDropdown(event?: Event): void {
        if (event) {
            event.stopPropagation();
        }
        this.isCompanyDropdownOpen = !this.isCompanyDropdownOpen;
        if (this.isCompanyDropdownOpen) {
            this.showReportSuggestions = false;
            this.isColumnDropdownOpen = false;
        }
    }

    toggleCompanySelection(company: string, event: Event): void {
        event.stopPropagation();
        const selectedCompanies = new Set(this.searchForm.get('selectedCompanies')?.value || []);

        if (selectedCompanies.has(company)) {
            selectedCompanies.delete(company);
        } else {
            selectedCompanies.add(company);
        }

        this.searchForm.patchValue({
            selectedCompanies: Array.from(selectedCompanies)
        }, { emitEvent: false });
    }

    isCompanySelected(company: string): boolean {
        const selectedCompanies = this.searchForm.get('selectedCompanies')?.value || [];
        return selectedCompanies.includes(company);
    }

    toggleAllCompanies(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        const currentSelected = this.searchForm.get('selectedCompanies')?.value || [];
        const newSelection = currentSelected.length === this.companies.length ? [] : [...this.companies];

        this.searchForm.patchValue({
            selectedCompanies: newSelection
        }, { emitEvent: false });
    }

    applyCompanySelection(event: Event): void {
        event.stopPropagation();
        this.loadData();
        this.isCompanyDropdownOpen = false;
    }

    // Column Management
    toggleColumnDropdown(event?: Event): void {
        if (event) {
            event.stopPropagation();
        }
        this.isColumnDropdownOpen = !this.isColumnDropdownOpen;
        if (this.isColumnDropdownOpen) {
            this.showReportSuggestions = false;
            this.isCompanyDropdownOpen = false;
        }
    }

    toggleColumn(key: string, event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        if (this.visibleColumns.has(key)) {
            if (this.visibleColumns.size > 1) {
                this.visibleColumns.delete(key);
            }
        } else {
            this.visibleColumns.add(key);
        }
    }

    isColumnVisible(key: string): boolean {
        return this.visibleColumns.has(key);
    }

    areAllColumnsVisible(): boolean {
        return this.availableColumns.length === this.visibleColumns.size;
    }

    toggleAllColumns(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        if (this.areAllColumnsVisible()) {
            // Keep at least one column visible
            this.visibleColumns = new Set(['company']);
        } else {
            this.visibleColumns = new Set(this.availableColumns.map(col => col.key));
        }
    }

    applyColumnSelection(event: Event): void {
        event.stopPropagation();
        this.isColumnDropdownOpen = false;
    }

    // Utility Methods
    getColumnValue(item: any, key: string): any {
        return item[key];
    }

    getSelectedCompaniesText(): string {
        const count = this.searchForm.get('selectedCompanies')?.value?.length || 0;
        return count === this.companies.length
            ? 'All Companies Selected'
            : `${count} Companies Selected`;
    }

    getReportTypeText(): string {
        return this.selectedReportType?.name || 'Select Report Type';
    }

    // Close dropdowns when clicking outside
    closeDropdowns(): void {
        this.showReportSuggestions = false;
        this.isCompanyDropdownOpen = false;
        this.isColumnDropdownOpen = false;
    }

    @HostListener('document:click', ['$event'])
    handleClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.report-search') && !target.closest('.custom-dropdown')) {
            this.showReportSuggestions = false;
            this.closeDropdowns();
        }
    }

    // Toggle filters visibility
    toggleFilters(): void {
        this.showFilters = !this.showFilters;
        if (!this.showFilters) {
            this.removeColumnFilters();
        }
    }

    // Toggle row visibility
    toggleVisibility(): void {
        this.visibility = !this.visibility;
        this.applyFilters();
    }

    private isDateValue(value: any): boolean {
        if (value instanceof Date) return true;
        if (typeof value === 'string') {
            // Try parsing as ISO date
            const date = new Date(value);
            return !isNaN(date.getTime());
        }
        return false;
    }

    private formatDateForFilter(value: any): string {
        const date = value instanceof Date ? value : new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
        return value.toString();
    }

    // Row selection methods
    areAllRowsSelected(): boolean {
        return this.reportData.length > 0 && this.reportData.every(item => this.selectedRows.has(item.id));
    }

    toggleAllRows(event: Event): void {
        const checkbox = event.target as HTMLInputElement;
        if (checkbox.checked) {
            // Select all rows
            this.reportData.forEach(item => this.selectedRows.add(item.id));
        } else {
            // Deselect all rows
            this.selectedRows.clear();
        }
    }

    toggleRowSelection(id: number): void {
        if (this.selectedRows.has(id)) {
            this.selectedRows.delete(id);
        } else {
            this.selectedRows.add(id);
        }
    }

    downloadData(): void {
        if (!this.reportData.length || !this.selectedReportType) return;

        // Get only visible columns
        const visibleColumns = this.availableColumns.filter(col => this.isColumnVisible(col.key));

        // Generate filename with report type and date
        const date = new Date().toISOString().split('T')[0];
        const filename = `${this.selectedReportType.name.toLowerCase().replace(/\s+/g, '-')}-${date}.csv`;

        this.dataService.downloadDataAsCSV(this.reportData, visibleColumns, filename);
    }

    applyColumnFilters(): void {
        this.isFiltersApplied = true;
        this.applyFilters();
    }

    isDateRangeInvalid(): boolean {
        const startDate = this.searchForm.get('startDate')?.value;
        const endDate = this.searchForm.get('endDate')?.value;

        if (startDate && endDate) {
            return new Date(startDate) > new Date(endDate);
        }
        return false;
    }

    private setupSubscriptions(): void {
        // Report type changes
        this.searchForm.get('reportType')?.valueChanges
            .pipe(debounceTime(300))
            .subscribe(value => this.filterReportTypes(value));

        // Company search changes
        this.searchForm.get('companySearch')?.valueChanges
            .pipe(debounceTime(300))
            .subscribe(value => this.filterCompanies(value));

        // Company selection changes
        this.searchForm.get('selectedCompanies')?.valueChanges
            .pipe(debounceTime(300))
            .subscribe(() => {
                if (this.selectedReportType) {
                    this.loadData();
                }
            });

        // Date range changes
        this.searchForm.get('startDate')?.valueChanges
            .pipe(debounceTime(300))
            .subscribe(() => {
                if (this.selectedReportType) {
                    this.loadData();
                }
            });

        this.searchForm.get('endDate')?.valueChanges
            .pipe(debounceTime(300))
            .subscribe(() => {
                if (this.selectedReportType) {
                    this.loadData();
                }
            });

        // Filter form changes
        this.filterForm.valueChanges
            .pipe(debounceTime(300))
            .subscribe(() => {
                this.applyFilters();
            });
    }

    private updateUrlWithReportType(reportType: string): void {
        const url = new URL(window.location.href);
        url.searchParams.set('report', reportType);
        window.history.replaceState({}, '', url.toString());
    }
} 