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
