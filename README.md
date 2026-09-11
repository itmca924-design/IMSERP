# IMSERP - Coaching & Tuition Management Vertical Micro-SaaS

A complete **Vertical SaaS** platform for Coaching Institutes, Tuition Classes, and Training Academies built with **.NET Core Web API (Modular Monolith - Clean Architecture)** and **Angular Material (Responsive UI)**.

---

## 🚀 Key Modules & Capabilities

1. **Role-Based Authentication (RBAC)**:
   - **Director / Institute Admin**: Full administrative control over institute, batches, staff, fee structure, test series, and WhatsApp gateway.
   - **Faculty / Teacher**: View assigned batches, schedule tests, enter marks grid, calculate ranks.
   - **Accountant**: Invoice tracking, collect fees (Cash/UPI/Card), issue receipts.
   - **Parent / Student**: View fee ledger, download receipts, check exam performance report card.

2. **Fee Collection & Dues Management**:
   - Monthly and installment fee tracking.
   - 1-Click collection with auto-generated receipt number.
   - Direct WhatsApp payment receipts & overdue reminders dispatched to parents.

3. **Test Exams & Marks Tracking**:
   - Schedule tests for specific batches & subjects.
   - Fast grid-based marks entry with auto-calculated percentage and class ranks.
   - Auto-dispatch individual report cards to parents via WhatsApp.

4. **Parent WhatsApp Gateway Audit Log**:
   - Full history and delivery status of messages sent to parents.

---

## 📁 Directory Structure

```
C:\Projects\IMSERP
├── backend/
│   ├── IMSERP.Domain/          # Enums, Core Entities (Tenant, User, Batch, Student, FeeInvoice, Test, WhatsAppLog)
│   ├── IMSERP.Application/     # DTOs, Interfaces (IIMSERPDbContext, IWhatsAppService, ICurrentUserService)
│   ├── IMSERP.Infrastructure/  # EF Core DbContext, Multi-tenant Query Filter, Seed Data, WhatsApp Service
│   ├── IMSERP.API/             # Controllers (Auth, Students, Batches, Fees, Tests, Dashboard, WhatsApp)
│   └── IMSERP.sln
│
└── frontend/
    ├── src/app/
    │   ├── core/               # AuthService, CoachingService, AuthGuard, JwtInterceptor
    │   ├── layout/             # Responsive Angular Material Sidenav & Toolbar Layout
    │   ├── features/
    │   │   ├── login/          # Material Login Page with quick role-selection buttons
    │   │   ├── dashboard/      # Stat Cards & Overdue Fee Table
    │   │   ├── students/       # Student Directory & Batch Assignment Form
    │   │   ├── fees/           # Fee Invoices & Payment Collector Dialog
    │   │   ├── tests/          # Exams List & Marks Entry Grid with Rank Generator
    │   │   └── whatsapp/       # Parent WhatsApp Delivery Audit Logs
```

---

## 🔑 Quick Demo Login Credentials

| Role | Username | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Director / Admin** | `admin` | `admin123` | Full Access across all modules & settings |
| **Faculty / Teacher** | `teacher` | `teacher123` | Student View, Test Scheduling, Marks Entry & Rank |
| **Accountant** | `accountant` | `account123` | Fee Invoices, Collections, Receipts & Reminders |

---

## 🛠️ How to Run the Application

### 1. Run Backend (.NET Core Web API)
```powershell
cd C:\Projects\IMSERP\backend\IMSERP.API
dotnet run
```
* **API Endpoint**: `http://localhost:5000` (or `https://localhost:5001`)
* **Interactive API Documentation (Scalar/OpenAPI)**: `http://localhost:5000/scalar/v1`

### 2. Run Frontend (Angular Material)
```powershell
cd C:\Projects\IMSERP\frontend
npm install
npm start
```
* **Frontend App URL**: `http://localhost:4200`
