# DOSPRESSO PDKS - Personel Devam Kontrol Sistemi

## Overview
A full-stack web application for DOSPRESSO that tracks employee attendance using fingerprint scanner data. It processes uploaded Excel/CSV files, calculates working hours, overtime, late arrivals, early departures, and generates detailed reports.

## Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Drizzle ORM)
- **File Processing:** SheetJS (xlsx)
- **Charts:** Recharts
- **Routing:** Wouter

## Architecture
- `shared/schema.ts` - Data models, TypeScript interfaces, Zod schemas
- `server/db.ts` - Database connection via pg + Drizzle
- `server/storage.ts` - Storage interface and PostgreSQL implementation
- `server/processor.ts` - Attendance data processing engine (punch pairing, overtime calc, etc.)
- `server/routes.ts` - API endpoints with file upload (multer)
- `client/src/` - React frontend with pages and components

## Pages
1. **Dashboard** (`/`) - Overview stats, charts, employee summary table
2. **Veri Yukle** (`/upload`) - Drag-drop file upload, preview, processing
3. **Personeller** (`/employees`) - Employee list with search
4. **Personel Detay** (`/employees/:enNo`) - Individual employee daily breakdown
5. **Izin Yonetimi** (`/leaves`) - Leave management (add/delete/view)
6. **Ayarlar** (`/settings`) - Work hour rules, tolerances, holidays

## Key Features
- Excel/CSV/Numbers upload with automatic column detection (null-safe header parsing)
- Punch pairing algorithm (chronological entry/exit matching)
- Overtime, deficit, late, early leave calculations
- Turkish official holiday calendar with salary multipliers
- Leave management system
- Excel report export (3-sheet workbook)
- Dark theme with warm coffee-inspired colors
- User-friendly Turkish error messages for invalid file formats

## Database Tables
- `employees` - Personnel records
- `attendance_records` - Raw fingerprint punch data
- `uploads` - Upload history
- `settings` - Configurable work rules
- `holidays` - Official holidays with salary multipliers
- `leaves` - Employee leave records

## API Routes
- `GET/POST /api/settings` - Work settings
- `GET/POST/DELETE /api/holidays` - Holiday management
- `GET /api/employees` - Employee list
- `POST /api/upload` - File upload + processing
- `GET /api/report/:uploadId` - Report data
- `GET /api/export/:uploadId` - Excel export
- `GET/POST/PATCH/DELETE /api/leaves` - Leave CRUD
