# Cpi Attendance — Vercel static import instructions

**Repository:** `sstdevelopaminno/Cpi-Attendance`

This main-branch subset contains ONLY the browser HTML/CSS/JS for two unfinished websites, not the Attendance API or the PostgreSQL migrations. It is suitable for a static UX preview. Neither site can log in or submit real employee records until the security-gated backend is deployed; `config.js` intentionally has an empty API URL.

## HR Vercel project
- **Project Name:** `cpi-attendance-hr` (lowercase required).
- **Git Repository:** `sstdevelopaminno/Cpi-Attendance`.
- **Production Branch:** `main`.
- **Root Directory:** `apps/hr-web`.
- **Framework Preset:** `Other` (not Next.js).
- **Build Command:** blank / no build.
- **Output Directory:** default; root contains `index.html`.
- **Install Command:** blank / no package manager needed.

## Employee Vercel project
- **Project Name:** `cpi-attendance-employee`.
- **Git Repository:** same as HR.
- **Production Branch:** `main`.
- **Root Directory:** `apps/employee-pwa`.
- **Framework Preset:** `Other`.
- **Build Command:** blank / no build.
- **Output Directory:** default; root contains `index.html`.

When importing into Vercel, select the root directory with the **Edit** control next to Root Directory. After deployment, verify the real URL in a new tab and confirm `app.js`, `styles.css`, and `manifest.webmanifest` load. These sites show a deliberately disabled login until the API, account provisioning and security checks are approved.

**Important:** Existing PR #1 holds the staged API, SQL and unfinished features. It is deliberately not merged into `main`. Production database `CpiPOS-Communications` remains unchanged by this static web import fix.

**Vercel plan:** Verify deployment entitlements and commercial-use terms before offering Cpi Attendance as a paid service. Do not enter Supabase service-role secrets in the browser app or commit them to Git.
