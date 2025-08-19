import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.css']
})
export class LandingComponent {
    constructor(private router: Router) { }

    navigateToQueryBuilder() {
        this.router.navigate(['/query-builder']);
    }

    navigateToDeveloper() {
        this.router.navigate(['/developer']);
    }
}
