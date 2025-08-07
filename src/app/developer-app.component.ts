import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryEditorComponent } from './components/query-editor/query-editor.component';

@Component({
    selector: 'app-developer-root',
    standalone: true,
    imports: [CommonModule, QueryEditorComponent],
    template: `
        <div class="developer-container">
            <h2>Developer Query Editor</h2>
            <app-query-editor></app-query-editor>
        </div>
    `,
    styles: [`
        .developer-container {
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }
        h2 {
            text-align: center;
            margin-bottom: 30px;
        }
    `]
})
export class DeveloperAppComponent { } 