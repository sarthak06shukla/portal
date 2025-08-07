import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportsComponent } from './components/reports/reports.component';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';

const routes: Routes = [
    { path: '', redirectTo: '/reports', pathMatch: 'full' },
    { path: 'reports', component: ReportsComponent },
    { path: 'developer', component: QueryEditorComponent }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { } 