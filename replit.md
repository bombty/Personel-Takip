# DOSPRESSO PDKS - Personel Devam Kontrol Sistemi v3.0

## Overview
A full-stack web application for DOSPRESSO (cafe chain) that tracks employee attendance using fingerprint scanner data. Processes uploaded Excel/CSV/.numbers files, calculates working hours based on seasonal cafe schedules, manages shifts with flexible weekly off days, and generates detailed reports. Two user roles: Supervisor (branch management) and Yönetim (full access).

## Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend:** Node.js + Express + express-session (connect-pg-simple)
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** bcryptjs for password hashing, session-based auth
- **File Processing:** SheetJS (xlsx)
- **Charts:** Recharts
- **Routing:** Wouter
- **AI:** OpenAI GPT-4o via Replit AI Integrations (env: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL)

## Architecture
- `shared/schema.ts` - Data models, TypeScript interfaces, Zod schemas
- `server/db.ts` - Database connection via pg + Drizzle
- `server/storage.ts` - Storage interface and PostgreSQL implementation with all CRUD ops
- `server/processor.ts` - Attendance data processing engine (punch pairing, overtime calc, schedule-aware)
- `server/routes.ts` - API endpoints with session auth, role-based access, file upload (multer)
- `server/ai-analyzer.ts` - OpenAI-powered attendance report analysis (general + per-employee)
- `server/schedule-parser.ts` - Excel/CSV shift plan parser (Format A single-week, Format B multi-week)
- `server/index.ts` - Express server with session middleware
- `client/src/hooks/use-auth.tsx` - AuthContext/Provider for login/logout/role management
- `client/src/hooks/use-branch.tsx` - BranchContext/Provider for branch filter selection (persisted in localStorage)
- `client/src/` - React frontend with pages and components

## Pages
1. **Login** - DOSPRESSO-branded login form (supervisor/1234, yonetim/1234)
2. **Dashboard** (`/`) - Upload/Period selector, overview stats (off/leave/overtime), charts, employee summary table with export
3. **Veri Yukle** (`/upload`) - Drag-drop file upload, preview, processing
4. **Personeller** (`/employees`) - Employee list with CRUD (add/edit/soft-delete)
5. **Personel Detay** (`/employees/:enNo`) - Individual employee daily breakdown with schedule/off info + missing assignment warning
6. **Vardiya Plani** (`/shifts`) - Work schedule templates + weekly assignment table + shift plan Excel upload (tabs: Programlar, Haftalik Atama, Sift Plani Yukle)
7. **Izin Yonetimi** (`/leaves`) - Leave management (add/delete/view)
8. **Donemler** (`/periods`) - Report period management (create/finalize/export/archive)
9. **Ayarlar** (`/settings`) - Season management (Yaz/Kış hours), work rules, holidays, branch management (yonetim only)

## Database Tables
- `users`, `employees` (with `branch_id`, `annual_leave_quota`), `attendance_records`, `uploads`
- `work_schedules` (with `short_code`), `weekly_assignments`
- `leaves`, `holidays`, `seasons`, `settings`
- `report_periods` (status: draft/final/archived)
- `branches` (id, name, active)

## Key Features (v3.0)
- **Multi-branch (Şube) support:** 5 default branches (Işıklar, Lara, Beachpark, Düzce, Samsun); sidebar branch filter; employees assigned to branches; dashboard filters by selected branch; settings branch management (yonetim only)
- Session-based authentication with 2 roles (supervisor, yonetim)
- Excel/CSV/Numbers upload with automatic column detection + headerless file fallback
- Seasonal cafe hours: Kış (Nov-Mar) weekday 08:00-00:00, Cuma-Cmt 08:00-02:00; Yaz (Apr-Oct) weekday 08:00-01:00, Cuma-Cmt 08:00-02:00
- Flexible weekly off days per employee (no fixed weekend - cafe is open every day)
- Work schedule templates (Açılış, Kapanış, Tam Gün, Yarım Gün) with shortCode field (A/K/T/Y)
- **4-punch model pairing:** Giriş → Mola Çıkış → Mola Dönüş → Mesai Bitiş (break auto-deducted)
- **Midnight crossing support:** Punches at 00:00-06:59 attributed to previous work day (for night shift closings)
- **Enhanced inconsistency detection:** Tek Okutma, Eksik Okutma, Çoklu Okutma, Molasız, Gece Geçişi, Mola Basi Eksik, Mola Donus Eksik, Gercek Eksik, Cift Giris Suphesi, Uzun Mola, Izin Cakismasi
- **Closed window splitting (02:30-07:00):** Punches crossing store-closed hours split into 2 work days
- **3-punch A/B/C classification:** A=Mola Donus Eksik, B=Mola Basi Eksik, C=Gercek Eksik
- **4-punch break validation:** <10dk=Cift Giris Suphesi, >120dk=Uzun Mola
- **Leave+punch conflict detection:** Izin gunde okutma varsa "Izin Cakismasi" uyarisi
- **Upload sanity checks:** Parse error rate >5% stops upload, date range >45 days warns
- **leaveDate field:** Employee leave date excludes post-leave days from expected hours
- **v3: calculateMonthlyExpectedHours rewrite** — iterates every calendar day of the month, checks assignments/holidays/leaves to determine work days (not just days with punches)
- **v3: Full-month OFF day fill** — processAttendanceData fills OFF days for complete month span, not just punch date range
- **v3: Shift plan Excel/CSV upload** — Format A (single week) and Format B (multi-week) with short code resolution and conflict handling
- **v3: Report periods** — Monthly report period management with create/finalize/export, upload association, period-based dashboard viewing
- **v3: Missing assignment warnings** — missingAssignmentWeeks field on EmployeeSummary, yellow banner on employee detail page
- **Annual leave balance tracking:** `annualLeaveQuota` field on employees (default 14 days); leaves page shows quota/used/remaining with progress bar per employee
- **Filtered Excel export:** `?filter=deficit|overtime|issues|all` query param; dashboard shows export filter selector before download
- **Branch comparison panel:** Dashboard shows per-branch staff count + today's on-leave count when "Tüm Şubeler" is selected and no report is loaded; powered by `GET /api/branches/stats`
- **Atama Boşlukları tab:** Shifts page 4th tab shows employees without assignments for current week, with badge count and direct link to assignment table
- Overtime, deficit, late, early leave calculations
- Holiday calendar with salary multipliers
- Leave management system
- Excel report export (3-sheet workbook, filterable)
- **Weekly 45-hour rule** (Turkish labor law)
- **Employment type support:** Full-time (45h/week) and Part-time (30h/week)
- **Monthly pay period** calculation with performance percentage
- **AI-powered report analysis:** General report and per-employee evaluation using GPT-4o (Turkish language)
- **Leave integration in reports:** Leave days without punches auto-appear in daily reports
- Dashboard month/employee filters, upload/period data source toggle, weekly bar chart
- Dark theme with warm coffee-inspired colors

## Database Tables
- `users` - Auth credentials (bcrypt hashed passwords)
- `employees` - Personnel records (enNo, name, department, position, phone, hireDate, leaveDate, active)
- `attendance_records` - Raw fingerprint punch data
- `uploads` - Upload history
- `settings` - Configurable work rules
- `holidays` - Official holidays with salary multipliers
- `leaves` - Employee leave records (with conflictResolved flag)
- `seasons` - Seasonal operating hours (Yaz/Kış)
- `work_schedules` - Shift templates with shortCode (A/K/T/Y)
- `weekly_assignments` - Per-employee weekly shift/off assignments
- `report_periods` - Monthly report periods (id, name, startDate, endDate, uploadIds, status, createdAt, finalizedAt)

## API Routes
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET/POST /api/settings` - Work settings
- `GET/POST/DELETE /api/holidays` - Holiday management
- `GET/POST/PATCH/DELETE /api/employees` - Employee CRUD
- `GET/POST/PATCH/DELETE /api/seasons` - Season CRUD
- `GET/POST/PATCH/DELETE /api/work-schedules` - Schedule CRUD
- `GET/POST/PATCH /api/weekly-assignments` - Assignment CRUD
- `POST /api/upload` - File upload + processing
- `POST /api/upload-schedule` - Shift plan Excel/CSV upload
- `GET /api/report/:uploadId` - Report data (upload-based)
- `GET /api/report/period/:periodId` - Report data (period-based)
- `GET /api/export/:uploadId?filter=all|deficit|overtime|issues` - Filtered Excel export (upload-based)
- `GET /api/export/period/:periodId` - Excel export (period-based)
- `GET /api/branches/stats` - Per-branch summary (employee count + today's on-leave count)
- `GET/POST/PATCH/DELETE /api/report-periods` - Report period CRUD
- `POST /api/report-periods/:id/finalize` - Finalize (lock) a report period
- `GET/POST/PATCH/DELETE /api/leaves` - Leave CRUD
- `POST /api/leaves/:id/resolve-conflict` - Resolve leave+punch conflict
- `GET /api/ai-analysis/:uploadId` - AI general report analysis
- `GET /api/ai-analysis/:uploadId/:enNo` - AI individual employee analysis
- `POST /api/clear-data` - Clear all attendance data (yonetim only)

## Default Credentials
- supervisor / 0000 (Supervisor role)
- admin / 0000 (Yönetim role - full access)
