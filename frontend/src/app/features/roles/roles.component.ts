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
import { RolesService, RoleDto, RolePermissionDto } from '../../core/services/roles.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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
    MatTooltipModule
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
            <button mat-mini-fab color="primary" (click)="newRoleForm()" title="Create New Role">
              <mat-icon>add</mat-icon>
            </button>
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
              <mat-icon class="arrow-icon">chevron_right</mat-icon>
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
              <button mat-raised-button color="primary" type="submit" [disabled]="roleForm.invalid || saving">
                <mat-spinner diameter="20" *ngIf="saving" class="btn-spinner"></mat-spinner>
                <mat-icon *ngIf="!saving">save</mat-icon>
                <span>Save Permissions</span>
              </button>
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
                    <strong>{{ mod.moduleName }} Module</strong>
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

                <!-- Child Pages Table -->
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
                            <strong class="item-title" style="font-size: 0.9rem !important; color: #1e293b !important; line-height: 1.25 !important; margin: 0 !important; padding: 0 !important;">{{ item.group.get('menuTitle')?.value }}</strong>
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
    }
    .roles-layout {
      display: flex;
      gap: 24px;

      @media (max-width: 960px) {
        flex-direction: column;
      }
    }
    .roles-sidebar-card {
      width: 300px;
      flex-shrink: 0;
      border-radius: 8px;
      padding: 16px;

      @media (max-width: 960px) {
        width: 100%;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        .card-title {
          margin: 0;
          font-weight: 700;
        }
      }
    }
    .role-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .role-item {
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      &:hover {
        background-color: #f8fafc;
      }
      &.active {
        border-color: #1976d2;
        background-color: #e0f2fe;
        .role-name {
          color: #0284c7;
          font-weight: 700;
        }
      }
    }
    .role-info {
      display: flex;
      flex-direction: column;
      .role-name {
        font-weight: 600;
        font-size: 0.95rem;
      }
      .role-users {
        font-size: 0.75rem;
        color: #64748b;
      }
    }
    .matrix-card {
      flex: 1;
      border-radius: 8px;
      padding: 24px;
    }
    .matrix-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
      }
      .muted-text {
        margin: 4px 0 0 0;
        color: #64748b;
        font-size: 0.85rem;
      }
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .half-width {
      flex: 1;
    }
    .preset-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f1f5f9;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      .preset-label {
        font-weight: 600;
        font-size: 0.85rem;
        color: #334155;
        margin-right: 8px;
      }
    }
    .hierarchical-matrix-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .module-block {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .module-header {
      background: #e2e8f0;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

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
      }
      .module-master-toggles {
        display: flex;
        align-items: center;
        gap: 16px;

        .mod-toggle-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #475569;
        }
      }
    }
    .rights-table {
      width: 100%;
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
      width: 340px;
    }
    .action-col {
      width: 130px;
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

  constructor(
    private fb: FormBuilder,
    private rolesService: RolesService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.rolesService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        this.loading = false;
        if (data.length > 0 && !this.selectedRole) {
          this.selectRole(data[0]);
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching roles:', err);
      }
    });
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
      this.rolesService.createRole(formVal).subscribe({
        next: (created) => {
          this.saving = false;
          this.loadRoles();
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
          this.loadRoles();
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
