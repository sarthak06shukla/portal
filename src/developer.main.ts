import { bootstrapApplication } from '@angular/platform-browser';
import { DeveloperAppComponent } from './app/developer-app.component';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

bootstrapApplication(DeveloperAppComponent, {
    providers: [
        provideHttpClient(),
        provideAnimations(),
        importProvidersFrom(FormsModule, ReactiveFormsModule)
    ]
}).catch(err => console.error(err)); 