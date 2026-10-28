import { Component, Inject, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TenantService } from '../../core/services/tenant.service';

export interface SignatureStudioData {
  signatoryName?: string;
  designation?: string;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

@Component({
  selector: 'app-signature-studio-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  template: `
    <div class="sig-studio-container">
      <!-- Standard Light Blue Header -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>draw</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Digital Signature Studio (डिजिटल हस्ताक्षर स्टूडियो)</h2>
          <p class="subtitle">Draw signature on screen or generate elegant calligraphic signatures in real-time.</p>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="sig-studio-body">
        <mat-tab-group class="sig-tabs" (selectedIndexChange)="onTabChange($event)">
          <!-- TAB 1: Draw Signature on Canvas -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">gesture</mat-icon>
              <span>Draw Live Sign (हाथ से साइन करें)</span>
            </ng-template>

            <div class="tab-pad-layout">
              <!-- Toolbar -->
              <div class="pad-toolbar">
                <div class="toolbar-group">
                  <span class="tool-label">Pen Ink:</span>
                  <div class="color-dots">
                    <button
                      type="button"
                      *ngFor="let c of drawColors"
                      class="color-dot"
                      [style.background]="c.hex"
                      [class.active]="currentDrawColor === c.hex"
                      (click)="setDrawColor(c.hex)"
                      [matTooltip]="c.name">
                    </button>
                  </div>
                </div>

                <div class="toolbar-group">
                  <span class="tool-label">Stroke:</span>
                  <div class="size-buttons">
                    <button type="button" class="size-btn" [class.active]="currentStrokeWidth === 1.8" (click)="currentStrokeWidth = 1.8">Fine</button>
                    <button type="button" class="size-btn" [class.active]="currentStrokeWidth === 2.8" (click)="currentStrokeWidth = 2.8">Medium</button>
                    <button type="button" class="size-btn" [class.active]="currentStrokeWidth === 4.0" (click)="currentStrokeWidth = 4.0">Bold</button>
                  </div>
                </div>

                <div class="toolbar-actions">
                  <button mat-stroked-button (click)="undoStroke()" [disabled]="strokes.length === 0" class="btn-tool">
                    <mat-icon>undo</mat-icon>
                    <span>Undo</span>
                  </button>
                  <button mat-stroked-button color="warn" (click)="clearPad()" class="btn-tool">
                    <mat-icon>delete_sweep</mat-icon>
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <!-- Drawing Canvas with Checkerboard Background -->
              <div class="canvas-wrapper">
                <canvas
                  #drawCanvas
                  width="640"
                  height="260"
                  class="sign-canvas"
                  (mousedown)="startDrawing($event)"
                  (mousemove)="draw($event)"
                  (mouseup)="stopDrawing()"
                  (mouseleave)="stopDrawing()"
                  (touchstart)="handleTouchStart($event)"
                  (touchmove)="handleTouchMove($event)"
                  (touchend)="stopDrawing()">
                </canvas>
                <div class="sign-baseline-guide"></div>
                <div class="sign-watermark-hint" *ngIf="strokes.length === 0">
                  <mat-icon>touch_app</mat-icon>
                  <span>Sign here using Mouse, Touch, or Stylus Pen (यहाँ साइन करें)</span>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: Cursive Calligraphy Generator -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">text_fields</mat-icon>
              <span>Type &amp; Generate (नाम से साइन बनाएं)</span>
            </ng-template>

            <div class="tab-type-layout">
              <div class="type-controls-row">
                <mat-form-field appearance="outline" class="density-compact flex-1">
                  <mat-label>Signatory Name (हस्ताक्षरकर्ता का नाम)</mat-label>
                  <input matInput [(ngModel)]="typeSignName" (input)="renderTypeSignature()" placeholder="e.g. Pawan Singh" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="density-compact flex-1">
                  <mat-label>Designation (पद / उपाधि)</mat-label>
                  <input matInput [(ngModel)]="typeDesignation" (input)="renderTypeSignature()" placeholder="e.g. Principal / Director" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="density-compact font-select">
                  <mat-label>Calligraphy Font</mat-label>
                  <mat-select [(value)]="selectedFont" (selectionChange)="renderTypeSignature()">
                    <mat-option value="Great Vibes">Great Vibes (Royal Flow)</mat-option>
                    <mat-option value="Dancing Script">Dancing Script (Modern Script)</mat-option>
                    <mat-option value="Alex Brush">Alex Brush (Classic Cursive)</mat-option>
                    <mat-option value="Caveat">Caveat (Natural Hand)</mat-option>
                    <mat-option value="Sacramento">Sacramento (Formal Script)</mat-option>
                  </mat-select>
                </mat-form-field>

                <div class="color-dots type-color-box">
                  <button
                    type="button"
                    *ngFor="let c of drawColors"
                    class="color-dot"
                    [style.background]="c.hex"
                    [class.active]="typeColor === c.hex"
                    (click)="typeColor = c.hex; renderTypeSignature()"
                    [matTooltip]="c.name">
                  </button>
                </div>
              </div>

              <div class="canvas-wrapper">
                <canvas #typeCanvas width="640" height="260" class="sign-canvas"></canvas>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Common Metadata Options -->
        <div class="meta-options-bar">
          <mat-form-field appearance="outline" class="density-compact title-input">
            <mat-label>Signature Title / Preset Name</mat-label>
            <input matInput [(ngModel)]="signatureTitle" placeholder="e.g. Principal / Controller Sign" />
            <mat-icon matSuffix>badge</mat-icon>
          </mat-form-field>

          <mat-checkbox [(ngModel)]="setAsDefault" color="primary">
            <strong>Set as Default Signature (मुख्य हस्ताक्षर बनाएं)</strong>
          </mat-checkbox>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="dialog-actions">
        <button mat-stroked-button (click)="onClose()" [disabled]="uploading">
          Cancel
        </button>
        <button mat-raised-button color="primary" class="apply-btn" (click)="applyAndUpload()" [disabled]="uploading">
          <mat-icon *ngIf="!uploading">verified</mat-icon>
          <mat-icon class="spin" *ngIf="uploading">sync</mat-icon>
          <span>{{ uploading ? 'Uploading & Applying...' : 'Apply & Save Signature (हस्ताक्षर लागू करें)' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sig-studio-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 820px;
      max-height: 90vh;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;

      .header-icon-wrap {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
      }

      .header-titles {
        flex: 1;
        min-width: 0;
        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.25;
        }
        .subtitle {
          margin: 2px 0 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
        }
      }

      .close-btn {
        color: #64748b;
        &:hover { color: #1e293b; background: rgba(0,0,0,0.04); }
        flex-shrink: 0;
      }
    }

    .sig-studio-body {
      display: flex;
      flex-direction: column;
      padding: 14px 20px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);
      gap: 14px;
    }

    .sig-tabs {
      .tab-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 6px;
      }
    }

    .tab-pad-layout, .tab-type-layout {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 12px;
    }

    .pad-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;

      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .tool-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
        }
      }

      .color-dots {
        display: flex;
        gap: 6px;

        .color-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: transform 0.15s ease;

          &:hover { transform: scale(1.15); }
          &.active {
            outline: 2px solid #2563eb;
            outline-offset: 1px;
            transform: scale(1.12);
          }
        }
      }

      .size-buttons {
        display: flex;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;

        .size-btn {
          border: none;
          background: #ffffff;
          padding: 4px 10px;
          font-size: 0.75rem;
          color: #475569;
          cursor: pointer;

          &.active {
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
          }
        }
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;

        .btn-tool {
          font-size: 0.78rem;
          padding: 0 10px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    .type-controls-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;

      .flex-1 { flex: 1; min-width: 160px; }
      .font-select { width: 200px; }
      .type-color-box { padding: 4px; }
    }

    .canvas-wrapper {
      position: relative;
      width: 100%;
      height: 220px;
      border-radius: 10px;
      border: 1.5px dashed #94a3b8;
      background-color: #ffffff;
      background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                        linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                        linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;

      .sign-canvas {
        width: 100%;
        height: 100%;
        touch-action: none;
        cursor: crosshair;
      }

      .sign-baseline-guide {
        position: absolute;
        bottom: 45px;
        left: 30px;
        right: 30px;
        height: 1px;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.45);
        pointer-events: none;
      }

      .sign-watermark-hint {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #94a3b8;
        font-size: 0.85rem;
        pointer-events: none;
        user-select: none;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
    }

    .meta-options-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;

      .title-input {
        flex: 1;
        min-width: 220px;
        margin-bottom: -1.25em;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      flex-shrink: 0;

      .apply-btn {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
      }
    }

    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class SignatureStudioDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('drawCanvas') drawCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeCanvas') typeCanvasRef!: ElementRef<HTMLCanvasElement>;

  activeTab = 0;
  uploading = false;

  // Drawing Pad state
  isDrawing = false;
  currentDrawColor = '#1e40af'; // Royal Navy Blue default for signatures
  currentStrokeWidth = 2.8;
  strokes: Stroke[] = [];
  currentStroke: Point[] = [];

  drawColors = [
    { name: 'Royal Navy Blue', hex: '#1e40af' },
    { name: 'Midnight Blue', hex: '#1e3a8a' },
    { name: 'Jet Black', hex: '#0f172a' },
    { name: 'Deep Burgundy Red', hex: '#991b1b' }
  ];

  // Type & Generate state
  typeSignName = 'Pawan Sir';
  typeDesignation = 'Principal / Controller';
  selectedFont = 'Great Vibes';
  typeColor = '#1e40af';

  // Common Metadata
  signatureTitle = 'Principal / Controller Sign';
  setAsDefault = true;

  constructor(
    private tenantService: TenantService,
    private dialogRef: MatDialogRef<SignatureStudioDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignatureStudioData
  ) {}

  ngOnInit(): void {
    if (this.data?.signatoryName) {
      this.typeSignName = this.data.signatoryName;
    }
    if (this.data?.designation) {
      this.typeDesignation = this.data.designation;
      this.signatureTitle = `${this.data.designation} Sign`;
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.redrawPad();
      this.renderTypeSignature();
    }, 50);
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    setTimeout(() => {
      if (index === 0) this.redrawPad();
      else this.renderTypeSignature();
    }, 50);
  }

  setDrawColor(hex: string): void {
    this.currentDrawColor = hex;
  }

  // --- DRAWING CANVAS INTERACTION ---

  startDrawing(e: MouseEvent): void {
    this.isDrawing = true;
    const pt = this.getCanvasPoint(e);
    this.currentStroke = [pt];
  }

  draw(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pt = this.getCanvasPoint(e);
    this.currentStroke.push(pt);
    this.redrawPad();
  }

  stopDrawing(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentStroke.length > 0) {
      this.strokes.push({
        points: [...this.currentStroke],
        color: this.currentDrawColor,
        width: this.currentStrokeWidth
      });
      this.currentStroke = [];
    }
  }

  handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isDrawing = true;
      const touch = e.touches[0];
      const pt = this.getTouchPoint(touch);
      this.currentStroke = [pt];
    }
  }

  handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const pt = this.getTouchPoint(touch);
    this.currentStroke.push(pt);
    this.redrawPad();
  }

  private getCanvasPoint(e: MouseEvent): Point {
    const canvas = this.drawCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  private getTouchPoint(touch: Touch): Point {
    const canvas = this.drawCanvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  }

  undoStroke(): void {
    this.strokes.pop();
    this.redrawPad();
  }

  clearPad(): void {
    this.strokes = [];
    this.currentStroke = [];
    this.redrawPad();
  }

  redrawPad(): void {
    if (!this.drawCanvasRef) return;
    const canvas = this.drawCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all finished strokes
    for (const stroke of this.strokes) {
      this.renderStroke(ctx, stroke.points, stroke.color, stroke.width);
    }

    // Draw current active stroke
    if (this.currentStroke.length > 0) {
      this.renderStroke(ctx, this.currentStroke, this.currentDrawColor, this.currentStrokeWidth);
    }
  }

  private renderStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (points.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Quadratic curve smoothing between midpoints
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  // --- TYPE & GENERATE CALLIGRAPHY ---

  renderTypeSignature(): void {
    if (!this.typeCanvasRef) return;
    const canvas = this.typeCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const name = (this.typeSignName || 'Authorized Sign').trim();
    const designation = (this.typeDesignation || '').trim();
    const font = this.selectedFont || 'Great Vibes';
    const color = this.typeColor || '#1e40af';

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Signature Name in Cursive Script
    ctx.font = `italic 64px "${font}", "Brush Script MT", "Segoe Script", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerY = designation ? height / 2 - 20 : height / 2;
    ctx.fillText(name, width / 2, centerY);

    // Dynamic flourish underline
    const textWidth = ctx.measureText(name).width;
    const lineStartX = Math.max(width / 2 - textWidth / 2 - 15, 60);
    const lineEndX = Math.min(width / 2 + textWidth / 2 + 25, width - 60);
    const lineY = centerY + 32;

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineY);
    ctx.bezierCurveTo(
      width / 2, lineY - 6,
      width / 2 + 60, lineY + 10,
      lineEndX, lineY - 2
    );
    ctx.stroke();

    // Designation underneath
    if (designation) {
      ctx.font = 'bold 17px "Outfit", "Segoe UI", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(designation.toUpperCase(), width / 2, centerY + 58);
    }

    ctx.restore();
  }

  // --- APPLY & UPLOAD ---

  applyAndUpload(): void {
    let canvas: HTMLCanvasElement;
    if (this.activeTab === 0) {
      if (!this.drawCanvasRef) return;
      canvas = this.drawCanvasRef.nativeElement;
      if (this.strokes.length === 0) {
        alert('Please draw your signature on the pad before applying.');
        return;
      }
    } else {
      if (!this.typeCanvasRef) return;
      canvas = this.typeCanvasRef.nativeElement;
      if (!this.typeSignName.trim()) {
        alert('Please enter signatory name before applying.');
        return;
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    const title = this.signatureTitle.trim() || 'Authorized Signature';
    const signatoryName = this.activeTab === 1 ? this.typeSignName : undefined;
    const setAsDefault = !!this.setAsDefault;

    this.uploading = true;
    this.tenantService.uploadTenantAsset({
      assetType: 'signature',
      imageData: dataUrl,
      title: title,
      signatoryName: signatoryName,
      setAsDefault: setAsDefault
    }).subscribe({
      next: (res) => {
        this.uploading = false;
        this.dialogRef.close({
          success: true,
          asset: res.asset,
          digitalSignature: res.digitalSignature,
          digitalSignaturesJson: res.digitalSignaturesJson
        });
      },
      error: () => {
        this.uploading = false;
        this.dialogRef.close({
          success: true,
          fallbackDataUrl: dataUrl,
          title: title,
          setAsDefault: setAsDefault
        });
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
