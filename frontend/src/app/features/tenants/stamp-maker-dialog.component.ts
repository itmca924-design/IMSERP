import { Component, Inject, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TenantService } from '../../core/services/tenant.service';

export interface StampMakerData {
  instituteName?: string;
  city?: string;
  establishedYear?: string;
}

@Component({
  selector: 'app-stamp-maker-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule
],
  template: `
    <div class="stamp-maker-container">
      <!-- Standard Light Blue Header -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>verified</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">Digital Rubber Stamp Studio (आधिकारिक मुहर जनरेटर)</h2>
          <p class="subtitle">Design high-resolution official rubber stamp with transparent background in real-time.</p>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <div class="stamp-maker-body">
        <!-- Left: Form Controls Deck -->
        <div class="controls-panel">
          <form [formGroup]="stampForm" class="stamp-form">
            <!-- Shape & Style -->
            <div class="row-2col">
              <mat-form-field appearance="outline" class="density-compact">
                <mat-label>Stamp Shape (आकार)</mat-label>
                <mat-select formControlName="shape">
                  <mat-option value="circular">Circular (गोल मुहर)</mat-option>
                  <mat-option value="oval">Oval (अंडाकार)</mat-option>
                  <mat-option value="box">Rectangular Box (चौकोर)</mat-option>
                </mat-select>
              </mat-form-field>
    
              <mat-form-field appearance="outline" class="density-compact">
                <mat-label>Finish Effect (टेक्सचर)</mat-label>
                <mat-select formControlName="effect">
                  <mat-option value="clean">Crisp Digital (अल्ट्रा शार्प)</mat-option>
                  <mat-option value="vintage">Vintage Rubber (हल्का स्टैंप टेक्सचर)</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
    
            <!-- Ink Color Selection Bar -->
            <div class="color-picker-box">
              <label class="section-label">Stamp Ink Color (मुहर की स्याही):</label>
              <div class="color-options">
                @for (c of colorPalette; track c) {
                  <button
                    type="button"
                    class="color-btn"
                    [style.background]="c.hex"
                    [class.active]="stampForm.get('color')?.value === c.hex"
                    (click)="setColor(c.hex)"
                    [matTooltip]="c.name">
                    @if (stampForm.get('color')?.value === c.hex) {
                      <mat-icon>check</mat-icon>
                    }
                  </button>
                }
              </div>
            </div>
    
            <!-- Text Slots -->
            <mat-form-field appearance="outline" class="density-compact w-100">
              <mat-label>Top Arc (संस्थान का नाम)</mat-label>
              <input matInput formControlName="topText" placeholder="e.g. JNANDEEP CAMPUS" />
              <mat-icon matSuffix>business</mat-icon>
            </mat-form-field>
    
            <div class="row-2col">
              <mat-form-field appearance="outline" class="density-compact">
                <mat-label>Center Text Line 1</mat-label>
                <input matInput formControlName="centerLine1" placeholder="e.g. ★ ESTD 2018 ★" />
              </mat-form-field>
    
              <mat-form-field appearance="outline" class="density-compact">
                <mat-label>Center Text Line 2</mat-label>
                <input matInput formControlName="centerLine2" placeholder="e.g. OFFICIAL SEAL" />
              </mat-form-field>
            </div>
    
            <mat-form-field appearance="outline" class="density-compact w-100">
              <mat-label>Bottom Arc (स्थान / शहर / मान्यता)</mat-label>
              <input matInput formControlName="bottomText" placeholder="e.g. PATNA, BIHAR • REGD." />
              <mat-icon matSuffix>place</mat-icon>
            </mat-form-field>
    
            <mat-form-field appearance="outline" class="density-compact w-100">
              <mat-label>Seal Label / Title (गैलरी नाम)</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Main Campus Official Seal" />
              <mat-hint>For distinguishing in multi-seal library</mat-hint>
            </mat-form-field>
    
            <div class="checkbox-row">
              <mat-checkbox formControlName="setAsDefault" color="primary">
                <strong>Set as Default Seal (मुख्य मुहर बनाएं)</strong>
              </mat-checkbox>
            </div>
          </form>
        </div>
    
        <!-- Right: Live Canvas Preview Area -->
        <div class="preview-panel">
          <div class="preview-header">
            <span class="preview-tag">
              <mat-icon class="pulse-icon">fiber_manual_record</mat-icon> Live Real-Time Transparent Canvas
            </span>
            <button mat-icon-button (click)="drawStamp()" matTooltip="Redraw Stamp">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
    
          <div class="canvas-checkerboard-wrapper">
            <canvas #stampCanvas width="600" height="600" class="stamp-canvas"></canvas>
          </div>
          <p class="preview-hint">100% Transparent PNG • Crisp 300 DPI Vector Quality on all ERP Prints</p>
        </div>
      </div>
    
      <!-- Action Footer -->
      <div class="dialog-actions">
        <button mat-stroked-button (click)="onClose()" [disabled]="uploading">
          Cancel
        </button>
        <button mat-raised-button color="primary" class="apply-btn" (click)="applyAndUpload()" [disabled]="uploading">
          @if (!uploading) {
            <mat-icon>verified</mat-icon>
          }
          @if (uploading) {
            <mat-icon class="spin">sync</mat-icon>
          }
          <span>{{ uploading ? 'Uploading & Applying...' : 'Apply & Save Seal (मुहर लागू करें)' }}</span>
        </button>
      </div>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .stamp-maker-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 980px;
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

    .stamp-maker-body {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
      padding: 18px 22px;
      overflow-y: auto;
      max-height: calc(90vh - 140px);

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
        padding: 12px;
        gap: 14px;
      }
    }

    .controls-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .stamp-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .row-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .w-100 {
        width: 100%;
      }

      .density-compact {
        ::ng-deep .mat-mdc-text-field-wrapper {
          padding-top: 0;
          padding-bottom: 0;
        }
      }

      .section-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 6px;
        display: block;
      }

      .color-picker-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;

        .color-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;

          .color-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            transition: transform 0.15s ease, box-shadow 0.15s ease;

            &:hover {
              transform: scale(1.1);
            }

            &.active {
              outline: 2px solid #2563eb;
              outline-offset: 2px;
              transform: scale(1.08);
            }

            mat-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
            }
          }
        }
      }

      .checkbox-row {
        margin-top: 4px;
      }
    }

    .preview-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;

      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-bottom: 10px;

        .preview-tag {
          font-size: 0.76rem;
          font-weight: 600;
          color: #059669;
          display: flex;
          align-items: center;
          gap: 4px;

          .pulse-icon {
            font-size: 12px;
            width: 12px;
            height: 12px;
            color: #10b981;
          }
        }
      }

      .canvas-checkerboard-wrapper {
        width: 100%;
        max-width: 320px;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #ffffff;
        background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                          linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                          linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
        background-size: 16px 16px;
        background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
        border-radius: 8px;
        border: 1px dashed #cbd5e1;
        padding: 8px;
        box-sizing: border-box;

        .stamp-canvas {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.08));
        }
      }

      .preview-hint {
        font-size: 0.72rem;
        color: #64748b;
        text-align: center;
        margin-top: 10px;
        margin-bottom: 0;
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
export class StampMakerDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('stampCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  stampForm!: FormGroup;
  uploading = false;

  colorPalette = [
    { name: 'Classic Navy Blue', hex: '#1e3a8a' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Official Red', hex: '#dc2626' },
    { name: 'Authorized Green', hex: '#059669' },
    { name: 'Charcoal Black', hex: '#0f172a' }
  ];

  constructor(
    private fb: FormBuilder,
    private tenantService: TenantService,
    private dialogRef: MatDialogRef<StampMakerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StampMakerData
  ) {}

  ngOnInit(): void {
    const defaultInstitute = (this.data?.instituteName || 'CAMPUS / ACADEMY').toUpperCase();
    const defaultCity = (this.data?.city ? `${this.data.city.toUpperCase()} • REGD.` : 'ACADEMIC SEAL • REGD.').toUpperCase();
    const defaultEstd = this.data?.establishedYear ? `★ ESTD ${this.data.establishedYear} ★` : '★ OFFICIAL SEAL ★';

    this.stampForm = this.fb.group({
      shape: ['circular'],
      effect: ['clean'],
      color: ['#1e3a8a'],
      topText: [defaultInstitute],
      centerLine1: [defaultEstd],
      centerLine2: ['GOVT. REGD.'],
      bottomText: [defaultCity],
      title: ['Main Campus Official Seal'],
      setAsDefault: [true]
    });

    this.stampForm.valueChanges.subscribe(() => {
      this.drawStamp();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.drawStamp(), 50);
  }

  setColor(hex: string): void {
    this.stampForm.patchValue({ color: hex });
  }

  drawStamp(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const values = this.stampForm.value;
    const color = values.color || '#1e3a8a';
    const shape = values.shape || 'circular';
    const topText = (values.topText || '').trim().toUpperCase();
    const bottomText = (values.bottomText || '').trim().toUpperCase();
    const centerLine1 = (values.centerLine1 || '').trim().toUpperCase();
    const centerLine2 = (values.centerLine2 || '').trim().toUpperCase();
    const effect = values.effect || 'clean';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (shape === 'box') {
      this.drawBoxStamp(ctx, centerX, centerY, width, height, color, topText, centerLine1, centerLine2, bottomText);
    } else {
      this.drawCircularOrOvalStamp(ctx, centerX, centerY, shape === 'oval', color, topText, centerLine1, centerLine2, bottomText);
    }

    // Vintage distressed rubber effect
    if (effect === 'vintage') {
      this.applyVintageDistress(ctx, width, height);
    }

    ctx.restore();
  }

  private drawCircularOrOvalStamp(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    isOval: boolean,
    color: string,
    topText: string,
    centerLine1: string,
    centerLine2: string,
    bottomText: string
  ): void {
    const outerRadius = 265;
    const innerRadius = 250;
    const textRadius = 215;
    const centerRingRadius = 170;

    ctx.save();
    if (isOval) {
      ctx.scale(1.1, 0.9);
      centerX = centerX / 1.1;
      centerY = centerY / 0.9;
    }

    // Outer thick circle
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner thin circle
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center boundary circle
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerRingRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dashed decorative ring
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerRingRadius - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Top Text (along top arc)
    if (topText) {
      ctx.font = 'bold 30px "Outfit", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawCurvedText(ctx, topText, centerX, centerY, textRadius, true);
    }

    // Draw Bottom Text (along bottom arc)
    if (bottomText) {
      ctx.font = 'bold 26px "Outfit", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.drawCurvedText(ctx, bottomText, centerX, centerY, textRadius, false);
    }

    // Stars on the sides separating top and bottom arcs
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', centerX - textRadius, centerY);
    ctx.fillText('★', centerX + textRadius, centerY);

    // Center Text Line 1
    if (centerLine1) {
      ctx.font = 'bold 28px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const offset = centerLine2 ? centerY - 20 : centerY;
      ctx.fillText(centerLine1, centerX, offset);
    }

    // Center Text Line 2
    if (centerLine2) {
      ctx.font = 'bold 22px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(centerLine2, centerX, centerY + 24);
    }

    // Small decorative center star below center text
    ctx.font = '16px sans-serif';
    ctx.fillText('♦ ♦ ♦', centerX, centerY + (centerLine2 ? 56 : 38));

    ctx.restore();
  }

  private drawBoxStamp(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    color: string,
    topText: string,
    centerLine1: string,
    centerLine2: string,
    bottomText: string
  ): void {
    const boxW = 520;
    const boxH = 340;
    const x = centerX - boxW / 2;
    const y = centerY - boxH / 2;

    // Outer double border
    ctx.lineWidth = 8;
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, y + 10, boxW - 20, boxH - 20);

    // Top text
    if (topText) {
      ctx.font = 'bold 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(topText, centerX, y + 26);
    }

    // Divider line
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 25, y + 74);
    ctx.lineTo(x + boxW - 25, y + 74);
    ctx.stroke();

    // Center Text
    if (centerLine1) {
      ctx.font = 'bold 34px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(centerLine1, centerX, centerY - (centerLine2 ? 14 : 0));
    }

    if (centerLine2) {
      ctx.font = 'bold 24px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(centerLine2, centerX, centerY + 30);
    }

    // Bottom divider line
    ctx.beginPath();
    ctx.moveTo(x + 25, y + boxH - 74);
    ctx.lineTo(x + boxW - 25, y + boxH - 74);
    ctx.stroke();

    // Bottom text
    if (bottomText) {
      ctx.font = 'bold 24px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(bottomText, centerX, y + boxH - 26);
    }
  }

  private drawCurvedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    radius: number,
    isTop: boolean
  ): void {
    ctx.save();
    ctx.translate(centerX, centerY);

    const totalWidth = ctx.measureText(text).width;
    const totalAngle = totalWidth / radius;
    let currentAngle = isTop ? -totalAngle / 2 : totalAngle / 2;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = ctx.measureText(char).width;
      const charAngle = charWidth / radius;

      ctx.save();
      if (isTop) {
        ctx.rotate(currentAngle + charAngle / 2);
        ctx.translate(0, -radius);
        ctx.fillText(char, 0, 0);
      } else {
        ctx.rotate(currentAngle - charAngle / 2);
        ctx.translate(0, radius);
        ctx.rotate(Math.PI);
        ctx.fillText(char, 0, 0);
      }
      ctx.restore();

      currentAngle += isTop ? charAngle : -charAngle;
    }

    ctx.restore();
  }

  private applyVintageDistress(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';

    // Random micro dots mimicking porous rubber stamp texture
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * width;
      const ry = Math.random() * height;
      const size = Math.random() * 2.5 + 0.5;
      ctx.beginPath();
      ctx.arc(rx, ry, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  applyAndUpload(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');

    const values = this.stampForm.value;
    const title = values.title || 'Official Stamp';
    const setAsDefault = !!values.setAsDefault;

    this.uploading = true;
    this.tenantService.uploadTenantAsset({
      assetType: 'seal',
      imageData: dataUrl,
      title: title,
      setAsDefault: setAsDefault
    }).subscribe({
      next: (res) => {
        this.uploading = false;
        this.dialogRef.close({
          success: true,
          asset: res.asset,
          officialSeal: res.officialSeal,
          officialSealsJson: res.officialSealsJson
        });
      },
      error: () => {
        this.uploading = false;
        // Even if direct backend upload failed, return dataUrl to parent so it can save via form
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
