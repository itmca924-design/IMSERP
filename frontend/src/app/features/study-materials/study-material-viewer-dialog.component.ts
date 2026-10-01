import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StudyMaterialDto } from './study-material.models';
import { StudyMaterialService } from './study-material.service';

@Component({
  selector: 'app-study-material-viewer-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict UI Compliant Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-main-strip">
          <div class="header-icon-wrap" [ngClass]="data.material.fileFormat">
            <mat-icon>{{ getFormatIcon(data.material.fileFormat) }}</mat-icon>
          </div>
          <div class="header-titles">
            <h2 class="main-title" [title]="data.material.title">{{ data.material.title }}</h2>
            <p class="subtitle">
              <span>{{ data.material.subject }}</span>
              <span *ngIf="data.material.chapterName">&bull; {{ data.material.chapterName }}</span>
              <span *ngIf="data.material.targetExam">&bull; <strong>{{ data.material.targetExam }}</strong></span>
              <span class="type-badge">{{ data.material.materialType }}</span>
            </p>
          </div>
          <!-- Mobile Close Button (Pinned Top Right) -->
          <button mat-icon-button class="close-btn mobile-close-btn" (click)="dialogRef.close()" matTooltip="Close viewer">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="header-actions">
          <!-- Solution PDF toggle if available -->
          <button 
            mat-stroked-button 
            color="accent" 
            class="solution-btn"
            *ngIf="data.material.solutionFileUrl"
            (click)="toggleSolutionView()">
            <mat-icon>{{ viewingSolution ? 'description' : 'key' }}</mat-icon>
            <span>{{ viewingSolution ? 'View Question' : 'View Solutions' }}</span>
          </button>

          <!-- Download Button with auto counter -->
          <button mat-flat-button color="primary" class="download-btn" (click)="downloadCurrentFile()">
            <mat-icon>download</mat-icon>
            <span>Download {{ viewingSolution ? 'Solution' : 'Material' }}</span>
          </button>

          <!-- Desktop Close Button -->
          <button mat-icon-button class="close-btn desktop-close-btn" (click)="dialogRef.close()" matTooltip="Close viewer">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="viewer-body">
        <!-- Embedded IFrame for PDFs -->
        <div class="iframe-container" *ngIf="isPdf(activeUrl)">
          <iframe [src]="safeUrl" class="doc-iframe" title="Document Viewer"></iframe>
        </div>

        <!-- Fallback for Non-PDF files (DOCX, PPTX, ZIP, etc.) -->
        <div class="non-pdf-fallback" *ngIf="!isPdf(activeUrl)">
          <div class="fallback-card">
            <div class="fallback-icon-wrap" [ngClass]="data.material.fileFormat">
              <mat-icon>{{ getFormatIcon(data.material.fileFormat) }}</mat-icon>
            </div>
            <h3>{{ data.material.fileName }}</h3>
            <p>This is a <strong>{{ data.material.fileFormat | uppercase }}</strong> file. Click below to download and open it on your device.</p>
            
            <div class="meta-strip">
              <span>Size: <strong>{{ formatBytes(data.material.fileSizeBytes) }}</strong></span>
              <span>Uploaded by: <strong>{{ data.material.uploadedByName }}</strong></span>
            </div>

            <button mat-flat-button color="primary" class="big-dl-btn" (click)="downloadCurrentFile()">
              <mat-icon>download</mat-icon> Download {{ data.material.fileName }}
            </button>

            <a *ngIf="data.material.externalLink" [href]="data.material.externalLink" target="_blank" class="ext-link-btn">
              <mat-icon>open_in_new</mat-icon> Open External Drive/Video Link
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 88vh;
      max-height: 88vh;
      background: #ffffff;
      box-sizing: border-box;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }

    /* Strict UI Rule Header */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
      flex-shrink: 0;
    }

    .header-main-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1 1 auto;
      min-width: 0;
    }

    .header-icon-wrap {
      width: 42px;
      height: 42px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      flex-shrink: 0;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
      &.pdf { background: #ef4444; }
      &.docx, &.doc { background: #2563eb; }
      &.pptx, &.ppt { background: #ea580c; }
      &.zip { background: #7c3aed; }
    }

    .header-titles {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .main-title {
      font-size: 1.12rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
      line-height: 1.35;
      white-space: normal;
      word-break: break-word;
    }

    .subtitle {
      font-size: 0.8rem;
      color: #3b82f6;
      margin: 4px 0 0 0;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      line-height: 1.4;
      strong { color: #1e40af; }
    }

    .type-badge {
      background: #e0e7ff;
      color: #3730a3;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.72rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .solution-btn {
      font-size: 0.78rem;
      font-weight: 600;
      height: 36px;
      line-height: 36px;
      padding: 0 12px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }

    .download-btn {
      font-size: 0.8rem;
      font-weight: 700;
      height: 36px;
      line-height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(37,99,235,0.25);
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(0,0,0,0.06); }
    }

    .mobile-close-btn {
      display: none;
    }

    .desktop-close-btn {
      display: inline-flex;
    }

    /* All-Modes Responsive Breakdown */
    @media (max-width: 900px) {
      .dialog-wrapper {
        height: 92vh;
        max-height: 92vh;
      }
      .dialog-header {
        padding: 10px 14px;
        gap: 10px;
      }
      .main-title {
        font-size: 1.02rem;
      }
    }

    @media (max-width: 680px) {
      .dialog-wrapper {
        height: 96vh;
        max-height: 96vh;
      }
      .dialog-header {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 12px;
      }
      .header-main-strip {
        align-items: flex-start;
        gap: 10px;
        width: 100%;
      }
      .header-icon-wrap {
        width: 36px;
        height: 36px;
        min-width: 36px;
        border-radius: 8px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .main-title {
        font-size: 0.94rem;
        line-height: 1.3;
      }
      .subtitle {
        font-size: 0.72rem;
        gap: 4px;
        margin-top: 2px;
      }
      .mobile-close-btn {
        display: inline-flex;
        width: 32px;
        height: 32px;
        min-width: 32px;
        flex-shrink: 0;
        margin-left: auto;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .desktop-close-btn {
        display: none;
      }
      .header-actions {
        width: 100%;
        display: flex;
        gap: 8px;
        justify-content: stretch;
        .solution-btn, .download-btn {
          flex: 1;
          height: 34px;
          line-height: 34px;
          font-size: 0.74rem;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    /* Body */
    .viewer-body {
      flex: 1 1 auto;
      height: calc(100% - 64px);
      background: #525659;
      position: relative;
      overflow: hidden;
    }

    .iframe-container {
      width: 100%;
      height: 100%;
    }

    .doc-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      display: block;
    }

    /* Fallback */
    .non-pdf-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 24px;
      box-sizing: border-box;
    }

    .fallback-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 40px;
      text-align: center;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
      h3 { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; }
      p { font-size: 0.88rem; color: #475569; margin: 0; }
    }

    .fallback-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      background: #2563eb;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
      &.docx, &.doc { background: #2563eb; }
      &.pptx, &.ppt { background: #ea580c; }
      &.xlsx, &.xls { background: #16a34a; }
      &.zip { background: #7c3aed; }
    }

    .meta-strip {
      display: flex;
      gap: 16px;
      font-size: 0.8rem;
      color: #64748b;
      margin: 8px 0;
      strong { color: #1e293b; }
    }

    .big-dl-btn {
      padding: 10px 24px;
      font-weight: 700;
    }

    .ext-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      margin-top: 6px;
      &:hover { text-decoration: underline; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
  `]
})
export class StudyMaterialViewerDialogComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly studyMaterialService = inject(StudyMaterialService);
  readonly dialogRef = inject(MatDialogRef<StudyMaterialViewerDialogComponent>);

  viewingSolution = false;
  activeUrl: string;
  safeUrl: SafeResourceUrl;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { material: StudyMaterialDto }) {
    this.activeUrl = data.material.fileUrl;
    this.safeUrl = this.sanitizeUrl(this.activeUrl);
  }

  isPdf(url: string): boolean {
    if (!url) return false;
    return url.toLowerCase().includes('.pdf');
  }

  sanitizeUrl(url: string): SafeResourceUrl {
    const fullUrl = url.startsWith('http') ? url : `http://localhost:5000${url}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
  }

  toggleSolutionView() {
    this.viewingSolution = !this.viewingSolution;
    if (this.viewingSolution && this.data.material.solutionFileUrl) {
      this.activeUrl = this.data.material.solutionFileUrl;
    } else {
      this.activeUrl = this.data.material.fileUrl;
    }
    this.safeUrl = this.sanitizeUrl(this.activeUrl);
  }

  downloadCurrentFile() {
    const url = this.activeUrl.startsWith('http') ? this.activeUrl : `http://localhost:5000${this.activeUrl}`;
    const filename = this.viewingSolution && this.data.material.solutionFileName
      ? this.data.material.solutionFileName
      : this.data.material.fileName;

    // Track download in backend
    this.studyMaterialService.trackDownload(this.data.material.id).subscribe({
      next: res => {
        this.data.material.downloadCount = res.downloadCount;
      }
    });

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getFormatIcon(format: string): string {
    const f = (format || '').toLowerCase();
    if (f === 'pdf') return 'picture_as_pdf';
    if (f.includes('doc')) return 'description';
    if (f.includes('ppt')) return 'slideshow';
    if (f.includes('xls')) return 'table_chart';
    if (f === 'zip') return 'folder_zip';
    return 'article';
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
