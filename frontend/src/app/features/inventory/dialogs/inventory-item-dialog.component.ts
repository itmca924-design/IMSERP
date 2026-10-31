import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryCategory, InventoryItem, CreateUpdateItemDto, CreateUpdateCategoryDto } from '../inventory.models';
import { InventoryCategoryDialogComponent } from './inventory-category-dialog.component';
import { InventoryService } from '../inventory.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

export interface InventoryItemDialogData {
  isEdit: boolean;
  item?: InventoryItem;
  categories: InventoryCategory[];
  branchId?: string;
}

@Component({
  selector: 'app-inventory-item-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
],
  template: `
    <div class="dialog-container">
      <!-- Strict ERP Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <div class="header-icon-box">
            <mat-icon>{{ data.isEdit ? 'edit_note' : 'inventory_2' }}</mat-icon>
          </div>
          <div class="header-title-wrap">
            <h2>{{ data.isEdit ? 'Edit Inventory Item' : 'Add New Inventory Item' }}</h2>
            <p>{{ data.isEdit ? 'Update item specifications, prices, or storage location' : 'Create a new stock item (Stationery, Uniforms, Books, Assets, Consumables)' }}</p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-body">
          <div class="form-grid">
            <!-- Category with Quick-Add -->
            <div class="col-span-2 category-field-wrap">
              <mat-form-field appearance="outline" class="category-select">
                <mat-label>Item Category</mat-label>
                <mat-select formControlName="categoryId">
                  @for (cat of data.categories; track cat) {
                    <mat-option [value]="cat.id">
                      {{ cat.name }} ({{ cat.code }})
                    </mat-option>
                  }
                </mat-select>
                @if (data.categories.length === 0) {
                  <mat-hint class="text-danger">
                    No categories found. Click 'New Category' to create one!
                  </mat-hint>
                }
                @if (form.get('categoryId')?.hasError('required')) {
                  <mat-error>
                    Category is required
                  </mat-error>
                }
              </mat-form-field>
    
              <button mat-stroked-button color="primary" type="button" class="quick-add-cat-btn" (click)="openAddCategory()" matTooltip="Create a new stock category">
                <mat-icon>add</mat-icon>
                <span>New Category</span>
              </button>
            </div>
    
            <!-- Item Name -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Item Name</mat-label>
              <input matInput formControlName="itemName" placeholder="e.g. Blue Ballpoint Pen, Boys Shirt 32, Class 10 Maths Book" />
              @if (form.get('itemName')?.hasError('required')) {
                <mat-error>
                  Item name is required
                </mat-error>
              }
            </mat-form-field>
    
            <!-- Item Code / SKU -->
            <mat-form-field appearance="outline">
              <mat-label>Item Code / SKU</mat-label>
              <input matInput formControlName="itemCode" placeholder="Auto-generated if blank" />
              <mat-hint>Unique code (e.g. ITM-PEN-01)</mat-hint>
            </mat-form-field>
    
            <!-- Item Type -->
            <mat-form-field appearance="outline">
              <mat-label>Item Classification</mat-label>
              <mat-select formControlName="itemType">
                <mat-option value="Consumable">Consumable (Pen, Pencil, Paper, Chalk)</mat-option>
                <mat-option value="Kit/Sellable">Kit / Sellable (Uniforms, Books, Diaries)</mat-option>
                <mat-option value="Asset">Fixed Asset (Computers, Projectors, Furniture)</mat-option>
              </mat-select>
            </mat-form-field>
    
            <!-- Unit of Measurement (UOM) -->
            <mat-form-field appearance="outline">
              <mat-label>Unit of Measurement (UOM)</mat-label>
              <mat-select formControlName="unitOfMeasurement">
                <mat-option value="Pcs">Pieces (Pcs)</mat-option>
                <mat-option value="Box">Box</mat-option>
                <mat-option value="Set">Kit / Set</mat-option>
                <mat-option value="Packet">Packet</mat-option>
                <mat-option value="Dozen">Dozen</mat-option>
                <mat-option value="Roll">Roll</mat-option>
                <mat-option value="Kg">Kilogram (Kg)</mat-option>
                <mat-option value="Liter">Liter</mat-option>
                <mat-option value="Ream">Ream (500 Sheets)</mat-option>
              </mat-select>
            </mat-form-field>
    
            <!-- Min Stock Alert Level -->
            <mat-form-field appearance="outline">
              <mat-label>Low Stock Reorder Alert Level</mat-label>
              <input matInput type="number" formControlName="minStockAlertLevel" min="0" />
              <mat-hint>Trigger alert when stock drops below this</mat-hint>
            </mat-form-field>
    
            <!-- Purchase Rate -->
            <mat-form-field appearance="outline">
              <mat-label>Purchase Cost Price (₹)</mat-label>
              <input matInput type="number" formControlName="purchasePrice" min="0" step="0.5" />
            </mat-form-field>
    
            <!-- Selling Price / Student Issue Rate -->
            <mat-form-field appearance="outline">
              <mat-label>Selling / Student Issue MRP (₹)</mat-label>
              <input matInput type="number" formControlName="sellingPrice" min="0" step="0.5" />
            </mat-form-field>
    
            <!-- Initial Opening Stock (Only in Add mode) -->
            @if (!data.isEdit) {
              <mat-form-field appearance="outline">
                <mat-label>Opening Physical Stock</mat-label>
                <input matInput type="number" formControlName="initialStock" min="0" />
                <mat-hint>Current quantity in store</mat-hint>
              </mat-form-field>
            }
    
            <!-- Rack / Store Location -->
            <mat-form-field appearance="outline" [class.col-span-2]="data.isEdit">
              <mat-label>Rack / Store Location</mat-label>
              <input matInput formControlName="rackOrLocation" placeholder="e.g. Shelf B-2, Science Lab Cupboard" />
            </mat-form-field>
    
            <!-- Description -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Description / Specifications</mat-label>
              <textarea matInput formControlName="description" rows="2" placeholder="Additional details like size, color, publisher, brand"></textarea>
            </mat-form-field>
          </div>
        </mat-dialog-content>
    
        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancel
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
            @if (submitting) {
              <mat-spinner diameter="18" class="spinner-btn"></mat-spinner>
            }
            <span>{{ data.isEdit ? 'Update Item' : 'Save Item' }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    .dialog-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-title-wrap h2 {
      color: #1e3a8a;
      font-weight: 700;
      margin: 0;
      font-size: 1.15rem;
      letter-spacing: -0.01em;
    }
    .header-title-wrap p {
      color: #3b82f6;
      margin: 2px 0 0;
      font-size: 0.82rem;
    }
    .close-btn {
      color: #64748b;
      &:hover {
        color: #1e293b;
      }
    }
    .dialog-body {
      padding: 20px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .category-field-wrap {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      .category-select { flex: 1; }
      .quick-add-cat-btn {
        height: 54px;
        margin-top: 2px;
        white-space: nowrap;
      }
    }
    .text-danger { color: #dc2626; }
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      gap: 8px;
    }
    .spinner-btn {
      display: inline-block;
      margin-right: 8px;
    }
    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      .col-span-2 {
        grid-column: span 1;
      }
      .category-field-wrap {
        flex-direction: column;
        .quick-add-cat-btn { width: 100%; height: 42px; margin-top: -6px; margin-bottom: 8px; }
      }
    }
  `]
})
export class InventoryItemDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<InventoryItemDialogComponent>,
    private readonly dialog: MatDialog,
    private readonly inventoryService: InventoryService,
    private readonly confirmDialog: ConfirmDialogService,
    @Inject(MAT_DIALOG_DATA) public readonly data: InventoryItemDialogData
  ) {}

  openAddCategory(): void {
    const catRef = this.dialog.open(InventoryCategoryDialogComponent, {
      width: '500px',
      maxWidth: '96vw',
      disableClose: true,
      data: {
        isEdit: false,
        branchId: this.data.branchId
      }
    });

    catRef.afterClosed().subscribe((res: CreateUpdateCategoryDto | undefined) => {
      if (!res) return;
      this.inventoryService.createCategory(res).subscribe({
        next: created => {
          this.data.categories.push(created);
          this.form.patchValue({ categoryId: created.id });
          this.confirmDialog.alert('Category Created', `Category "${created.name}" created and selected!`, 'success');
        },
        error: err => {
          this.confirmDialog.alert('Error', err?.error?.message || err?.error || 'Failed to create category.', 'danger');
        }
      });
    });
  }

  ngOnInit(): void {
    const it = this.data.item;
    this.form = this.fb.group({
      categoryId: [it?.categoryId || (this.data.categories.length > 0 ? this.data.categories[0].id : ''), [Validators.required]],
      itemCode: [it?.itemCode || ''],
      itemName: [it?.itemName || '', [Validators.required, Validators.maxLength(150)]],
      itemType: [it?.itemType || 'Consumable', [Validators.required]],
      unitOfMeasurement: [it?.unitOfMeasurement || 'Pcs', [Validators.required]],
      purchasePrice: [it?.purchasePrice ?? 0, [Validators.min(0)]],
      sellingPrice: [it?.sellingPrice ?? 0, [Validators.min(0)]],
      initialStock: [0, [Validators.min(0)]],
      minStockAlertLevel: [it?.minStockAlertLevel ?? 5, [Validators.required, Validators.min(0)]],
      rackOrLocation: [it?.rackOrLocation || ''],
      description: [it?.description || '']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const result: CreateUpdateItemDto = {
      categoryId: val.categoryId,
      itemCode: val.itemCode?.trim() || undefined,
      itemName: val.itemName.trim(),
      itemType: val.itemType,
      unitOfMeasurement: val.unitOfMeasurement,
      purchasePrice: Number(val.purchasePrice) || 0,
      sellingPrice: Number(val.sellingPrice) || 0,
      initialStock: Number(val.initialStock) || 0,
      minStockAlertLevel: Number(val.minStockAlertLevel) || 5,
      rackOrLocation: val.rackOrLocation?.trim() || undefined,
      description: val.description?.trim() || undefined,
      isActive: true,
      branchId: this.data.branchId
    };

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
