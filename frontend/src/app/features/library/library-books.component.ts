import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LibraryService, LibraryBookDto, BookCopyDto, LibraryStatsDto } from '../../core/services/library.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-library-books',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="library-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">
            <mat-icon class="title-icon">local_library</mat-icon>
            Library Catalog &amp; Inventory
          </h2>
          <p class="page-subtitle">
            Catalog books, manage multiple physical copies with accession barcodes, rack shelf locations, and categories.
          </p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/library/plans" class="circ-link-btn">
            <mat-icon>schedule</mat-icon> Shifts &amp; Plans
          </a>
          <a mat-stroked-button routerLink="/library/circulation" class="circ-link-btn">
            <mat-icon>sync_alt</mat-icon> Issue &amp; Return Counter
          </a>
          <button mat-raised-button color="primary" class="action-btn" (click)="openAddBookDrawer()">
            <mat-icon>add</mat-icon>
            <span>Add New Title</span>
          </button>
        </div>
      </div>

      <!-- Live KPI Cards -->
      <div class="stats-grid">
        <div class="stat-card titles">
          <div class="stat-icon"><mat-icon>menu_book</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.totalTitles || books.length }}</span>
            <span class="stat-lbl">Book Titles</span>
          </div>
        </div>
        <div class="stat-card copies">
          <div class="stat-icon"><mat-icon>auto_stories</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.totalCopies || 0 }}</span>
            <span class="stat-lbl">Total Physical Copies</span>
          </div>
        </div>
        <div class="stat-card available">
          <div class="stat-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.availableCopies || 0 }}</span>
            <span class="stat-lbl">Available on Shelves</span>
          </div>
        </div>
        <div class="stat-card issued">
          <div class="stat-icon"><mat-icon>assignment_ind</mat-icon></div>
          <div class="stat-info">
            <span class="stat-val">{{ stats?.issuedCopies || 0 }}</span>
            <span class="stat-lbl">Currently Issued</span>
          </div>
        </div>
      </div>

      <!-- Add / Edit Book Drawer -->
      <mat-card *ngIf="showBookDrawer" class="form-drawer mat-elevation-z3">
        <div class="drawer-header">
          <div class="drawer-title">
            <mat-icon color="primary">{{ isEditMode ? 'edit' : 'library_add' }}</mat-icon>
            <div>
              <strong>{{ isEditMode ? 'Edit Book Details' : 'Catalog New Book Title' }}</strong>
              <small>{{ isEditMode ? 'Update metadata for ' + selectedBook?.title : 'Add title with initial physical copies' }}</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeBookDrawer()"><mat-icon>close</mat-icon></button>
        </div>

        <form [formGroup]="bookForm" (ngSubmit)="onSubmitBook()" class="drawer-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="f-flex-2">
              <mat-label>Book Title</mat-label>
              <input matInput formControlName="title" placeholder="e.g. Concepts of Physics - Vol 1" />
              <mat-error *ngIf="bookForm.get('title')?.hasError('required')">Title is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Author / Writer</mat-label>
              <input matInput formControlName="author" placeholder="e.g. H.C. Verma" />
              <mat-error *ngIf="bookForm.get('author')?.hasError('required')">Author is required</mat-error>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Category / Genre</mat-label>
              <mat-select formControlName="category">
                <mat-option value="NCERT">NCERT Textbook</mat-option>
                <mat-option value="JEE Advanced">JEE (Main &amp; Advanced)</mat-option>
                <mat-option value="NEET">NEET Medical</mat-option>
                <mat-option value="Foundation">Foundation (9th-10th)</mat-option>
                <mat-option value="Reference">Reference Book</mat-option>
                <mat-option value="Sample Papers">Sample Papers / PYQ</mat-option>
                <mat-option value="General">General / Literature</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Subject</mat-label>
              <input matInput formControlName="subject" placeholder="e.g. Physics, Chemistry, Math" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Target School Class (Optional)</mat-label>
              <mat-select formControlName="classId">
                <mat-option [value]="null">All Classes / General</mat-option>
                <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Publisher</mat-label>
              <input matInput formControlName="publisher" placeholder="e.g. Bharati Bhawan, Arihant" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>Edition</mat-label>
              <input matInput formControlName="edition" placeholder="e.g. 2026 Edition" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="f-flex-1">
              <mat-label>ISBN (Optional)</mat-label>
              <input matInput formControlName="isbn" placeholder="e.g. 978-8177091878" />
            </mat-form-field>
          </div>

          <!-- Initial Copies Setup (Only when Creating) -->
          <div class="copies-setup-box" *ngIf="!isEditMode">
            <div class="csb-title">
              <mat-icon color="primary">add_to_photos</mat-icon>
              <span>Initial Physical Inventory (Accession Numbers)</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Number of Physical Copies</mat-label>
                <input matInput type="number" formControlName="initialCopiesCount" min="1" max="100" />
                <mat-hint>Automatically creates sequential accession numbers</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Rack / Shelf Location</mat-label>
                <input matInput formControlName="initialRackLocation" placeholder="e.g. Almirah B - Shelf 2" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="f-flex-1">
                <mat-label>Purchase Price (₹/copy)</mat-label>
                <input matInput type="number" formControlName="initialPrice" placeholder="e.g. 450" />
              </mat-form-field>
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description / Notes</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="Syllabus coverage, volume details, etc."></textarea>
          </mat-form-field>

          <div class="drawer-footer">
            <button mat-button type="button" (click)="closeBookDrawer()" [disabled]="saving">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="bookForm.invalid || saving">
              <span>{{ isEditMode ? 'Update Book Title' : 'Save &amp; Generate Copies' }}</span>
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Manage Physical Copies Drawer -->
      <mat-card *ngIf="showCopiesDrawer" class="form-drawer mat-elevation-z3">
        <div class="drawer-header">
          <div class="drawer-title">
            <mat-icon color="primary">inventory_2</mat-icon>
            <div>
              <strong>Physical Inventory &amp; Accession Copies</strong>
              <small>{{ selectedBookForCopies?.title }} &bull; {{ selectedBookForCopies?.copies?.length || 0 }} Copies</small>
            </div>
          </div>
          <button mat-icon-button (click)="closeCopiesDrawer()"><mat-icon>close</mat-icon></button>
        </div>

        <!-- Add Copy Inline Form -->
        <div class="add-copy-panel">
          <div class="acp-title">Add Physical Copy to this Title:</div>
          <div class="acp-row">
            <mat-form-field appearance="outline" class="copy-input">
              <mat-label>Accession Number</mat-label>
              <input matInput [(ngModel)]="newCopyAccession" placeholder="e.g. ACC-00420" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="copy-input">
              <mat-label>Rack / Shelf Location</mat-label>
              <input matInput [(ngModel)]="newCopyRack" placeholder="e.g. Rack C - Shelf 1" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="copy-input">
              <mat-label>Price (₹)</mat-label>
              <input matInput type="number" [(ngModel)]="newCopyPrice" placeholder="350" />
            </mat-form-field>

            <button mat-raised-button color="primary" class="btn-add-copy" (click)="onAddSingleCopy()" [disabled]="!newCopyAccession || copySaving">
              <mat-icon>add</mat-icon>
              <span>Add Copy</span>
            </button>
          </div>
        </div>

        <!-- Copies Table -->
        <div class="copies-table-wrap">
          <table class="copies-table">
            <thead>
              <tr>
                <th>Accession No</th>
                <th>Barcode</th>
                <th>Rack Location</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of selectedBookForCopies?.copies">
                <td><strong>{{ c.accessionNumber }}</strong></td>
                <td><span class="barcode-tag">{{ c.barcode || c.accessionNumber }}</span></td>
                <td>{{ c.rackLocation || 'Shelf General' }}</td>
                <td>₹{{ c.price }}</td>
                <td>
                  <span class="status-pill" [ngClass]="c.status.toLowerCase()">
                    {{ c.status }}
                  </span>
                </td>
                <td>
                  <button mat-icon-button color="warn" (click)="deleteCopy(c)" [disabled]="c.status === 'Issued'" matTooltip="Delete Copy">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
              <tr *ngIf="!selectedBookForCopies?.copies || selectedBookForCopies?.copies?.length === 0">
                <td colspan="6" class="no-copies">No physical copies added yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>

      <!-- Filter Toolbar & Books List -->
      <mat-card class="table-card mat-elevation-z2" *ngIf="!showBookDrawer && !showCopiesDrawer">
        <div class="filter-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Title, Author, ISBN, Accession...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadBooks()" placeholder="Search..." />
            <button mat-icon-button matSuffix (click)="loadBooks()"><mat-icon>search</mat-icon></button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Category / Stream</mat-label>
            <mat-select [(ngModel)]="selectedCategory" (selectionChange)="loadBooks()">
              <mat-option value="All">All Categories</mat-option>
              <mat-option value="NCERT">NCERT Textbook</mat-option>
              <mat-option value="JEE Advanced">JEE Advanced</mat-option>
              <mat-option value="NEET">NEET Medical</mat-option>
              <mat-option value="Foundation">Foundation</mat-option>
              <mat-option value="Reference">Reference Book</mat-option>
              <mat-option value="Sample Papers">Sample Papers</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Target Class</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="loadBooks()">
              <mat-option [value]="null">All Classes</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <div class="books-grid" *ngIf="!loading && books.length > 0">
          <div class="book-card" *ngFor="let b of books">
            <div class="book-card-top">
              <span class="category-badge" [ngClass]="getCategoryClass(b.category)">{{ b.category }}</span>
              <span class="class-tag" *ngIf="b.className">🏫 {{ b.className }}</span>
            </div>

            <h3 class="book-title" [matTooltip]="b.title">{{ b.title }}</h3>
            <p class="book-author">By <strong>{{ b.author }}</strong></p>

            <div class="book-meta-row">
              <span class="meta-item" *ngIf="b.subject">
                <mat-icon>subject</mat-icon> {{ b.subject }}
              </span>
              <span class="meta-item" *ngIf="b.publisher">
                <mat-icon>business</mat-icon> {{ b.publisher }}
              </span>
            </div>

            <div class="stock-pill-bar">
              <div class="stock-pill" [class.out-of-stock]="b.availableCopies === 0">
                <mat-icon>{{ b.availableCopies > 0 ? 'check_circle' : 'error_outline' }}</mat-icon>
                <span><strong>{{ b.availableCopies }}</strong> / {{ b.totalCopies }} Available</span>
              </div>
              <span class="issued-tag" *ngIf="b.issuedCopies > 0">
                {{ b.issuedCopies }} Issued
              </span>
            </div>

            <div class="book-card-actions">
              <button mat-stroked-button color="primary" class="copies-btn" (click)="openCopiesDrawer(b)">
                <mat-icon>inventory_2</mat-icon>
                <span>Manage Copies ({{ b.totalCopies }})</span>
              </button>
              <div class="btn-group">
                <button mat-icon-button (click)="editBook(b)" matTooltip="Edit Book Details">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteBook(b)" matTooltip="Delete Title">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!loading && books.length === 0">
          <mat-icon>local_library</mat-icon>
          <h3>No Books Found in Catalog</h3>
          <p>Start building your institute's library catalog by adding your first textbook or coaching study material.</p>
          <button mat-raised-button color="primary" (click)="openAddBookDrawer()">
            <mat-icon>add</mat-icon>
            <span>Add Book Title</span>
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .library-container { display: flex; flex-direction: column; gap: 16px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
      .page-title { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px; }
      .title-icon { color: #2563eb; font-size: 1.7rem; width: 1.7rem; height: 1.7rem; }
      .page-subtitle { color: #64748b; margin: 4px 0 0; font-size: 0.88rem; }
    }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .circ-link-btn {
      color: #0284c7 !important; border-color: #7dd3fc !important; font-weight: 600;
      mat-icon { margin-right: 4px; }
    }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
    .stat-card {
      background: #ffffff; border-radius: 12px; padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      .stat-icon {
        width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .stat-info {
        .stat-val { font-size: 1.55rem; font-weight: 800; color: #0f172a; display: block; line-height: 1.1; }
        .stat-lbl { font-size: 0.76rem; font-weight: 600; color: #64748b; }
      }
      &.titles .stat-icon { background: #eff6ff; color: #2563eb; }
      &.copies .stat-icon { background: #f5f3ff; color: #7c3aed; }
      &.available .stat-icon { background: #f0fdf4; color: #16a34a; }
      &.issued .stat-icon { background: #fff7ed; color: #ea580c; }
    }

    /* Drawers */
    .form-drawer {
      padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1; background: #ffffff;
      display: flex; flex-direction: column; gap: 16px;
      .drawer-header {
        display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;
        .drawer-title {
          display: flex; align-items: center; gap: 10px;
          strong { font-size: 1.1rem; color: #0f172a; display: block; }
          small { color: #64748b; font-size: 0.82rem; }
        }
      }
      .drawer-form { display: flex; flex-direction: column; gap: 12px; }
      .form-row { display: flex; flex-wrap: wrap; gap: 14px; }
      .f-flex-1 { flex: 1; min-width: 160px; }
      .f-flex-2 { flex: 2; min-width: 260px; }
      .full-width { width: 100%; }

      .copies-setup-box {
        background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px;
        .csb-title {
          display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 10px;
        }
      }
      .drawer-footer {
        display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 12px;
      }
    }

    /* Physical Copies Drawer Panel */
    .add-copy-panel {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;
      .acp-title { font-size: 0.84rem; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
      .acp-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .copy-input { width: 180px; margin-bottom: -16px; }
      .btn-add-copy { height: 48px; }
    }
    .copies-table-wrap {
      border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
      .copies-table {
        width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;
        th { background: #f1f5f9; color: #475569; font-weight: 700; padding: 10px 14px; }
        td { padding: 10px 14px; border-top: 1px solid #f1f5f9; }
        .barcode-tag { font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; }
        .status-pill {
          padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;
          &.available { background: #dcfce7; color: #15803d; }
          &.issued { background: #fef3c7; color: #b45309; }
          &.lost { background: #fee2e2; color: #b91c1c; }
        }
        .no-copies { text-align: center; color: #94a3b8; padding: 24px; }
      }
    }

    /* Table Toolbar & Books Grid */
    .table-card { border-radius: 12px; overflow: hidden; }
    .filter-toolbar {
      padding: 16px 20px 6px 20px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
      .search-field { width: 340px; }
      .filter-select { width: 220px; }
    }

    .books-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; padding: 16px 20px;
    }
    .book-card {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }

      .book-card-top { display: flex; justify-content: space-between; align-items: center; }
      .category-badge {
        font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;
        &.cat-ncert { background: #ecfdf5; color: #059669; }
        &.cat-jee { background: #eff6ff; color: #1d4ed8; }
        &.cat-neet { background: #fdf2f8; color: #db2777; }
        &.cat-foundation { background: #faf5ff; color: #7c3aed; }
        &.cat-default { background: #f1f5f9; color: #475569; }
      }
      .class-tag { font-size: 0.72rem; font-weight: 600; color: #64748b; }
      .book-title { font-size: 1.05rem; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.3; }
      .book-author { font-size: 0.82rem; color: #64748b; margin: 0; }
      .book-meta-row {
        display: flex; gap: 12px; font-size: 0.75rem; color: #64748b;
        .meta-item { display: inline-flex; align-items: center; gap: 4px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      }
      .stock-pill-bar {
        display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 6px 10px; border-radius: 6px;
        .stock-pill {
          display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; color: #15803d;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #16a34a; }
          &.out-of-stock { color: #dc2626; mat-icon { color: #ef4444; } }
        }
        .issued-tag { font-size: 0.74rem; font-weight: 600; color: #d97706; }
      }
      .book-card-actions {
        display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px;
        .copies-btn { font-size: 0.75rem; height: 32px; font-weight: 600; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
        .btn-group { display: flex; gap: 2px; }
      }
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px;
      mat-icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { font-size: 1.2rem; color: #1e293b; margin: 0 0 6px; }
      p { color: #64748b; font-size: 0.88rem; max-width: 440px; margin: 0 0 16px; }
    }
  `]
})
export class LibraryBooksComponent implements OnInit {
  books: LibraryBookDto[] = [];
  schoolClasses: SchoolClassDto[] = [];
  stats: LibraryStatsDto | null = null;
  loading = false;
  saving = false;
  copySaving = false;

  searchTerm = '';
  selectedCategory = 'All';
  selectedClassId: string | null = null;

  showBookDrawer = false;
  isEditMode = false;
  selectedBook: LibraryBookDto | null = null;

  showCopiesDrawer = false;
  selectedBookForCopies: LibraryBookDto | null = null;
  newCopyAccession = '';
  newCopyRack = '';
  newCopyPrice: number | null = null;

  bookForm: FormGroup;

  constructor(
    private libraryService: LibraryService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {
    this.bookForm = this.fb.group({
      title: ['', Validators.required],
      author: ['', Validators.required],
      publisher: [''],
      edition: [''],
      isbn: [''],
      category: ['NCERT', Validators.required],
      subject: [''],
      classId: [null],
      description: [''],
      initialCopiesCount: [3, [Validators.required, Validators.min(0)]],
      initialRackLocation: ['Almirah A - Shelf 1'],
      initialPrice: [350]
    });
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadBooks();
    this.schoolService.getClasses(false).subscribe(c => this.schoolClasses = c || []);
  }

  loadStats(): void {
    this.libraryService.getStats().subscribe(s => this.stats = s);
  }

  loadBooks(): void {
    this.loading = true;
    const classIdParam = (this.selectedClassId && this.selectedClassId !== 'null' && this.selectedClassId !== 'undefined')
      ? this.selectedClassId
      : undefined;

    this.libraryService.getBooks({
      searchTerm: this.searchTerm?.trim() || undefined,
      category: this.selectedCategory !== 'All' ? this.selectedCategory : undefined,
      classId: classIdParam
    }).subscribe({
      next: (res) => {
        this.books = res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load library books:', err);
        this.books = [];
        this.loading = false;
      }
    });
  }

  getCategoryClass(category: string): string {
    switch (category) {
      case 'NCERT': return 'cat-ncert';
      case 'JEE Advanced': return 'cat-jee';
      case 'NEET': return 'cat-neet';
      case 'Foundation': return 'cat-foundation';
      default: return 'cat-default';
    }
  }

  openAddBookDrawer(): void {
    this.isEditMode = false;
    this.selectedBook = null;
    this.bookForm.reset({
      category: 'NCERT',
      initialCopiesCount: 3,
      initialRackLocation: 'Almirah A - Shelf 1',
      initialPrice: 350
    });
    this.showBookDrawer = true;
    this.showCopiesDrawer = false;
  }

  editBook(book: LibraryBookDto): void {
    this.isEditMode = true;
    this.selectedBook = book;
    this.bookForm.patchValue({
      title: book.title,
      author: book.author,
      publisher: book.publisher || '',
      edition: book.edition || '',
      isbn: book.isbn || '',
      category: book.category || 'NCERT',
      subject: book.subject || '',
      classId: book.classId || null,
      description: book.description || ''
    });
    this.showBookDrawer = true;
    this.showCopiesDrawer = false;
  }

  closeBookDrawer(): void {
    this.showBookDrawer = false;
    this.selectedBook = null;
  }

  onSubmitBook(): void {
    if (this.bookForm.invalid) return;
    this.saving = true;
    const formVal = this.bookForm.value;

    if (this.isEditMode && this.selectedBook) {
      this.libraryService.updateBook(this.selectedBook.id, {
        title: formVal.title,
        author: formVal.author,
        publisher: formVal.publisher,
        edition: formVal.edition,
        isbn: formVal.isbn,
        category: formVal.category,
        subject: formVal.subject,
        classId: formVal.classId,
        description: formVal.description,
        isActive: true
      }).subscribe({
        next: () => {
          this.saving = false;
          this.closeBookDrawer();
          this.loadBooks();
          this.loadStats();
          this.confirmDialog.alert('Updated', 'Book details updated successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Update Failed', err?.error?.message || 'Failed to update book.', 'danger');
        }
      });
    } else {
      this.libraryService.createBook({
        title: formVal.title,
        author: formVal.author,
        publisher: formVal.publisher,
        edition: formVal.edition,
        isbn: formVal.isbn,
        category: formVal.category,
        subject: formVal.subject,
        classId: formVal.classId,
        description: formVal.description,
        initialCopiesCount: formVal.initialCopiesCount || 0,
        initialRackLocation: formVal.initialRackLocation,
        initialPrice: formVal.initialPrice || 0
      }).subscribe({
        next: () => {
          this.saving = false;
          this.closeBookDrawer();
          this.loadBooks();
          this.loadStats();
          this.confirmDialog.alert('Cataloged', 'New book title and accession copies created successfully!', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Creation Failed', err?.error?.message || 'Failed to add book.', 'danger');
        }
      });
    }
  }

  deleteBook(book: LibraryBookDto): void {
    this.confirmDialog.danger(
      'Delete Book Title',
      `Are you sure you want to delete "${book.title}" and its accession copies?`,
      'Delete Title'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.libraryService.deleteBook(book.id).subscribe({
          next: () => {
            this.loadBooks();
            this.loadStats();
            this.confirmDialog.alert('Deleted', 'Book title deleted successfully.', 'success');
          },
          error: (err) => {
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete book.', 'danger');
          }
        });
      }
    });
  }

  // --- Manage Physical Copies Drawer ---

  openCopiesDrawer(book: LibraryBookDto): void {
    this.selectedBookForCopies = book;
    this.showCopiesDrawer = true;
    this.showBookDrawer = false;
    this.newCopyAccession = `ACC-${Math.floor(10000 + Math.random() * 90000)}`;
    this.newCopyRack = 'Almirah A - Shelf 1';
    this.newCopyPrice = 350;
  }

  closeCopiesDrawer(): void {
    this.showCopiesDrawer = false;
    this.selectedBookForCopies = null;
  }

  onAddSingleCopy(): void {
    if (!this.selectedBookForCopies || !this.newCopyAccession) return;
    this.copySaving = true;

    this.libraryService.createCopy({
      bookId: this.selectedBookForCopies.id,
      accessionNumber: this.newCopyAccession.trim(),
      rackLocation: this.newCopyRack,
      price: this.newCopyPrice || 0
    }).subscribe({
      next: (copy) => {
        this.copySaving = false;
        if (this.selectedBookForCopies) {
          if (!this.selectedBookForCopies.copies) this.selectedBookForCopies.copies = [];
          this.selectedBookForCopies.copies.push(copy);
        }
        this.newCopyAccession = `ACC-${Math.floor(10000 + Math.random() * 90000)}`;
        this.loadBooks();
        this.loadStats();
      },
      error: (err) => {
        this.copySaving = false;
        this.confirmDialog.alert('Copy Add Failed', err?.error?.message || 'Failed to add copy.', 'danger');
      }
    });
  }

  deleteCopy(copy: BookCopyDto): void {
    this.confirmDialog.danger(
      'Remove Physical Copy',
      `Remove copy with Accession Number "${copy.accessionNumber}"?`,
      'Remove Copy'
    ).subscribe((confirmed) => {
      if (confirmed && this.selectedBookForCopies) {
        this.libraryService.deleteCopy(copy.id).subscribe({
          next: () => {
            if (this.selectedBookForCopies?.copies) {
              this.selectedBookForCopies.copies = this.selectedBookForCopies.copies.filter(c => c.id !== copy.id);
            }
            this.loadBooks();
            this.loadStats();
          },
          error: (err) => {
            this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Could not delete copy.', 'danger');
          }
        });
      }
    });
  }
}
