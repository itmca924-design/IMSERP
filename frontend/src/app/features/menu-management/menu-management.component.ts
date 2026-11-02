import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  ManagedMenuItem,
  ManagedMenuOption,
  MenuManagementPermissions,
  MenuService,
  SaveMenuItem
} from '../../core/services/menu.service';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <header class="page-header">
        <div>
          <h1 class="page-title">Menu Management</h1>
          <p class="page-subtitle">Create and organize navigation menus and routes.</p>
        </div>
        <button type="button" matButton="filled" color="primary" (click)="openCreateForm()" [disabled]="!permissions.canCreate">
          <mat-icon>add</mat-icon>
          Create menu
        </button>
      </header>

      @if (showForm) {
        <mat-card class="editor-card">
          <div class="editor-heading">
            <div>
              <h2>{{ editingItem ? 'Edit menu item' : 'Create menu item' }}</h2>
              <p>Choose an optional parent to place this menu in the hierarchy.</p>
            </div>
            <button type="button" mat-icon-button aria-label="Close form" (click)="closeForm()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="menuForm" (ngSubmit)="saveMenuItem()">
            <div class="editor-grid">
              <mat-form-field appearance="outline">
                <mat-label>Menu title</mat-label>
                <input matInput formControlName="title" maxlength="120" required>
                @if (menuForm.controls.title.hasError('required')) {
                  <mat-error>Title is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Route URL</mat-label>
                <input matInput formControlName="routeUrl" maxlength="300" placeholder="/students">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Icon name</mat-label>
                <input matInput formControlName="icon" maxlength="60" placeholder="school">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Parent menu</mat-label>
                <mat-select formControlName="parentId">
                  <mat-option [value]="null">Top-level menu</mat-option>
                  @for (option of availableParentOptions; track option.id) {
                    <mat-option [value]="option.id">
                      {{ option.title }} · {{ option.module }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Module</mat-label>
                <input matInput formControlName="module" maxlength="80" required>
                @if (menuForm.controls.module.hasError('required')) {
                  <mat-error>Module is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sort order</mat-label>
                <input matInput type="number" formControlName="sortOrder" min="0" max="100000" required>
                @if (menuForm.controls.sortOrder.hasError('min') || menuForm.controls.sortOrder.hasError('max')) {
                  <mat-error>Enter a value between 0 and 100000.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="editor-footer">
              <mat-form-field appearance="outline" class="status-field">
                <mat-label>Status</mat-label>
                <mat-select formControlName="isActive">
                  <mat-option [value]="true">Active</mat-option>
                  <mat-option [value]="false">Inactive</mat-option>
                </mat-select>
              </mat-form-field>
              <div class="editor-actions">
                <button type="button" matButton="outlined" (click)="closeForm()">Cancel</button>
                <button type="submit" matButton="filled" color="primary" [disabled]="menuForm.invalid || saving">
                  <mat-icon>{{ saving ? 'hourglass_top' : 'save' }}</mat-icon>
                  {{ saving ? 'Saving…' : editingItem ? 'Save changes' : 'Create menu' }}
                </button>
              </div>
            </div>
          </form>
        </mat-card>
      }

      <mat-card class="grid-card">
        <form class="filter-form" [formGroup]="filterForm">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search menus</mat-label>
            <input matInput formControlName="searchTerm" placeholder="Title, route, icon or module">
            @if (filterForm.controls.searchTerm.value) {
              <button type="button" matSuffix mat-icon-button aria-label="Clear search" (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Module</mat-label>
            <mat-select formControlName="module">
              <mat-option value="">All modules</mat-option>
              @for (module of modules; track module) {
                <mat-option [value]="module">{{ module }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="">All statuses</mat-option>
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Parent menu</mat-label>
            <mat-select formControlName="parentId">
              <mat-option value="">All parents</mat-option>
              <mat-option [value]="rootParentFilter">Top-level menus</mat-option>
              @for (option of options; track option.id) {
                <mat-option [value]="option.id">{{ option.title }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>

        <div class="table-responsive">
          <table mat-table [dataSource]="items" matSort [matSortActive]="sortBy"
            [matSortDirection]="sortDescending ? 'desc' : 'asc'"
            (matSortChange)="onSortChange($event)">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="title">Menu hierarchy</th>
              <td mat-cell *matCellDef="let item">
                <div class="title-cell" [style.padding-left.px]="item.level * 22">
                  <mat-icon class="tree-icon">{{ hasChildren(item.id) ? 'folder_open' : item.parentId ? 'subdirectory_arrow_right' : 'folder' }}</mat-icon>
                  <span>{{ item.title }}</span>
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="routeUrl">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="routeUrl">Route</th>
              <td mat-cell *matCellDef="let item"><code>{{ item.routeUrl || '—' }}</code></td>
            </ng-container>
            <ng-container matColumnDef="parent">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="parent">Parent</th>
              <td mat-cell *matCellDef="let item">{{ item.parentTitle || 'Top-level' }}</td>
            </ng-container>
            <ng-container matColumnDef="module">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="module">Module</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip>{{ item.module }}</mat-chip>
              </td>
            </ng-container>
            <ng-container matColumnDef="sortOrder">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="sortOrder">Order</th>
              <td mat-cell *matCellDef="let item">{{ item.sortOrder }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="isActive">Status</th>
              <td mat-cell *matCellDef="let item">
                <span class="status-pill" [class.inactive]="!item.isActive">
                  {{ item.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="scope">
              <th mat-header-cell *matHeaderCellDef>Scope</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip>{{ item.tenantId ? (item.branchId ? 'Branch' : 'Tenant') : 'System' }}</mat-chip>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions" stickyEnd>
              <th mat-header-cell *matHeaderCellDef class="actions-heading">
                <div class="row-actions">
                  <button type="button" mat-icon-button aria-label="Actions" matTooltip="Actions" disabled>
                    <mat-icon>more_vert</mat-icon>
                  </button>
                </div>
              </th>
              <td mat-cell *matCellDef="let item" class="actions-cell">
                <div class="row-actions">
                  <button type="button" mat-icon-button aria-label="Menu item actions"
                    matTooltip="Actions" [matMenuTriggerFor]="menuActions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menuActions="matMenu">
                    <button type="button" mat-menu-item [disabled]="!item.canEdit" (click)="openEditForm(item)">
                      <mat-icon>edit</mat-icon>
                      <span>Edit</span>
                    </button>
                  @if (item.isActive) {
                    <button type="button" mat-menu-item
                      [disabled]="!item.canDelete || hasActiveChildren(item.id)" (click)="deactivateMenuItem(item)">
                      <mat-icon color="warn">block</mat-icon>
                      <span>Delete</span>
                    </button>
                  } @else {
                    <button type="button" mat-menu-item [disabled]="!item.canEdit" (click)="setMenuItemActive(item, true)">
                      <mat-icon color="primary">restore</mat-icon>
                      <span>Reactivate</span>
                    </button>
                  }
                  </mat-menu>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            <tr *matNoDataRow>
              <td class="empty-cell" [attr.colspan]="displayedColumns.length">
                @if (!loading) { No menu items match these filters. }
              </td>
            </tr>
            </table>
        </div>
        @if (loadError) {
          <div class="load-error" role="alert">
            <span>{{ loadError }}</span>
            <button type="button" mat-button (click)="loadItems()">Retry</button>
          </div>
        }
        <mat-paginator [length]="totalCount" [pageIndex]="pageIndex" [pageSize]="pageSize"
            [pageSizeOptions]="[5, 10, 20, 50, 100]" (page)="onPageChange($event)" showFirstLastButtons>
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      padding: 0 0 40px;
      box-sizing: border-box;
    }
    .page-header, .editor-heading, .editor-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .page-header .page-title {
      margin: 0;
      color: #1e3a8a;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .page-subtitle, .editor-heading p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 0.88rem;
    }
    .editor-card, .grid-card { overflow: hidden; }
    .editor-card { padding: 18px; }
    .editor-heading { margin-bottom: 16px; }
    .editor-heading h2 { margin: 0; color: #1e3a8a; font-size: 1.1rem; }
    .editor-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .editor-grid mat-form-field, .filter-form mat-form-field { width: 100%; min-width: 0; }
    .editor-footer { align-items: flex-start; }
    .status-field { width: 180px; }
    .editor-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .filter-form {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(150px, 1fr));
      align-items: center;
      gap: 12px;
      padding: 16px 16px 0;
    }
    .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .load-error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px;
      color: #b91c1c;
    }
    table { width: 100%; min-width: 900px; }
    th { color: #334155; font-weight: 700; white-space: nowrap; }
    td { white-space: nowrap; }
    .title-cell { display: flex; align-items: center; gap: 8px; min-height: 48px; }
    .tree-icon { width: 18px; height: 18px; color: #2563eb; font-size: 18px; }
    code { color: #334155; font-family: inherit; }
    .status-pill {
      display: inline-flex;
      padding: 4px 10px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .status-pill.inactive { background: #f1f5f9; color: #64748b; }
    .row-actions { display: flex; align-items: center; justify-content: center; }
    .actions-heading, .actions-cell { justify-content: center; background: #fff; }
    .empty-cell { padding: 32px; color: #64748b; text-align: center; }
    @media (max-width: 900px) {
      .filter-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .search-field { grid-column: 1 / -1; }
      .editor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .page-header, .editor-footer { align-items: stretch; flex-direction: column; }
      .page-header > button { width: 100%; }
      .filter-form, .editor-grid { grid-template-columns: 1fr; }
      .search-field { grid-column: auto; }
      .status-field { width: 100%; }
      .editor-actions { width: 100%; flex-direction: column-reverse; }
      .editor-actions button { width: 100%; }
    }
  `]
})
export class MenuManagementComponent implements OnInit, OnDestroy {
  private readonly menuService = inject(MenuService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly subscriptions = new Subscription();

  readonly displayedColumns = ['title', 'routeUrl', 'parent', 'module', 'scope', 'sortOrder', 'status', 'actions'];
  readonly rootParentFilter = '00000000-0000-0000-0000-000000000000';
  readonly filterForm = new FormGroup({
    searchTerm: new FormControl('', { nonNullable: true }),
    module: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    parentId: new FormControl('', { nonNullable: true })
  });
  readonly menuForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    routeUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    icon: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
    parentId: new FormControl<string | null>(null),
    sortOrder: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(100000)] }),
    module: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    isActive: new FormControl(true, { nonNullable: true })
  });

  items: ManagedMenuItem[] = [];
  options: ManagedMenuOption[] = [];
  modules: string[] = [];
  totalCount = 0;
  pageNumber = 1;
  pageSize = 10;
  pageIndex = 0;
  sortBy = 'sortOrder';
  sortDescending = false;
  loading = false;
  loadError = '';
  saving = false;
  permissions: MenuManagementPermissions = { canCreate: false, canEdit: false, canDelete: false };
  showForm = false;
  editingItem?: ManagedMenuItem;
  private loadRequest?: Subscription;

  ngOnInit(): void {
    this.loadManagementPermissions();
    this.loadOptions();
    this.loadItems();
    this.subscriptions.add(this.filterForm.valueChanges.pipe(
      debounceTime(250),
      distinctUntilChanged((previous, current) => JSON.stringify(previous) === JSON.stringify(current))
    ).subscribe(() => {
      this.pageIndex = 0;
      this.loadItems();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.loadRequest?.unsubscribe();
  }

  get availableParentOptions(): ManagedMenuOption[] {
    const excluded = new Set<string>();
    if (this.editingItem) {
      excluded.add(this.editingItem.id);
      let found = true;
      while (found) {
        found = false;
        for (const option of this.options) {
          if (option.parentId && excluded.has(option.parentId) && !excluded.has(option.id)) {
            excluded.add(option.id);
            found = true;
          }
        }
      }
    }
    return this.options.filter(option => option.isActive && !excluded.has(option.id));
  }

  loadManagementPermissions(): void {
    this.subscriptions.add(this.menuService.getMenuManagementPermissions().subscribe({
      next: permissions => this.permissions = permissions,
      error: error => {
        console.error('Failed to load menu management permissions.', error);
        this.confirmDialog.alert('Permissions unavailable', error?.error?.message || 'Could not load menu management permissions.', 'danger');
      }
    }));
  }

  loadOptions(): void {
    this.subscriptions.add(this.menuService.getMenuOptions().subscribe({
      next: options => {
        this.options = options;
        this.modules = [...new Set(options.map(option => option.module).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right));
      },
      error: error => {
        console.error('Failed to load menu hierarchy options.', error);
        this.confirmDialog.alert('Menu options unavailable', error?.error?.message || 'Could not load menu hierarchy options.', 'danger');
      }
    }));
  }

  loadItems(): void {
    this.loadRequest?.unsubscribe();
    this.loading = true;
    this.loadError = '';
    const filters = this.filterForm.getRawValue();
    this.loadRequest = this.menuService.getManagedMenuItems({
      pageNumber: this.pageIndex + 1,
      pageSize: this.pageSize,
      searchTerm: filters.searchTerm.trim(),
      module: filters.module,
      status: filters.status,
      parentId: filters.parentId === this.rootParentFilter ? this.rootParentFilter : filters.parentId,
      sortBy: this.sortBy,
      sortDescending: this.sortDescending
    }).subscribe({
      next: result => {
        this.items = result.items;
        this.totalCount = result.totalCount;
        this.pageNumber = result.pageNumber;
        this.pageSize = result.pageSize;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.items = [];
        this.totalCount = 0;
        this.loadError = error?.status === 403
          ? 'Your role does not have permission to view menu items.'
          : error?.error?.message || 'Could not load menu items. Please retry.';
        this.loading = false;
        this.changeDetector.detectChanges();
        console.error('Failed to load menu items.', error);
        this.confirmDialog.alert('Menu loading failed', this.loadError, 'danger');
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadItems();
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'sortOrder';
    this.sortDescending = sort.direction === 'desc';
    this.pageIndex = 0;
    this.loadItems();
  }

  clearSearch(): void {
    this.filterForm.controls.searchTerm.setValue('');
  }

  openCreateForm(): void {
    this.editingItem = undefined;
    this.menuForm.reset({
      title: '',
      routeUrl: '',
      icon: '',
      parentId: null,
      sortOrder: 0,
      module: '',
      isActive: true
    });
    this.showForm = true;
  }

  openEditForm(item: ManagedMenuItem): void {
    this.subscriptions.add(this.menuService.getManagedMenuItem(item.id).subscribe({
      next: managedItem => {
        this.editingItem = managedItem;
        this.menuForm.reset({
          title: managedItem.title,
          routeUrl: managedItem.routeUrl || '',
          icon: managedItem.icon || '',
          parentId: managedItem.parentId || null,
          sortOrder: managedItem.sortOrder,
          module: managedItem.module,
          isActive: managedItem.isActive
        });
        this.showForm = true;
        requestAnimationFrame(() => {
          const mainContent = document.querySelector<HTMLElement>('.main-content');
          if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      },
      error: error => {
        console.error('Failed to load menu item for editing.', error);
        this.confirmDialog.alert(
          'Menu item unavailable',
          error?.error?.message || 'Could not load this menu item for editing.',
          'danger'
        );
      }
    }));
  }

  closeForm(): void {
    this.showForm = false;
    this.editingItem = undefined;
  }

  saveMenuItem(): void {
    if (this.menuForm.invalid || this.saving) {
      this.menuForm.markAllAsTouched();
      return;
    }
    const raw = this.menuForm.getRawValue();
    const request: SaveMenuItem = {
      title: raw.title.trim(),
      routeUrl: raw.routeUrl.trim() || null,
      icon: raw.icon.trim() || null,
      parentId: raw.parentId,
      sortOrder: raw.sortOrder,
      module: raw.module.trim(),
      isActive: raw.isActive
    };

    if (this.editingItem) {
      const item = this.editingItem;
      this.subscriptions.add(this.confirmDialog.confirm(
        'Update menu item',
        `Save the changes to "${item.title}"?`,
        'Update',
        'Cancel',
        'info'
      ).subscribe(confirmed => {
        if (confirmed) {
          this.persistMenuItem(this.menuService.updateMenuItem(item.id, request));
        }
      }));
      return;
    }

    this.persistMenuItem(this.menuService.createMenuItem(request));
  }

  private persistMenuItem(operation: ReturnType<MenuService['createMenuItem']>): void {
    this.saving = true;
    this.subscriptions.add(operation.subscribe({
      next: () => {
        this.saving = false;
        this.closeForm();
        this.loadOptions();
        this.loadItems();
        this.confirmDialog.alert('Menu saved', 'Menu item saved successfully.', 'success');
      },
      error: error => {
        this.saving = false;
        console.error('Failed to save menu item.', error);
        this.confirmDialog.alert('Menu save failed', error?.error?.message || 'Could not save this menu item.', 'danger');
      }
    }));
  }

  deactivateMenuItem(item: ManagedMenuItem): void {
    if (this.hasActiveChildren(item.id)) {
      return;
    }
    this.confirmDialog.confirm(
      'Delete menu item',
      `Delete "${item.title}"? It will be removed from navigation and can be restored later.`,
      'Delete',
      'Cancel',
      'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.subscriptions.add(this.menuService.deactivateMenuItem(item.id).subscribe({
        next: () => {
          this.loadOptions();
          this.loadItems();
          this.confirmDialog.alert('Menu deactivated', 'The menu item is now inactive.', 'success');
        },
        error: error => {
          console.error('Failed to deactivate menu item.', error);
          this.confirmDialog.alert('Menu deactivation failed', error?.error?.message || 'Could not deactivate this menu item.', 'danger');
        }
      }));
    });
  }

  setMenuItemActive(item: ManagedMenuItem, isActive: boolean): void {
    const request: SaveMenuItem = {
      title: item.title,
      routeUrl: item.routeUrl || null,
      icon: item.icon || null,
      parentId: item.parentId || null,
      sortOrder: item.sortOrder,
      module: item.module,
      isActive
    };
    this.subscriptions.add(this.confirmDialog.confirm(
      'Reactivate menu item',
      `Reactivate "${item.title}"? It will appear in navigation again.`,
      'Reactivate',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.subscriptions.add(this.menuService.updateMenuItem(item.id, request).subscribe({
        next: () => {
          this.loadOptions();
          this.loadItems();
          this.confirmDialog.alert('Menu reactivated', 'The menu item is active again.', 'success');
        },
        error: error => {
          console.error('Failed to reactivate menu item.', error);
          this.confirmDialog.alert('Menu reactivation failed', error?.error?.message || 'Could not reactivate this menu item.', 'danger');
        }
      }));
    }));
  }

  hasChildren(id: string): boolean {
    return this.options.some(option => option.parentId === id);
  }

  hasActiveChildren(id: string): boolean {
    return this.options.some(option => option.parentId === id && option.isActive);
  }
}
