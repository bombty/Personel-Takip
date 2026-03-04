# DOSPRESSO PDKS - Personel Devam Kontrol Sistemi

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
- `server/index.ts` - Express server with session middleware
- `client/src/hooks/use-auth.tsx` - AuthContext/Provider for login/logout/role management
- `client/src/` - React frontend with pages and components

## Pages
1. **Login** - DOSPRESSO-branded login form (supervisor/1234, yonetim/1234)
2. **Dashboard** (`/`) - Upload selector, overview stats (off/leave/overtime), charts, employee summary table with export
3. **Veri Yukle** (`/upload`) - Drag-drop file upload, preview, processing
4. **Personeller** (`/employees`) - Employee list with CRUD (add/edit/soft-delete)
5. **Personel Detay** (`/employees/:enNo`) - Individual employee daily breakdown with schedule/off info
6. **Vardiya Plani** (`/shifts`) - Work schedule templates + weekly assignment table
7. **Izin Yonetimi** (`/leaves`) - Leave management (add/delete/view)
8. **Ayarlar** (`/settings`) - Season management (Yaz/Kış hours), work rules, holidays (yonetim only)

## Key Features
- Session-based authentication with 2 roles (supervisor, yonetim)
- Excel/CSV/Numbers upload with automatic column detection + headerless file fallback
- Seasonal cafe hours: Kış (Nov-Mar) weekday 08:00-00:00, Cuma-Cmt 08:00-02:00; Yaz (Apr-Oct) weekday 08:00-01:00, Cuma-Cmt 08:00-02:00
- Flexible weekly off days per employee (no fixed weekend - cafe is open every day)
- Work schedule templates (Açılış, Kapanış, Tam Gün, Yarım Gün) with shift assignment
- **4-punch model pairing:** Giriş → Mola Çıkış → Mola Dönüş → Mesai Bitiş (break auto-deducted)
- **Midnight crossing support:** Punches at 00:00-06:59 attributed to previous work day (for night shift closings)
- **Enhanced inconsistency detection:** Tek Okutma, Eksik Okutma, Çoklu Okutma, Molasız, Gece Geçişi
- DailyReport includes punchCount and nightCrossing fields for frontend visualization
- Overtime, deficit, late, early leave calculations
- Holiday calendar with salary multipliers
- Leave management system
- Excel report export (3-sheet workbook)
- **Weekly 45-hour rule** (Turkish labor law): weekly overtime/deficit calculation, weekly breakdown per employee
- **Employment type support:** Full-time (45h/week default) and Part-time (30h/week default) with per-employee customization
- **Monthly pay period** calculation with performance percentage
- **hasAssignment flag:** Late/early detection only when employee has explicit weekly schedule assignment (prevents false alerts with default schedule)
- **AI-powered report analysis:** General report and per-employee evaluation using GPT-4o (Turkish language)
- Dashboard month/employee filters, weekly bar chart
- Dark theme with warm coffee-inspired colors

## Database Tables
- `users` - Auth credentials (bcrypt hashed passwords)
- `employees` - Personnel records (enNo, name, department, position, phone, hireDate, active)
- `attendance_records` - Raw fingerprint punch data
- `uploads` - Upload history
- `settings` - Configurable work rules
- `holidays` - Official holidays with salary multipliers
- `leaves` - Employee leave records
- `seasons` - Seasonal operating hours (Yaz/Kış)
- `work_schedules` - Shift templates (Açılış, Kapanış, etc.)
- `weekly_assignments` - Per-employee weekly shift/off assignments

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
- `GET /api/report/:uploadId` - Report data
- `GET /api/export/:uploadId` - Excel export
- `GET/POST/PATCH/DELETE /api/leaves` - Leave CRUD
- `GET /api/ai-analysis/:uploadId` - AI general report analysis (all employees)
- `GET /api/ai-analysis/:uploadId/:enNo` - AI individual employee analysis
- `POST /api/clear-data` - Clear all attendance data (yonetim only)

## Default Credentials
- supervisor / 1234 (Supervisor role)
- yonetim / 1234 (Yönetim role - full access)
