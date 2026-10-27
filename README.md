# Cpi Attendance

Workforce attendance, HR administration, and employee self-service for CUTTING POINT INNOVATION CO., LTD.

> Status: Phase 1 foundation. No production deployment or database migration has been applied.

## Applications
- **HR Web:** browser-based HR administration for organizations.
- **Employee PWA:** browser-based employee check-in/out and self-service.
- **Attendance API:** tenant-isolated backend, designed for optional CpiPOS and external HR integrations.

## Data isolation
The selected Supabase project is **CpiPOS-Communications** (project ref `wznixoeezgyhtwurcswb`), not the CpiPOS-001 production database. Attendance data must live under a dedicated `attendance` PostgreSQL schema; do not modify existing Support/Communications tables.

## Security baseline
- No secrets, service-role keys, national-ID data or payroll data in Git.
- Employee IDs are identifiers, never sufficient authentication by themselves.
- Every tenant-owned query must enforce tenant membership and least privilege on the server.
- Sensitive payroll access is a separate permission from ordinary attendance.
- Database migrations must pass review and isolated tests before applying to a shared live project.

See [Phase 1 plan](docs/phase-1-foundation.md) once implementation is proposed.

## Note about repository visibility
The repository was observed to be public on 2026-10-27. Recommend changing it to private before substantial development.
