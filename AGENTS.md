# IMSERP Project Rules & Guidelines

- **No Docker**: IMSERP must NEVER be containerized, moved to Docker, or run inside Docker containers.
- **Native / Local Environment**:
  - Backend must always run natively on the local Windows host via Visual Studio / `dotnet run` (Kestrel on local ports).
  - Frontend must always run natively via Angular CLI (`ng serve`).
  - Database runs locally on SQL Server.
