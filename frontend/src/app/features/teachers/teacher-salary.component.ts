import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, SalaryDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-teacher-salary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatDividerModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>account_balance_wallet</mat-icon> Salary Structure</h1>
      <p class="page-subtitle">Configure faculty compensation structure — basic, HRA, allowances, and deductions.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Please select a faculty member above to view and configure their salary structure.</p>
  </div>

  <div *ngIf="selectedTeacher">
    <div class="section-header">
      <h3>{{selectedTeacher.fullName}} — Salary Structure</h3>
      <button mat-stroked-button color="primary" (click)="toggleForm()">
        <mat-icon>{{salaryStructure ? 'edit' : 'add'}}</mat-icon>
        {{showForm ? 'Cancel' : (salaryStructure ? 'Update Structure' : 'Set Salary Structure')}}
      </button>
    </div>

    <!-- Salary Form -->
    <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
      <form [formGroup]="salaryForm" (ngSubmit)="saveSalary()">
        <div class="form-grid">
          <div class="form-section">
            <p class="section-label earnings-label">💰 Earnings</p>
            <mat-form-field appearance="outline">
              <mat-label>Basic Salary ₹</mat-label>
              <input matInput type="number" formControlName="basicSalary" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>HRA ₹</mat-label>
              <input matInput type="number" formControlName="hra" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Other Allowances ₹</mat-label>
              <input matInput type="number" formControlName="otherAllowances" min="0">
            </mat-form-field>
          </div>
          <div class="form-section">
            <p class="section-label deductions-label">📉 Deductions</p>
            <mat-form-field appearance="outline">
              <mat-label>PF Deduction ₹</mat-label>
              <input matInput type="number" formControlName="pfDeduction" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>TDS Deduction ₹</mat-label>
              <input matInput type="number" formControlName="tdsDeduction" min="0">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Other Deductions ₹</mat-label>
              <input matInput type="number" formControlName="otherDeductions" min="0">
            </mat-form-field>
          </div>
          <div class="form-section">
            <p class="section-label">📅 Effective Date</p>
            <mat-form-field appearance="outline">
              <mat-label>Effective From *</mat-label>
              <input matInput type="date" formControlName="effectiveFrom">
            </mat-form-field>
          </div>
        </div>
        <div class="form-actions">
          <button mat-button type="button" (click)="showForm = false">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="salaryForm.invalid">
            <mat-icon>save</mat-icon> Save Salary Structure
          </button>
        </div>
      </form>
    </mat-card>

    <!-- Salary Display -->
    <mat-card class="salary-card mat-elevation-z2" *ngIf="salaryStructure && !showForm">
      <div class="sal-row earnings"><span>Basic Salary</span><span>₹{{salaryStructure.basicSalary | number}}</span></div>
      <div class="sal-row earnings"><span>HRA</span><span>₹{{salaryStructure.hra | number}}</span></div>
      <div class="sal-row earnings"><span>Other Allowances</span><span>₹{{salaryStructure.otherAllowances | number}}</span></div>
      <div class="sal-row gross"><span>Gross Salary</span><span>₹{{salaryStructure.grossSalary | number}}</span></div>
      <mat-divider></mat-divider>
      <div class="sal-row deduction"><span>PF Deduction</span><span>-₹{{salaryStructure.pfDeduction | number}}</span></div>
      <div class="sal-row deduction"><span>TDS Deduction</span><span>-₹{{salaryStructure.tdsDeduction | number}}</span></div>
      <div class="sal-row deduction"><span>Other Deductions</span><span>-₹{{salaryStructure.otherDeductions | number}}</span></div>
      <div class="sal-row net"><span>Net Salary (Take Home)</span><span>₹{{salaryStructure.netSalary | number}}</span></div>
      <div class="eff-note">Effective from: {{salaryStructure.effectiveFrom | date:'dd MMMM yyyy'}}</div>
    </mat-card>

    <div class="empty-state" *ngIf="!salaryStructure && !loading && !showForm">
      <mat-icon>account_balance_wallet</mat-icon>
      <p>No salary structure configured yet. Click "Set Salary Structure" above to define.</p>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.5rem;width:1.5rem;height:1.5rem;} }
    .page-subtitle { color:#666; margin:4px 0 0; font-size:.9rem; }
    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;} p{margin:0;font-size:.95rem;} }
    .section-header { display:flex; justify-content:space-between; align-items:center;
      h3{margin:0;font-weight:700;font-size:1.05rem;} }
    .form-card { padding:24px; border-radius:12px; }
    .form-grid { display:flex; gap:24px; flex-wrap:wrap; }
    .form-section { display:flex; flex-direction:column; gap:0; flex:1; min-width:220px; }
    .section-label { font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748b; margin:0 0 4px; }
    .earnings-label { color:#2e7d32; }
    .deductions-label { color:#c62828; }
    .form-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:8px; }
    .salary-card { border-radius:12px; overflow:hidden; max-width:560px; padding:0; }
    .sal-row { display:flex; justify-content:space-between; padding:12px 20px; font-size:.9rem;
      &.earnings{background:#f8fafc; color:#334155;}
      &.gross{background:#e3f2fd; font-weight:700; color:#1565c0; font-size:1rem;}
      &.deduction{background:#fff8f8; color:#c62828;}
      &.net{background:#e8f5e9; font-weight:700; font-size:1.1rem; color:#2e7d32;} }
    .eff-note { text-align:right; padding:8px 20px; font-size:.75rem; color:#94a3b8; background:#f8fafc; }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px; color:#94a3b8; background:#f8fafc; border-radius:12px;
      mat-icon{font-size:40px;width:40px;height:40px;margin-bottom:8px;} p{margin:0;} }
  `]
})
export class TeacherSalaryComponent implements OnInit {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  salaryStructure: SalaryDto | null = null;
  loading = false; showForm = false;
  salaryForm!: FormGroup;

  constructor(private http: HttpClient, private route: ActivatedRoute, private fb: FormBuilder, private confirmDialog: ConfirmDialogService) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
    const today = new Date().toISOString().split('T')[0];
    this.salaryForm = this.fb.group({
      basicSalary: [null, [Validators.required, Validators.min(1)]],
      hra: [0],
      otherAllowances: [0],
      pfDeduction: [0],
      tdsDeduction: [0],
      otherDeductions: [0],
      effectiveFrom: [today, Validators.required]
    });
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.showForm = false;
    this.loadSalary();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) {
      if (this.salaryStructure) {
        this.salaryForm.patchValue({
          basicSalary: this.salaryStructure.basicSalary,
          hra: this.salaryStructure.hra,
          otherAllowances: this.salaryStructure.otherAllowances,
          pfDeduction: this.salaryStructure.pfDeduction,
          tdsDeduction: this.salaryStructure.tdsDeduction,
          otherDeductions: this.salaryStructure.otherDeductions,
          effectiveFrom: this.salaryStructure.effectiveFrom?.split('T')[0] || new Date().toISOString().split('T')[0]
        });
      } else {
        this.salaryForm.reset({
          basicSalary: null,
          hra: 0,
          otherAllowances: 0,
          pfDeduction: 0,
          tdsDeduction: 0,
          otherDeductions: 0,
          effectiveFrom: new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  loadSalary() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<SalaryDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`).subscribe({
      next: r => {
        this.salaryStructure = r;
        this.loading = false;
        if (r && this.showForm) {
          this.salaryForm.patchValue({
            basicSalary: r.basicSalary,
            hra: r.hra,
            otherAllowances: r.otherAllowances,
            pfDeduction: r.pfDeduction,
            tdsDeduction: r.tdsDeduction,
            otherDeductions: r.otherDeductions,
            effectiveFrom: r.effectiveFrom?.split('T')[0]
          });
        }
      },
      error: () => { this.salaryStructure = null; this.loading = false; }
    });
  }

  saveSalary() {
    if (!this.selectedTeacher || this.salaryForm.invalid) {
      this.salaryForm.markAllAsTouched();
      return;
    }
    const val = this.salaryForm.value;
    if (!val.basicSalary || val.basicSalary <= 0) {
      this.confirmDialog.alert('Invalid Salary', 'Basic salary must be greater than 0.', 'warning');
      return;
    }
    this.http.post<SalaryDto>(`${this.api}/teachers/${this.selectedTeacher.id}/salary`, val).subscribe({
      next: r => {
        this.salaryStructure = r;
        this.showForm = false;
        this.confirmDialog.alert('Salary Structure Saved', 'Faculty salary structure saved successfully!', 'success');
      },
      error: e => this.confirmDialog.alert('Error', e?.error?.message || 'Error saving salary structure.', 'danger')
    });
  }
}
