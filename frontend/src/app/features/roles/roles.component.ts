import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RolesService, RoleDto, RolePermissionDto, CreateRoleDto } from '../../core/services/roles.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService, TenantDto } from '../../core/services/tenant.service';
import { RoleEditDialogComponent } from './role-edit-dialog.component';

interface ModuleGroup {
  moduleName: string;
  items: { index: number; group: FormGroup }[];
}

interface ModuleHeaderState {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  indeterminate: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatDialogModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Role Management & Page Permissions</h1>
          <p class="page-subtitle">Configure user roles and granular hierarchical access rights per module and page.</p>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="roles-layout">
        <!-- Roles List Sidebar Card -->
        <mat-card class="roles-sidebar-card mat-elevation-z2">
          <div class="card-header">
            <h3 class="card-title">User Roles</h3>
            <button mat-mini-fab color="primary" (click)="openCreateRoleDialog()" title="Create New Role">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <!-- SuperAdmin Tenant Scope Selector -->
          <div *ngIf="isSuperAdmin && tenants.length > 0" class="tenant-scope-wrapper">
            <mat-form-field appearance="outline" class="tenant-scope-field" subscriptSizing="dynamic">
              <mat-label>Institute Scope</mat-label>
              <mat-select [value]="selectedTenantId" (selectionChange)="onTenantFilterChange($event.value)">
                <mat-option [value]="null">🏢 All / Platform Console Template</mat-option>
                <mat-option *ngFor="let t of tenants" [value]="t.id">
                  🏫 {{ t.name }} ({{ t.code }})
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="role-list">
            <div
              *ngFor="let role of roles"
              class="role-item"
              [class.active]="selectedRole?.id === role.id && !isNewRole"
              (click)="selectRole(role)"
            >
              <div class="role-info">
                <span class="role-name">{{ role.name }}</span>
                <span class="role-users">{{ role.userCount }} Assigned Users</span>
              </div>
              <div class="role-item-actions" (click)="$event.stopPropagation()">
                <button mat-icon-button (click)="openEditRoleDialog(role)" title="Edit Role Details" class="role-action-btn edit-act">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteRole(role)" title="Delete Role" class="role-action-btn del-act"
                  [disabled]="role.userCount > 0 || isSystemRole(role)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </mat-card>

        <!-- Role Configuration & Hierarchical Rights Matrix Card -->
        <mat-card class="matrix-card mat-elevation-z2" *ngIf="roleForm">
          <form [formGroup]="roleForm" (ngSubmit)="saveRole()">
            <div class="matrix-header">
              <div>
                <h2>{{ isNewRole ? 'Create New Role' : 'Hierarchical Permissions Matrix: ' + selectedRole?.name }}</h2>
                <p class="muted-text">Toggle permissions by module or individually for granular page actions.</p>
              </div>
              <div class="matrix-actions-group">
                <button mat-stroked-button type="button" (click)="openEditRoleDialog(selectedRole)" *ngIf="!isNewRole && selectedRole" class="hdr-btn">
                  <mat-icon>edit</mat-icon> <span>Edit Role</span>
                </button>
                <button mat-stroked-button color="warn" type="button" (click)="deleteRole(selectedRole)" *ngIf="!isNewRole && selectedRole"
                  [disabled]="(selectedRole.userCount || 0) > 0 || isSystemRole(selectedRole)" class="hdr-btn"
                  [title]="isSystemRole(selectedRole) ? 'System role cannot be deleted' : ((selectedRole.userCount || 0) > 0 ? 'Cannot delete role with assigned users' : 'Delete this role')">
                  <mat-icon>delete</mat-icon> <span>Delete Role</span>
                </button>
                <button mat-raised-button color="primary" type="submit" [disabled]="roleForm.invalid || saving">
                  <mat-spinner diameter="20" *ngIf="saving" class="btn-spinner"></mat-spinner>
                  <mat-icon *ngIf="!saving">save</mat-icon>
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Role Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Accountant / Faculty" />
                <mat-error *ngIf="roleForm.get('name')?.hasError('required')">Role name is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Role Description</mat-label>
                <input matInput formControlName="description" placeholder="Short summary of responsibilities" />
              </mat-form-field>
            </div>

            <!-- Smart Preset Quick Action Toolbar -->
            <div class="preset-toolbar">
              <span class="preset-label">Smart Access Presets:</span>
              <button mat-stroked-button color="primary" type="button" (click)="grantAll()">
                <mat-icon>bolt</mat-icon> Grant Full Access
              </button>
              <button mat-stroked-button type="button" (click)="grantReadOnly()">
                <mat-icon>visibility</mat-icon> Read-Only Access
              </button>
              <button mat-stroked-button color="warn" type="button" (click)="revokeAll()">
                <mat-icon>block</mat-icon> Revoke All
              </button>
            </div>

            <!-- Hierarchical Module & Page Matrix -->
            <div class="hierarchical-matrix-container">
              <div *ngFor="let mod of moduleGroups" class="module-block">
                <!-- Module Header Bar -->
                <div class="module-header">
                  <div class="module-title-box">
                    <mat-icon color="primary" class="mod-icon">category</mat-icon>
                    <span class="mod-title-text">{{ mod.moduleName }} Module</span>
                  </div>

                  <div class="module-master-toggles">
                    <span class="mod-toggle-label">Module Toggles:</span>
                    <mat-checkbox
                      color="primary"
                      [checked]="getHeaderState(mod.moduleName, 'canView')"
                      [indeterminate]="getHeaderIndeterminate(mod.moduleName, 'canView')"
                      (change)="toggleModuleAction(mod, 'canView', $event.checked)"
                      matTooltip="Toggle View for all pages in {{ mod.moduleName }}">
                      View All
                    </mat-checkbox>
                    <mat-checkbox
                      color="primary"
                      [checked]="getHeaderState(mod.moduleName, 'canCreate')"
                      [indeterminate]="getHeaderIndeterminate(mod.moduleName, 'canCreate')"
                      (change)="toggleModuleAction(mod, 'canCreate', $event.checked)"
                      matTooltip="Toggle Create for all pages in {{ mod.moduleName }}">
                      Create All
                    </mat-checkbox>
                    <mat-checkbox
                      color="primary"
                      [checked]="getHeaderState(mod.moduleName, 'canEdit')"
                      [indeterminate]="getHeaderIndeterminate(mod.moduleName, 'canEdit')"
                      (change)="toggleModuleAction(mod, 'canEdit', $event.checked)"
                      matTooltip="Toggle Edit for all pages in {{ mod.moduleName }}">
                      Edit All
                    </mat-checkbox>
                    <mat-checkbox
                      color="warn"
                      [checked]="getHeaderState(mod.moduleName, 'canDelete')"
                      [indeterminate]="getHeaderIndeterminate(mod.moduleName, 'canDelete')"
                      (change)="toggleModuleAction(mod, 'canDelete', $event.checked)"
                      matTooltip="Toggle Delete for all pages in {{ mod.moduleName }}">
                      Delete All
                    </mat-checkbox>
                  </div>
                </div>

                <!-- Child Pages Table in Responsive Wrapper -->
                <div class="table-responsive-wrapper">
                  <table class="rights-table">
                    <thead>
                      <tr>
                        <th class="page-col">Page Title / Navigation Route</th>
                        <th class="text-center action-col">View / Access Page</th>
                        <th class="text-center action-col">Create Right</th>
                        <th class="text-center action-col">Edit Right</th>
                        <th class="text-center action-col">Delete Right</th>
                      </tr>
                    </thead>
                    <tbody formArrayName="permissions">
                      <tr *ngFor="let item of mod.items" [formGroupName]="item.index">
                        <td class="menu-title-cell" style="vertical-align: middle !important;">
                          <div class="menu-title-wrap" style="display: flex !important; flex-direction: row !important; align-items: center !important; gap: 12px !important;">
                            <mat-icon color="primary" class="menu-icon" style="font-size: 22px !important; width: 22px !important; height: 22px !important; line-height: 22px !important; margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important; align-self: center !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; vertical-align: middle !important;">{{ item.group.get('icon')?.value || 'web' }}</mat-icon>
                            <div class="menu-titles" style="display: flex !important; flex-direction: column !important; justify-content: center !important; align-self: center !important;">
                              <span class="item-title" style="font-size: 0.9rem !important; font-weight: 600 !important; color: #1e293b !important; line-height: 1.25 !important; margin: 0 !important; padding: 0 !important;">{{ item.group.get('menuTitle')?.value }}</span>
                              <span class="route-subtitle" style="font-size: 0.75rem !important; color: #94a3b8 !important; line-height: 1.2 !important; margin: 0 !important; margin-top: 2px !important; padding: 0 !important;">{{ item.group.get('routeUrl')?.value || 'Folder' }}</span>
                            </div>
                          </div>
                        </td>
                        <td class="text-center action-col">
                          <mat-checkbox formControlName="canView" color="primary"></mat-checkbox>
                        </td>
                        <td class="text-center action-col">
                          <mat-checkbox formControlName="canCreate" color="primary"></mat-checkbox>
                        </td>
                        <td class="text-center action-col">
                          <mat-checkbox formControlName="canEdit" color="primary"></mat-checkbox>
                        </td>
                        <td class="text-center action-col">
                          <mat-checkbox formControlName="canDelete" color="warn"></mat-checkbox>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </form>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    .page-header {
      .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #1976d2;
      }
      .page-subtitle {
        color: #666;
        margin: 4px 0 0 0;
        font-size: 0.9rem;
      }
      @media (max-width: 600px) {
        .page-title { font-size: 1.25rem; }
        .page-subtitle { font-size: 0.82rem; }
      }
    }
    .roles-layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      width: 100%;
      min-width: 0;

      @media (max-width: 960px) {
        flex-direction: column;
        gap: 16px;
      }
    }
    .roles-sidebar-card {
      width: 320px;
      flex-shrink: 0;
      border-radius: 8px;
      padding: 16px;
      box-sizing: border-box;

      @media (max-width: 960px) {
        width: 100%;
        padding: 14px;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        .card-title {
          margin: 0;
          font-weight: 700;
          font-size: 1.1rem;
        }
      }
      .tenant-scope-wrapper {
        margin-bottom: 14px;
        .tenant-scope-field {
          width: 100%;
        }
      }
    }
    .role-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      @media (max-width: 960px) {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 10px;
        max-height: 280px;
        overflow-y: auto;
        padding: 2px;
      }

      @media (max-width: 560px) {
        grid-template-columns: 1fr;
        max-height: 240px;
      }
    }
    .role-item {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      background: #ffffff;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      &:hover {
        background-color: #f8fafc;
        border-color: #cbd5e1;
      }
      &.active {
        border-color: #0284c7;
        background-color: #f0f9ff;
        box-shadow: 0 1px 3px rgba(2, 132, 199, 0.15);
        .role-name {
          color: #0284c7;
          font-weight: 700;
        }
      }
    }
    .role-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
      margin-right: 8px;
      .role-name {
        font-weight: 600;
        font-size: 0.92rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .role-users {
        font-size: 0.74rem;
        color: #64748b;
      }
    }
    .role-item-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      opacity: 0.85;
      transition: opacity 0.2s ease;
    }
    .role-item:hover .role-item-actions {
      opacity: 1;
    }
    .role-action-btn {
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      padding: 0 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      mat-icon {
        font-size: 17px !important;
        width: 17px !important;
        height: 17px !important;
        line-height: 17px !important;
      }
      &.edit-act {
        color: #0284c7;
        &:hover { background: #e0f2fe; }
      }
      &.del-act {
        color: #dc2626;
        &:hover { background: #fee2e2; }
      }
    }
    .matrix-card {
      flex: 1;
      min-width: 0;
      width: 100%;
      border-radius: 8px;
      padding: 24px;
      box-sizing: border-box;

      @media (max-width: 960px) {
        width: 100%;
        padding: 16px;
      }
      @media (max-width: 600px) {
        padding: 12px;
      }
    }
    .matrix-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 16px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        @media (max-width: 600px) {
          font-size: 1.1rem;
        }
      }
      .muted-text {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 0.82rem;
      }
    }
    .matrix-actions-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      @media (max-width: 768px) {
        width: 100%;
        button {
          flex: 1 1 calc(50% - 5px);
          min-width: 130px;
        }
      }
      @media (max-width: 480px) {
        button {
          flex: 1 1 100%;
          width: 100%;
          justify-content: center;
        }
      }
    }
    .hdr-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .form-row {
      display: flex;
      gap: 16px;
      @media (max-width: 640px) {
        flex-direction: column;
        gap: 0;
      }
    }
    .half-width {
      flex: 1;
      min-width: 0;
      width: 100%;
    }
    .preset-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      .preset-label {
        font-weight: 600;
        font-size: 0.85rem;
        color: #334155;
        margin-right: 6px;
      }

      @media (max-width: 768px) {
        gap: 8px;
        button {
          flex: 1 1 auto;
          font-size: 0.82rem;
        }
      }
      @media (max-width: 540px) {
        flex-direction: column;
        align-items: stretch;
        .preset-label {
          width: 100%;
          margin-bottom: 4px;
        }
        button {
          width: 100%;
          justify-content: center;
        }
      }
    }
    .hierarchical-matrix-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      min-width: 0;
    }
    .module-block {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      width: 100%;
      background: #ffffff;
    }
    .module-header {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }

      .module-title-box {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #0f172a;
        font-size: 0.95rem;

        .mod-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        .mod-title-text {
          font-weight: 700;
          color: #0f172a;
        }
      }
      .module-master-toggles {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .mod-toggle-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #475569;
        }

        @media (max-width: 640px) {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 14px;
          width: 100%;
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;

          .mod-toggle-label {
            grid-column: span 2;
            margin-bottom: 2px;
          }
        }
      }
    }
    .table-responsive-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .rights-table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      th, td {
        padding: 10px 16px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      th {
        background-color: #f8fafc;
        font-weight: 600;
        font-size: 0.82rem;
        color: #64748b;
      }
      tr:last-child td {
        border-bottom: none;
      }
    }
    .menu-title-cell {
      vertical-align: middle !important;
    }
    .menu-title-wrap {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .menu-icon {
      font-size: 22px !important;
      width: 22px !important;
      height: 22px !important;
      line-height: 22px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
      align-self: center !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
    }
    .menu-titles {
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-self: center !important;
      min-width: 0;
    }
    .item-title {
      font-size: 0.9rem !important;
      color: #1e293b !important;
      line-height: 1.25 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .route-subtitle {
      font-size: 0.75rem !important;
      color: #94a3b8 !important;
      line-height: 1.2 !important;
      margin: 0 !important;
      margin-top: 2px !important;
      padding: 0 !important;
    }
    .page-col {
      min-width: 260px;
    }
    .action-col {
      width: 110px;
      min-width: 90px;
      text-align: center;
    }
    .btn-spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `]
})
export class RolesComponent implements OnInit {
  roles: RoleDto[] = [];
  selectedRole?: RoleDto;
  roleForm!: FormGroup;
  moduleGroups: ModuleGroup[] = [];
  moduleHeaderStates = new Map<string, ModuleHeaderState>();

  loading = false;
  saving = false;
  isNewRole = false;

  tenants: TenantDto[] = [];
  selectedTenantId: string | null = null;

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  constructor(
    private fb: FormBuilder,
    private rolesService: RolesService,
    private confirmDialog: ConfirmDialogService,
    readonly authService: AuthService,
    private tenantService: TenantService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.isSuperAdmin) {
      this.tenantService.getAllTenants().subscribe({
        next: (list: TenantDto[]) => {
          this.tenants = list || [];
        }
      });
    }
    this.loadRoles();
  }

  loadRoles(tenantId?: string | null): void {
    this.loading = true;
    this.rolesService.getRoles(tenantId || undefined).subscribe({
      next: (data) => {
        this.roles = data;
        this.loading = false;
        if (data.length > 0) {
          this.selectRole(data[0]);
        } else {
          this.selectedRole = undefined;
          this.roleForm = undefined as any;
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching roles:', err);
      }
    });
  }

  onTenantFilterChange(tenantId: string | null): void {
    this.selectedTenantId = tenantId;
    this.selectedRole = undefined;
    this.loadRoles(tenantId);
  }

  selectRole(role: RoleDto): void {
    this.isNewRole = false;
    this.loading = true;
    this.rolesService.getRoleById(role.id).subscribe({
      next: (fullRole) => {
        this.selectedRole = fullRole;
        this.buildForm(fullRole);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  newRoleForm(): void {
    this.isNewRole = true;
    this.selectedRole = undefined;
    this.roleForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      description: [''],
      isActive: [true],
      permissions: this.fb.array([])
    });
    this.buildModuleGroups();
  }

  isSystemRole(role?: RoleDto): boolean {
    if (!role) return false;
    const sysNames = ['Institute Admin', 'Admin', 'Super Admin', 'SuperAdmin', 'Teacher / Faculty', 'Parent', 'Student'];
    return sysNames.some(s => s.toLowerCase() === (role.name || '').trim().toLowerCase());
  }

  openCreateRoleDialog(): void {
    const dialogRef = this.dialog.open(RoleEditDialogComponent, {
      width: '540px',
      maxWidth: '95vw',
      panelClass: 'no-overflow-dialog',
      data: {
        isNew: true
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      this.loading = true;
      const createPayload: CreateRoleDto = {
        name: result.name,
        description: result.description,
        isActive: result.isActive,
        tenantId: this.isSuperAdmin && this.selectedTenantId ? this.selectedTenantId : undefined
      };
      this.rolesService.createRole(createPayload).subscribe({
        next: (created) => {
          this.loading = false;
          this.confirmDialog.alert(
            'Role Created Successfully',
            `Role "${created.name}" has been created. You can now configure permissions in the matrix.`,
            'success'
          );
          this.loadRoles(this.selectedTenantId);
          this.selectRole(created);
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert(
            'Create Failed',
            err?.error?.message || 'Failed to create role.',
            'danger'
          );
        }
      });
    });
  }

  openEditRoleDialog(role?: RoleDto): void {
    const target = role || this.selectedRole;
    if (!target) return;

    const dialogRef = this.dialog.open(RoleEditDialogComponent, {
      width: '540px',
      maxWidth: '95vw',
      panelClass: 'no-overflow-dialog',
      data: {
        isNew: false,
        role: target
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      this.loading = true;
      this.rolesService.getRoleById(target.id).subscribe({
        next: (fullRole) => {
          const updatePayload: CreateRoleDto = {
            name: result.name,
            description: result.description,
            isActive: result.isActive,
            permissions: fullRole.permissions
          };
          this.rolesService.updateRole(target.id, updatePayload).subscribe({
            next: (updated) => {
              this.loading = false;
              this.confirmDialog.alert(
                'Role Updated Successfully',
                `Role "${result.name}" details have been updated.`,
                'success'
              );
              this.loadRoles(this.selectedTenantId);
            },
            error: (err) => {
              this.loading = false;
              this.confirmDialog.alert(
                'Update Failed',
                err?.error?.message || 'Failed to update role.',
                'danger'
              );
            }
          });
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert('Error', 'Failed to retrieve role details before update.', 'danger');
        }
      });
    });
  }

  deleteRole(role?: RoleDto): void {
    const target = role || this.selectedRole;
    if (!target) return;

    if (this.isSystemRole(target)) {
      this.confirmDialog.alert(
        'Action Prohibited',
        `The role "${target.name}" is a core system role and cannot be deleted.`,
        'warning'
      );
      return;
    }

    if ((target.userCount || 0) > 0) {
      this.confirmDialog.alert(
        'Role Cannot Be Deleted',
        `Role "${target.name}" currently has ${target.userCount} active assigned user(s). Reassign or remove these users first before deleting the role.`,
        'warning'
      );
      return;
    }

    this.confirmDialog.danger(
      'Delete Role Confirmation',
      `Are you sure you want to permanently delete role "${target.name}"? All associated page permission mappings for this role will also be removed. This action cannot be undone.`
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.loading = true;
      this.rolesService.deleteRole(target.id).subscribe({
        next: () => {
          this.loading = false;
          this.confirmDialog.alert(
            'Role Deleted',
            `Role "${target.name}" has been deleted successfully.`,
            'success'
          );
          this.loadRoles(this.selectedTenantId);
        },
        error: (err) => {
          this.loading = false;
          this.confirmDialog.alert(
            'Failed to Delete Role',
            err?.error?.message || 'Error occurred while deleting role.',
            'danger'
          );
        }
      });
    });
  }

  buildForm(role: RoleDto): void {
    this.roleForm = this.fb.group({
      id: [role.id],
      name: [role.name, Validators.required],
      description: [role.description || ''],
      isActive: [role.isActive],
      permissions: this.fb.array(
        (role.permissions || []).map(p => this.fb.group({
          menuItemId: [p.menuItemId],
          menuTitle: [p.menuTitle],
          routeUrl: [p.routeUrl],
          icon: [p.icon],
          module: [p.module],
          canView: [p.canView],
          canCreate: [p.canCreate],
          canEdit: [p.canEdit],
          canDelete: [p.canDelete]
        }))
      )
    });
    this.buildModuleGroups();
  }

  get permissionsArray(): FormArray {
    return this.roleForm.get('permissions') as FormArray;
  }

  buildModuleGroups(): void {
    const groupsMap = new Map<string, { index: number; group: FormGroup }[]>();
    this.permissionsArray.controls.forEach((ctrl, index) => {
      const group = ctrl as FormGroup;
      const modName = group.get('module')?.value || 'General';
      if (!groupsMap.has(modName)) {
        groupsMap.set(modName, []);
      }
      groupsMap.get(modName)!.push({ index, group });
    });

    this.moduleGroups = Array.from(groupsMap.entries()).map(([moduleName, items]) => ({
      moduleName,
      items
    }));

    this.updateModuleHeaderStates();

    // Subscribe to form value changes to keep header states in sync
    this.permissionsArray.valueChanges.subscribe(() => {
      this.updateModuleHeaderStates();
    });
  }

  updateModuleHeaderStates(): void {
    const fields: Array<'canView' | 'canCreate' | 'canEdit' | 'canDelete'> = ['canView', 'canCreate', 'canEdit', 'canDelete'];
    this.moduleGroups.forEach(mod => {
      const state: ModuleHeaderState = {
        canView: false, canCreate: false, canEdit: false, canDelete: false,
        indeterminate: { canView: false, canCreate: false, canEdit: false, canDelete: false }
      };
      if (mod.items.length > 0) {
        fields.forEach(field => {
          const checkedCount = mod.items.filter(item => item.group.get(field)?.value === true).length;
          state[field] = checkedCount === mod.items.length;
          state.indeterminate[field] = checkedCount > 0 && checkedCount < mod.items.length;
        });
      }
      this.moduleHeaderStates.set(mod.moduleName, state);
    });
  }

  getHeaderState(moduleName: string, field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete'): boolean {
    return this.moduleHeaderStates.get(moduleName)?.[field] ?? false;
  }

  getHeaderIndeterminate(moduleName: string, field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete'): boolean {
    return this.moduleHeaderStates.get(moduleName)?.indeterminate[field] ?? false;
  }

  isModuleActionChecked(mod: ModuleGroup, field: string): boolean {
    if (mod.items.length === 0) return false;
    return mod.items.every(item => item.group.get(field)?.value === true);
  }

  toggleModuleAction(mod: ModuleGroup, field: string, checked: boolean): void {
    mod.items.forEach(item => {
      item.group.get(field)?.setValue(checked);
      item.group.get(field)?.markAsDirty();
    });
  }

  grantAll(): void {
    this.permissionsArray.controls.forEach(ctrl => {
      ctrl.get('canView')?.setValue(true);
      ctrl.get('canCreate')?.setValue(true);
      ctrl.get('canEdit')?.setValue(true);
      ctrl.get('canDelete')?.setValue(true);
    });
  }

  grantReadOnly(): void {
    this.permissionsArray.controls.forEach(ctrl => {
      ctrl.get('canView')?.setValue(true);
      ctrl.get('canCreate')?.setValue(false);
      ctrl.get('canEdit')?.setValue(false);
      ctrl.get('canDelete')?.setValue(false);
    });
  }

  revokeAll(): void {
    this.permissionsArray.controls.forEach(ctrl => {
      ctrl.get('canView')?.setValue(false);
      ctrl.get('canCreate')?.setValue(false);
      ctrl.get('canEdit')?.setValue(false);
      ctrl.get('canDelete')?.setValue(false);
    });
  }

  saveRole(): void {
    if (this.roleForm.invalid) return;

    this.saving = true;
    const formVal = this.roleForm.value;
    const roleName = formVal.name?.trim() || 'Role';

    if (this.isNewRole) {
      const payload = {
        ...formVal,
        tenantId: this.isSuperAdmin && this.selectedTenantId ? this.selectedTenantId : undefined
      };
      this.rolesService.createRole(payload).subscribe({
        next: (created) => {
          this.saving = false;
          this.loadRoles(this.selectedTenantId);
          this.selectRole(created);
          this.confirmDialog.alert(
            'Role Created Successfully!',
            `The new role "${roleName}" and its granular page permissions have been created.`,
            'success'
          );
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert(
            'Failed to Create Role',
            err?.error?.message || 'Error creating role.',
            'danger'
          );
        }
      });
    } else {
      this.rolesService.updateRole(formVal.id, formVal).subscribe({
        next: () => {
          this.saving = false;
          this.loadRoles(this.selectedTenantId);
          this.confirmDialog.alert(
            'Permissions Saved Successfully!',
            `Hierarchical permissions and settings for role "${roleName}" have been saved successfully.`,
            'success'
          );
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert(
            'Failed to Save Permissions',
            err?.error?.message || 'Error updating role permissions.',
            'danger'
          );
        }
      });
    }
  }
}
