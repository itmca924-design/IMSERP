# IMSERP Project Rules & Guidelines

- **No Docker**: IMSERP must NEVER be containerized, moved to Docker, or run inside Docker containers.
- **Native / Local Environment**:
  - Backend must always run natively on the local Windows host via Visual Studio / `dotnet run` (Kestrel on local ports).
  - Frontend must always run natively via Angular CLI (`ng serve`).
  - Database runs locally on SQL Server.
- **Dialog & Popup Header Styling (Strict UI Rule)**:
  - NEVER use black, dark slate, or dark backgrounds for any popup / dialog header.
  - ALL popups and dialogs across the entire ERP must use the consistent light blue gradient header styling matching `generate-invoices-dialog`:
    - Header background: `background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);`
    - Header bottom border: `border-bottom: 1px solid #bfdbfe;`
    - Header icon box: `background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);`
    - Main Title: `color: #1e3a8a; font-weight: 700;`
    - Subtitle / Meta details: `color: #3b82f6;` (with `strong` tags in `#1e40af` or `#0f172a`)
    - Close button: `color: #64748b;` (hover `#1e293b`)
- **DateTime Display (Strict Timezone Rule)**:
  - ALWAYS display timestamps and datetimes in **Indian Standard Time (IST - Asia/Kolkata)**.
  - Never display raw UTC strings or rely on raw browser default date pipes without timezone.
  - Use the shared `[appIstDatetime]` directive (`src/app/shared/directives/ist-datetime.directive.ts`) or `localDatetime` pipe across the entire application for all date/time rendering.
- **Standard Page Width & Layout Rule (Strict UI Rule)**:
  - NEVER put custom padding (e.g., `padding: 24px; min-height: 100vh;`) on `:host` or artificial `max-width` constraints (e.g., `max-width: 1440px; margin: 0 auto;`) inside page components.
  - The outer `LayoutComponent` (`.main-content`) already manages layout padding (`padding: 24px`) and scrolling.
  - ALL page components across the ERP MUST use the uniform, standard full-width page layout matching `Profit & Loss`:
    ```scss
    :host {
      display: block;
      width: 100%;
    }
    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    ```
  - Controls, filters, decks, and tables must consistently use pure Angular Material styling (`mat-card`, `mat-form-field`, `mat-select`, `mat-button`, `mat-chip`, `mat-icon`) for a smooth, high-precision ERP experience.
- **Angular Material Reactive Forms Rule (Strict Frontend Rule)**:
  - NEVER use template-driven forms (`FormsModule`, `[(ngModel)]`) for filters, controls, search inputs, dialogs, or forms.
  - ALWAYS use **Angular Material Reactive Forms (`ReactiveFormsModule`, `FormGroup`, `FormControl`, `FormBuilder`)**:
    - Build filter decks and forms with `FormGroup` and typed `FormControl`s (`date`, `branchId`, `academicScope`, `voucherType`, `paymentMode`, `searchTerm`).
    - Bind templates via `[formGroup]="filterForm"` and `formControlName="..."`.
    - Handle reactive state updates cleanly via `valueChanges` or reactive handlers, ensuring clean architecture, testability, and enterprise-grade performance.
- **Strict Multi-Tenant & Multi-Branch Architecture (Core ERP Rule)**:
  - EVERYTHING across the entire ERP (Finance, Day Book, P&L, Balance Sheet, Fees, Admissions, Students, Faculty, Payroll, Attendance, Exams, Library, Hostel, Transport, Reports) MUST operate with dual-tier isolation:
    1. **Tenant Isolation**: Every database entity, query, insert, and update is strictly partitioned by `TenantId` (`_currentUser.TenantId`). Data from one tenant must NEVER be visible or accessible to another.
    2. **Branch-Wise Partitioning**:
       - ALWAYS include `BranchId` (`public Guid? BranchId { get; set; }` with `[ForeignKey("BranchId")] public Branch? Branch { get; set; }`) in every new database table / entity created. In SQL scripts, always define `[BranchId] UNIQUEIDENTIFIER NULL`.
       - Every frontend module, list, transaction screen, and report MUST support branch-wise operation: auto-syncing with the globally active branch (`authService.selectedBranchId()`), providing branch filters (individual branch vs. 'All Campuses Consolidated'), and passing `branchId` to backend APIs.
       - Backend API endpoints must strictly filter by `BranchId` when a branch context is active or requested.
- **Zero Hardcoding & Dynamic Context (Strict Rule)**:
  - NEVER hardcode tenant names, institute names, campus names (e.g., 'Jnandeep Campus', 'Apex', etc.), academic years, financial years (e.g., '2026-2027'), dates, URLs, or IDs anywhere in frontend or backend code.
  - ALWAYS fetch tenant / institute details dynamically via `AuthService` (`authService.getInstituteName()`, `currentUser()?.instituteName`, etc.) or backend tenant context (`_currentUser.TenantId`).
  - ALL menu items, navigation links, and feature access permissions MUST be dynamically driven by the database `MenuItems` and `RolePermissions` architecture, never hardcoded in templates or client logic.
- **No Snackbar Rule / Pure Angular Material Popup Standard (Strict UI Rule)**:
  - NEVER use `MatSnackBar`, toasts, or floating snackbar banners anywhere in the application.
  - ALWAYS use **Angular Material Dialogs / Popups (`ConfirmDialogService.alert()`, `ConfirmDialogService.confirm()`, or `MatDialog`)** for displaying all user messages, success feedback, error alerts, informational notices, and confirmations.
  - All popups must strictly maintain the standard light-blue gradient header styling.
- **Responsive UI Across All Devices (Strict UI Standard)**:
  - Every page, module, control deck, filter bar, KPI deck, table, dialog, and report MUST be 100% fully responsive across **Mobile (< 640px), Tablet (640px - 1024px), and Desktop (> 1024px)**.
  - Decks and filters must flex-wrap or switch to column layout on smaller screens with full-width search and control units.
  - Tables must always be wrapped in `.table-responsive` (`overflow-x: auto; -webkit-overflow-scrolling: touch;`) with explicit column min-widths (`white-space: nowrap`) to avoid content squishing or clipping.
  - KPI grids must automatically adapt from 4 columns on large screens to 2 columns on tablets, and 1 column on mobile phones.



