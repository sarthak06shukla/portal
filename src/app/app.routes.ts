import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { NseDataComponent } from './components/nse-data/nse-data.component';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';
import { QueryBuilderComponent } from './components/query-builder/query-builder.component';

export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'portal', component: NseDataComponent },
    { path: 'developer', component: QueryEditorComponent },
    { path: 'query-builder', component: QueryBuilderComponent }
]; 