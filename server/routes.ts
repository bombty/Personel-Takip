import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processAttendanceData } from "./processor";
import { analyzeGeneralReport, analyzeEmployeeReport } from "./ai-analyzer";
import { smartProcessPunches, aiPayrollAnalysis } from "./services/ai-smart-processor";
import { calculatePayroll, calculateFMFromDailyReports, calculateHolidayWorkedDays, DEFAULT_PERIOD_SETTINGS, type PeriodSettings, type PayrollInput } from "./services/salary-calculator";
import { parseScheduleFile } from "./schedule-parser";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeTurkish(str: string): string {
  return str
    .replace(/İ/g, "i").replace(/I/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase().trim();
}

function safeStr(val: any): string {
  if (val == null) return "";
  return normalizeTurkish(String(val));
}

function detectColumns(headers: any[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const lowerHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    lowerHeaders.push(safeStr(headers[i]));
  }

  const nameKeys = ["name", "ad", "personel", "isim", "calisan", "sicil"];
  const dateKeys = ["datetime", "tarih", "date", "zaman", "time"];
  const enNoKeys = ["enno", "no", "sicil", "id", "numara", "kod"];
  const inOutKeys = ["in/out", "giris", "cikis", "tip"];

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (!h) continue;
    if (!mapping.name && nameKeys.some(k => h.includes(k)) && h !== "tmno" && h !== "gmno") {
      if (h === "no" || h === "numara" || h === "id") continue;
      mapping.name = i;
    }
    if (!mapping.dateTime && dateKeys.some(k => h.includes(k))) mapping.dateTime = i;
    if (mapping.enNo === undefined && enNoKeys.some(k => h === k || (h.includes(k) && h !== "tmno" && h !== "gmno")) && !h.startsWith("sira")) mapping.enNo = i;
    if (!mapping.inOut && inOutKeys.some(k => h.includes(k))) mapping.inOut = i;
  }

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (!h) continue;
    if (h === "tmno") mapping.tmNo = i;
    if (h === "gmno") mapping.gmNo = i;
    if (h === "mode") mapping.mode = i;
    if (h === "antipass") mapping.antipass = i;
    if (h === "proxywork") mapping.proxyWork = i;
  }

  if (mapping.enNo === undefined) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (lowerHeaders[i] === "enno" || lowerHeaders[i] === "no") { mapping.enNo = i; break; }
    }
  }
  if (mapping.name === undefined) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (lowerHeaders[i] === "name") { mapping.name = i; break; }
    }
  }

  return mapping;
}

function isDateTimeString(val: any): boolean {
  if (val == null) return false;
  const s = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(:\d{2})?/.test(s);
}

function detectColumnsFromData(rows: any[][]): { mapping: Record<string, number>; hasHeader: boolean } | null {
  const dataRows = rows.filter(r => r && r.length >= 3);
  if (dataRows.length < 2) return null;
  const sampleRows = dataRows.slice(0, Math.min(10, dataRows.length));

  const maxCols = Math.max(...sampleRows.map(r => r.length));
  const colAnalysis: { dateCount: number; intCount: number; strCount: number; total: number }[] = [];

  for (let c = 0; c < maxCols; c++) {
    const analysis = { dateCount: 0, intCount: 0, strCount: 0, total: 0 };
    for (const row of sampleRows) {
      if (c >= row.length || row[c] == null) continue;
      analysis.total++;
      const val = row[c];
      if (isDateTimeString(val)) {
        analysis.dateCount++;
      } else if (typeof val === "number" && Number.isInteger(val) && val > 0 && val < 1000) {
        analysis.intCount++;
      } else if (typeof val === "string" && val.trim().length > 0 && !/^\d+$/.test(val.trim())) {
        analysis.strCount++;
      } else if (typeof val === "number") {
        if (val > 40000 && val < 60000) {
          analysis.dateCount++;
        } else {
          analysis.intCount++;
        }
      }
    }
    colAnalysis.push(analysis);
  }

  const mapping: Record<string, number> = {};

  for (let c = 0; c < colAnalysis.length; c++) {
    const a = colAnalysis[c];
    if (a.total === 0) continue;
    const dateRatio = a.dateCount / a.total;
    if (dateRatio > 0.7 && mapping.dateTime === undefined) {
      mapping.dateTime = c;
    }
  }

  for (let c = 0; c < colAnalysis.length; c++) {
    const a = colAnalysis[c];
    if (a.total === 0 || c === mapping.dateTime) continue;
    const strRatio = a.strCount / a.total;
    if (strRatio > 0.7 && mapping.name === undefined) {
      mapping.name = c;
    }
  }

  let bestEnNoCol = -1;
  let bestEnNoUniqueCount = 0;
  for (let c = 0; c < colAnalysis.length; c++) {
    const a = colAnalysis[c];
    if (a.total === 0 || c === mapping.dateTime || c === mapping.name) continue;
    const intRatio = a.intCount / a.total;
    if (intRatio > 0.7) {
      const vals = sampleRows.map(r => r[c]).filter(v => v != null && typeof v === "number");
      const maxVal = Math.max(...vals.map(Number));
      const uniqueVals = new Set(vals).size;
      if (maxVal < 500 && maxVal > 1 && uniqueVals > bestEnNoUniqueCount) {
        bestEnNoCol = c;
        bestEnNoUniqueCount = uniqueVals;
      }
    }
  }
  if (bestEnNoCol >= 0) {
    mapping.enNo = bestEnNoCol;
  }

  let hasHeader = false;
  const firstRow = rows[0];
  if (firstRow) {
    if (firstRow.length < 3) {
      hasHeader = true;
    } else {
      let firstRowIsData = true;
      if (mapping.dateTime !== undefined) {
        const dtVal = firstRow[mapping.dateTime];
        if (dtVal === undefined || dtVal === null || (typeof dtVal === "string" && !isDateTimeString(dtVal))) {
          firstRowIsData = false;
        }
      }
      if (mapping.enNo !== undefined) {
        const enVal = firstRow[mapping.enNo];
        if (enVal === undefined || enVal === null || (typeof enVal === "string" && isNaN(parseInt(enVal)))) {
          firstRowIsData = false;
        }
      }
      if (!firstRowIsData) {
        hasHeader = true;
      }
    }
  }

  if (mapping.name !== undefined && mapping.dateTime !== undefined && mapping.enNo !== undefined) {
    return { mapping, hasHeader };
  }

  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Oturum acilmamis" });
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Oturum acilmamis" });
    }
    if (!roles.includes(req.session.role!)) {
      return res.status(403).json({ error: "Yetkiniz yok" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await storage.initDefaults();

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Kullanici adi ve sifre gerekli" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Kullanici bulunamadi" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Yanlis sifre" });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.displayName = user.displayName;
    res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Oturum acilmamis" });
    }
    res.json({
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName,
      role: req.session.role,
    });
  });

  app.get("/api/settings", requireRole("yonetim"), async (_req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.post("/api/settings", requireRole("yonetim"), async (req, res) => {
    const entries = Object.entries(req.body as Record<string, string>);
    for (const [key, value] of entries) {
      await storage.upsertSetting(key, String(value));
    }
    const s = await storage.getSettings();
    res.json(s);
  });

  app.get("/api/holidays", requireAuth, async (_req, res) => {
    res.json(await storage.getHolidays());
  });

  app.post("/api/holidays", requireAuth, async (req, res) => {
    res.json(await storage.createHoliday(req.body));
  });

  app.delete("/api/holidays/:id", requireAuth, async (req, res) => {
    await storage.deleteHoliday(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/branches", requireAuth, async (_req, res) => {
    const all = await storage.getBranches();
    res.json(all.filter(b => b.active));
  });

  app.get("/api/branches/:id", requireAuth, async (req, res, next) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return next(); // "stats" gibi string path'leri atla
    try {
      const branch = await storage.getBranchById(id);
      if (!branch) return res.status(404).json({ error: "Şube bulunamadı" });
      res.json(branch);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/branches", requireRole("yonetim"), async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Sube adi zorunlu" });
    const branch = await storage.createBranch({ name: name.trim(), active: true });
    res.json(branch);
  });

  app.patch("/api/branches/:id", requireRole("yonetim"), async (req, res) => {
    const id = parseInt(req.params.id as string);
    const updated = await storage.updateBranch(id, req.body);
    if (!updated) return res.status(404).json({ error: "Sube bulunamadi" });
    res.json(updated);
  });

  app.delete("/api/branches/:id", requireRole("yonetim"), async (req, res) => {
    const id = parseInt(req.params.id as string);
    await storage.deleteBranch(id);
    res.json({ success: true });
  });

  app.get("/api/employees", requireAuth, async (req, res) => {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    res.json(await storage.getEmployees(branchId));
  });

  app.post("/api/employees", requireAuth, async (req, res) => {
    try {
      const emp = await storage.upsertEmployee(req.body);
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/employees/:id", requireAuth, async (req, res) => {
    const emp = await storage.updateEmployee(parseInt(req.params.id), req.body);
    if (!emp) return res.status(404).json({ error: "Personel bulunamadi" });
    res.json(emp);
  });

  app.delete("/api/employees/:id", requireAuth, async (req, res) => {
    await storage.deleteEmployee(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/leaves", requireAuth, async (_req, res) => {
    res.json(await storage.getLeaves());
  });

  app.get("/api/leaves/employee/:id", requireAuth, async (req, res) => {
    res.json(await storage.getLeavesByEmployee(parseInt(req.params.id)));
  });

  app.post("/api/leaves", requireAuth, async (req, res) => {
    res.json(await storage.createLeave(req.body));
  });

  app.patch("/api/leaves/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateLeave(parseInt(req.params.id), req.body));
  });

  app.delete("/api/leaves/:id", requireAuth, async (req, res) => {
    await storage.deleteLeave(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/leaves/:id/resolve-conflict", requireAuth, async (req, res) => {
    const leaveId = parseInt(req.params.id);
    const { action } = req.body;
    if (!action || !["keep_leave", "cancel_leave"].includes(action)) {
      return res.status(400).json({ error: "Gecersiz islem. 'keep_leave' veya 'cancel_leave' belirtin." });
    }
    if (action === "cancel_leave") {
      await storage.deleteLeave(leaveId);
      return res.json({ success: true, action: "cancelled" });
    }
    const updated = await storage.updateLeave(leaveId, { conflictResolved: true });
    res.json({ success: true, action: "resolved", leave: updated });
  });

  app.get("/api/seasons", requireAuth, async (_req, res) => {
    res.json(await storage.getSeasons());
  });

  app.post("/api/seasons", requireRole("yonetim"), async (req, res) => {
    res.json(await storage.createSeason(req.body));
  });

  app.patch("/api/seasons/:id", requireRole("yonetim"), async (req, res) => {
    const s = await storage.updateSeason(parseInt(req.params.id), req.body);
    if (!s) return res.status(404).json({ error: "Sezon bulunamadi" });
    res.json(s);
  });

  app.delete("/api/seasons/:id", requireRole("yonetim"), async (req, res) => {
    await storage.deleteSeason(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/work-schedules", requireAuth, async (_req, res) => {
    res.json(await storage.getWorkSchedules());
  });

  app.post("/api/work-schedules", requireAuth, async (req, res) => {
    res.json(await storage.createWorkSchedule(req.body));
  });

  app.patch("/api/work-schedules/:id", requireAuth, async (req, res) => {
    const s = await storage.updateWorkSchedule(parseInt(req.params.id), req.body);
    if (!s) return res.status(404).json({ error: "Program bulunamadi" });
    res.json(s);
  });

  app.delete("/api/work-schedules/:id", requireAuth, async (req, res) => {
    await storage.deleteWorkSchedule(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/weekly-assignments", requireAuth, async (req, res) => {
    const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
    if (employeeId) {
      res.json(await storage.getWeeklyAssignmentsByEmployee(employeeId));
    } else {
      res.json(await storage.getWeeklyAssignments());
    }
  });

  app.post("/api/weekly-assignments", requireAuth, async (req, res) => {
    const existing = await storage.getWeeklyAssignmentByWeek(req.body.employeeId, req.body.weekStartDate);
    if (existing) {
      res.json(await storage.updateWeeklyAssignment(existing.id, req.body));
    } else {
      res.json(await storage.createWeeklyAssignment(req.body));
    }
  });

  app.patch("/api/weekly-assignments/:id", requireAuth, async (req, res) => {
    const a = await storage.updateWeeklyAssignment(parseInt(req.params.id), req.body);
    if (!a) return res.status(404).json({ error: "Atama bulunamadi" });
    res.json(a);
  });

  app.get("/api/uploads", requireAuth, async (req, res) => {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    res.json(await storage.getUploads(branchId));
  });

  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Dosya bulunamadi" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rawData.length < 2) {
        return res.status(400).json({ error: "Dosya bos veya yetersiz veri" });
      }

      const headerRow = rawData[0] || [];
      const headers: string[] = [];
      for (let i = 0; i < headerRow.length; i++) {
        headers.push(headerRow[i] != null ? String(headerRow[i]) : "");
      }
      let columnMapping = detectColumns(headers);
      let dataStartRow = 1;

      if (columnMapping.name === undefined || columnMapping.dateTime === undefined || columnMapping.enNo === undefined) {
        const fallback = detectColumnsFromData(rawData);
        if (fallback) {
          columnMapping = { ...columnMapping, ...fallback.mapping };
          dataStartRow = fallback.hasHeader ? 1 : 0;
        }
      }

      if (columnMapping.name === undefined || columnMapping.dateTime === undefined || columnMapping.enNo === undefined) {
        const missing: string[] = [];
        if (columnMapping.name === undefined) missing.push("Personel Adi (Name)");
        if (columnMapping.dateTime === undefined) missing.push("Tarih/Saat (DateTime)");
        if (columnMapping.enNo === undefined) missing.push("Sicil No (EnNo)");
        return res.status(400).json({
          error: `Bu dosya PDKS (parmak izi) formatinda degil. Eksik sutunlar: ${missing.join(", ")}. Lutfen parmak izi okuyucudan alinan veriyi yukleyin.`,
          headers: headers.filter(h => h),
          detected: columnMapping,
        });
      }

      const uploadBranchId = req.body.branchId ? parseInt(req.body.branchId) : undefined;
      const uploadRecord = await storage.createUpload({
        fileName: req.file.originalname,
        totalRecords: rawData.length - dataStartRow,
        totalEmployees: 0,
        status: "processing",
        branchId: uploadBranchId || null,
      });

      const attendanceRows: any[] = [];
      const employeeMap = new Map<number, string>();
      const errors: string[] = [];

      for (let i = dataStartRow; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const enNo = parseInt(String(row[columnMapping.enNo] || "0"));
        const rawName = row[columnMapping.name];
        const name = (rawName != null ? String(rawName).trim() : "") || ("Personel-" + enNo);
        let dateTimeRaw = row[columnMapping.dateTime];

        if (!enNo || !dateTimeRaw) {
          errors.push(`Satir ${i + 1}: Eksik veri`);
          continue;
        }

        let dateTime: Date;
        if (typeof dateTimeRaw === "number") {
          if (XLSX.SSF && typeof XLSX.SSF.parse_date_code === "function") {
            const parsed = XLSX.SSF.parse_date_code(dateTimeRaw);
            dateTime = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
          } else {
            const epoch = new Date(1899, 11, 30);
            dateTime = new Date(epoch.getTime() + dateTimeRaw * 86400000);
          }
        } else {
          dateTime = new Date(String(dateTimeRaw));
        }

        if (isNaN(dateTime.getTime())) {
          errors.push(`Satir ${i + 1}: Gecersiz tarih - ${dateTimeRaw}`);
          continue;
        }

        if (!employeeMap.has(enNo) || (rawName != null && String(rawName).trim())) {
          employeeMap.set(enNo, name);
        }

        const modeRaw = columnMapping.mode !== undefined ? row[columnMapping.mode] : null;
        const modeVal = modeRaw != null ? (isNaN(Number(modeRaw)) ? null : parseInt(String(modeRaw))) : null;
        const proxyRaw = columnMapping.proxyWork !== undefined ? row[columnMapping.proxyWork] : null;
        const proxyVal = proxyRaw != null ? (isNaN(Number(proxyRaw)) ? null : parseInt(String(proxyRaw))) : null;

        attendanceRows.push({
          uploadId: uploadRecord.id,
          enNo,
          name,
          dateTime,
          tmNo: columnMapping.tmNo !== undefined ? parseInt(String(row[columnMapping.tmNo] || "0")) : null,
          gmNo: columnMapping.gmNo !== undefined ? parseInt(String(row[columnMapping.gmNo] || "0")) : null,
          mode: modeVal,
          inOut: columnMapping.inOut !== undefined ? String(row[columnMapping.inOut] || "") : null,
          antipass: columnMapping.antipass !== undefined ? String(row[columnMapping.antipass] || "") : null,
          proxyWork: proxyVal,
        });
      }

      const warnings: string[] = [];
      const parseErrorRate = rawData.length > 0 ? errors.length / rawData.length : 0;
      if (parseErrorRate > 0.05) {
        return res.status(400).json({
          error: `Parse hata orani cok yuksek (%${(parseErrorRate * 100).toFixed(1)}). Dosya formati veya encoding hatali olabilir. Lutfen dosyayi kontrol edin.`,
          errors,
        });
      }

      if (attendanceRows.length > 0) {
        const dates = attendanceRows.map((r: any) => new Date(r.dateTime).getTime()).filter((t: number) => !isNaN(t));
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates));
          const maxDate = new Date(Math.max(...dates));
          const rangeDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
          if (rangeDays > 45) {
            warnings.push(`Tarih araligi ${Math.round(rangeDays)} gun. Tek aylik veri bekleniyor, birden fazla ay olabilir.`);
          }
        }

        let closedWindowCount = 0;
        for (const row of attendanceRows) {
          const dt = new Date(row.dateTime);
          const mins = dt.getHours() * 60 + dt.getMinutes();
          if (mins >= 150 && mins < 420) {
            closedWindowCount++;
          }
        }
        if (closedWindowCount > 0) {
          warnings.push(`${closedWindowCount} okutma kapali saat araligi (02:30-07:00) icinde. Gece gecisi kaynaklari kontrol edilmeli.`);
        }

        const timeMap = new Map<string, number>();
        for (const row of attendanceRows) {
          const dt = new Date(row.dateTime);
          const roundedMin = Math.floor(dt.getTime() / 30000);
          const key = `${roundedMin}`;
          timeMap.set(key, (timeMap.get(key) || 0) + 1);
        }
        let bulkPunchCount = 0;
        for (const [, count] of timeMap) {
          if (count >= 3) bulkPunchCount += count;
        }
        if (bulkPunchCount > 0) {
          warnings.push(`${bulkPunchCount} okutma 30 saniye icinde toplu giris suphesi. Terminal ariza/test olabilir.`);
        }
      }

      const existingEmployees = await storage.getEmployees();
      const existingCount = existingEmployees.length;
      const newEmployeeCount = [...employeeMap.keys()].filter(enNo => !existingEmployees.some(e => e.enNo === enNo)).length;
      if (existingCount > 0 && newEmployeeCount > existingCount * 0.5) {
        warnings.push(`${newEmployeeCount} yeni personel tespit edildi (mevcut: ${existingCount}). Dosya encoding veya format hatasi olabilir.`);
      }

      for (const [enNo, name] of employeeMap) {
        await storage.upsertEmployee({ enNo, name, active: true });
      }

      if (attendanceRows.length > 0) {
        await storage.createAttendanceRecords(attendanceRows);
      }

      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) {
        employeeIdMap.set(emp.id, emp.enNo);
      }
      const records = await storage.getAttendanceRecordsByUpload(uploadRecord.id);
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);

      let suggestedPeriod = null;
      try {
        if (attendanceRows.length > 0) {
          const dates = attendanceRows.map((r: any) => new Date(r.dateTime).getTime()).filter((t: number) => !isNaN(t));
          if (dates.length > 0) {
            const uploadMinDate = new Date(Math.min(...dates));
            const uploadMaxDate = new Date(Math.max(...dates));
            const uploadMinStr = localDateKey(uploadMinDate);
            const uploadMaxStr = localDateKey(uploadMaxDate);
            const draftPeriods = await storage.getReportPeriods();
            for (const p of draftPeriods) {
              if (p.status === "draft" && p.startDate <= uploadMaxStr && p.endDate >= uploadMinStr) {
                suggestedPeriod = p;
                break;
              }
            }
          }
        }
      } catch (_e) {}

      res.json({
        uploadId: uploadRecord.id,
        totalRecords: attendanceRows.length,
        totalEmployees: employeeMap.size,
        errors,
        warnings,
        summaries,
        headers,
        columnMapping,
        suggestedPeriod,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message || "Dosya isleme hatasi" });
    }
  });

  app.get("/api/report/:uploadId", requireAuth, async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);
      res.json({ summaries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/branches/stats", requireAuth, async (req, res) => {
    try {
      const branches = await storage.getBranches();
      const allEmployees = await storage.getEmployees();
      const allLeaves = await storage.getLeaves();
      const today = new Date().toISOString().split("T")[0];

      const stats = branches.map(b => {
        const branchEmps = allEmployees.filter(e => e.active && (e as any).branchId === b.id);
        const empIds = new Set(branchEmps.map(e => e.id));
        const activeLeaves = allLeaves.filter(l =>
          empIds.has(l.employeeId) &&
          l.status === "approved" &&
          l.startDate <= today &&
          l.endDate >= today
        );
        return {
          id: b.id,
          name: b.name,
          color: b.color,
          employeeCount: branchEmps.length,
          onLeaveCount: activeLeaves.length,
        };
      });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/export/:uploadId", requireAuth, async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const filter = (req.query.filter as string) || "all";
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      let summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);

      if (filter === "deficit") summaries = summaries.filter(s => s.totalDeficitMinutes > 0);
      else if (filter === "overtime") summaries = summaries.filter(s => s.totalOvertimeMinutes > 0);
      else if (filter === "issues") summaries = summaries.filter(s => s.issueCount > 0);

      const wb = XLSX.utils.book_new();

      const filterLabel = filter === "deficit" ? " (Eksik Mesai)" : filter === "overtime" ? " (Fazla Mesai)" : filter === "issues" ? " (Sorunlu)" : "";
      const summaryData = summaries.map(s => ({
        "Personel": s.name,
        "Sicil No": s.enNo,
        "Tip": s.employmentType === "full_time" ? "Tam Zamanli" : "Yari Zamanli",
        "Haftalik Saat": s.weeklyHoursExpected,
        "Is Gunu": s.workDays,
        "Toplam Calisma (dk)": s.totalWorkMinutes,
        "Ort. Gunluk (dk)": s.avgDailyMinutes,
        "Mesai (dk)": s.totalOvertimeMinutes,
        "Eksik (dk)": s.totalDeficitMinutes,
        "Gec Kalma (gun)": s.lateDays,
        "Erken Cikis (gun)": s.earlyLeaveDays,
        "Off Gunleri": s.offDays,
        "Izin Gunleri": s.leaveDays,
        "Sorun Sayisi": s.issueCount,
        "Aylik Toplam (saat)": s.monthlyTotalHours,
        "Aylik Beklenen (saat)": s.monthlyExpectedHours,
        "Performans (%)": s.performancePercent,
      }));
      const ws1 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, "Personel Ozet");

      const detailData: any[] = [];
      for (const s of summaries) {
        for (const d of s.dailyReports) {
          detailData.push({
            "Personel": s.name,
            "Sicil No": s.enNo,
            "Tarih": d.date,
            "Gun": d.dayName,
            "Vardiya": d.scheduleName || "",
            "1. Giris": d.pairs[0]?.in || "",
            "1. Cikis": d.pairs[0]?.out || "",
            "2. Giris": d.pairs[1]?.in || "",
            "2. Cikis": d.pairs[1]?.out || "",
            "Toplam (dk)": d.totalWorkMinutes,
            "Net (dk)": d.netWorkMinutes,
            "Mesai (dk)": d.overtimeMinutes,
            "Eksik (dk)": d.deficitMinutes,
            "Maas Carpani": d.salaryMultiplier,
            "Off": d.isOffDay ? "Evet" : "",
            "Izinli": d.isOnLeave ? d.leaveType || "Evet" : "",
            "Durum": d.status.join(", "),
          });
        }
      }
      const ws2 = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, ws2, "Gunluk Detay");

      const issueData: any[] = [];
      for (const s of summaries) {
        for (const d of s.dailyReports) {
          for (const st of d.status) {
            if (st !== "Normal" && st !== "Off" && st !== "Izinli") {
              issueData.push({ "Personel": s.name, "Tarih": d.date, "Gun": d.dayName, "Sorun": st });
            }
          }
        }
      }
      const ws3 = XLSX.utils.json_to_sheet(issueData.length > 0 ? issueData : [{ "Bilgi": "Sorun bulunamadi" }]);
      XLSX.utils.book_append_sheet(wb, ws3, "Tutarsizliklar");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const safeFilter = filter !== "all" ? `_${filter}` : "";
      res.setHeader("Content-Disposition", `attachment; filename=PDKS_Rapor_${uploadId}${safeFilter}.xlsx`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-analysis/:uploadId", requireAuth, async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);
      const analysis = await analyzeGeneralReport(summaries, settingsMap);
      res.json({ analysis });
    } catch (err: any) {
      console.error("AI analysis error:", err);
      res.status(500).json({ error: err.message || "AI analiz hatasi" });
    }
  });

  app.get("/api/ai-analysis/:uploadId/:enNo", requireAuth, async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const enNo = parseInt(req.params.enNo);
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);
      const employee = summaries.find(s => s.enNo === enNo);
      if (!employee) {
        return res.status(404).json({ error: "Personel bulunamadi" });
      }
      const analysis = await analyzeEmployeeReport(employee, settingsMap);
      res.json({ analysis });
    } catch (err: any) {
      console.error("AI employee analysis error:", err);
      res.status(500).json({ error: err.message || "AI analiz hatasi" });
    }
  });

  app.get("/api/report-periods", requireAuth, async (req, res) => {
    try {
      const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
      const periods = await storage.getReportPeriods(branchId);
      res.json(periods);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/report-periods", requireRole("supervisor", "yonetim"), async (req, res) => {
    try {
      const { name, startDate, endDate, branchId } = req.body;
      if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: "name, startDate ve endDate alanlari zorunludur" });
      }
      const period = await storage.createReportPeriod({ name, startDate, endDate, branchId: branchId || null });
      res.json(period);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/report-periods/:id", requireRole("supervisor", "yonetim"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const period = await storage.getReportPeriodById(id);
      if (!period) return res.status(404).json({ error: "Donem bulunamadi" });
      if (period.status === "final") return res.status(400).json({ error: "Kilitli donem guncellenemez" });
      const updated = await storage.updateReportPeriod(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/report-periods/:id", requireRole("supervisor", "yonetim"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteReportPeriod(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/report-periods/:id/finalize", requireRole("supervisor", "yonetim"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const period = await storage.getReportPeriodById(id);
      if (!period) return res.status(404).json({ error: "Donem bulunamadi" });
      if (period.status === "final") return res.status(400).json({ error: "Donem zaten kilitli" });
      const finalized = await storage.finalizeReportPeriod(id);
      res.json(finalized);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/report/period/:periodId", requireAuth, async (req, res) => {
    try {
      const periodId = parseInt(req.params.periodId);
      const period = await storage.getReportPeriodById(periodId);
      if (!period) return res.status(404).json({ error: "Donem bulunamadi" });

      const uploadIdList = period.uploadIds
        ? period.uploadIds.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : [];

      let allRecords: any[] = [];
      for (const uid of uploadIdList) {
        const recs = await storage.getAttendanceRecordsByUpload(uid);
        allRecords = allRecords.concat(recs);
      }

      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(allRecords, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);
      res.json({ period, summaries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/export/period/:periodId", requireAuth, async (req, res) => {
    try {
      const periodId = parseInt(req.params.periodId);
      const period = await storage.getReportPeriodById(periodId);
      if (!period) return res.status(404).json({ error: "Donem bulunamadi" });

      const uploadIdList = period.uploadIds
        ? period.uploadIds.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : [];

      let allRecords: any[] = [];
      for (const uid of uploadIdList) {
        const recs = await storage.getAttendanceRecordsByUpload(uid);
        allRecords = allRecords.concat(recs);
      }

      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();
      const summaries = processAttendanceData(allRecords, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules, allEmployees);

      const wb = XLSX.utils.book_new();

      const summaryData = summaries.map(s => ({
        "Personel": s.name,
        "Sicil No": s.enNo,
        "Tip": s.employmentType === "full_time" ? "Tam Zamanli" : "Yari Zamanli",
        "Haftalik Saat": s.weeklyHoursExpected,
        "Is Gunu": s.workDays,
        "Toplam Calisma (dk)": s.totalWorkMinutes,
        "Ort. Gunluk (dk)": s.avgDailyMinutes,
        "Mesai (dk)": s.totalOvertimeMinutes,
        "Eksik (dk)": s.totalDeficitMinutes,
        "Gec Kalma (gun)": s.lateDays,
        "Erken Cikis (gun)": s.earlyLeaveDays,
        "Off Gunleri": s.offDays,
        "Izin Gunleri": s.leaveDays,
        "Sorun Sayisi": s.issueCount,
        "Aylik Toplam (saat)": s.monthlyTotalHours,
        "Aylik Beklenen (saat)": s.monthlyExpectedHours,
        "Performans (%)": s.performancePercent,
      }));
      const ws1 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, "Personel Ozet");

      const detailData: any[] = [];
      for (const s of summaries) {
        for (const d of s.dailyReports) {
          detailData.push({
            "Personel": s.name,
            "Sicil No": s.enNo,
            "Tarih": d.date,
            "Gun": d.dayName,
            "Vardiya": d.scheduleName || "",
            "1. Giris": d.pairs[0]?.in || "",
            "1. Cikis": d.pairs[0]?.out || "",
            "2. Giris": d.pairs[1]?.in || "",
            "2. Cikis": d.pairs[1]?.out || "",
            "Toplam (dk)": d.totalWorkMinutes,
            "Net (dk)": d.netWorkMinutes,
            "Mesai (dk)": d.overtimeMinutes,
            "Eksik (dk)": d.deficitMinutes,
            "Maas Carpani": d.salaryMultiplier,
            "Off": d.isOffDay ? "Evet" : "",
            "Izinli": d.isOnLeave ? d.leaveType || "Evet" : "",
            "Durum": d.status.join(", "),
          });
        }
      }
      const ws2 = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, ws2, "Gunluk Detay");

      const issueData: any[] = [];
      for (const s of summaries) {
        for (const d of s.dailyReports) {
          for (const st of d.status) {
            if (st !== "Normal" && st !== "Off" && st !== "Izinli") {
              issueData.push({ "Personel": s.name, "Tarih": d.date, "Gun": d.dayName, "Sorun": st });
            }
          }
        }
      }
      const ws3 = XLSX.utils.json_to_sheet(issueData.length > 0 ? issueData : [{ "Bilgi": "Sorun bulunamadi" }]);
      XLSX.utils.book_append_sheet(wb, ws3, "Tutarsizliklar");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=PDKS_Donem_Rapor_${periodId}.xlsx`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/upload-schedule", requireRole("supervisor", "yonetim"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Dosya bulunamadi" });
      }

      const weekStartDate = req.body.weekStartDate as string | undefined;
      const overwrite = req.body.overwrite === "true" || req.body.overwrite === true;

      const fileName = req.file.originalname.toLowerCase();
      const fileType = fileName.endsWith(".csv") ? "csv" : "excel";

      const schedules = await storage.getWorkSchedules();
      const parseResult = parseScheduleFile(req.file.buffer, fileType, schedules);

      if (parseResult.rows.length === 0) {
        return res.status(400).json({
          error: "Dosyadan hicbir personel satiri okunamadi",
          warnings: parseResult.warnings,
        });
      }

      const allEmployees = await storage.getEmployees();

      interface ConflictInfo {
        employeeName: string;
        enNo: number;
        weekStartDate: string;
        existingId: number;
      }

      const conflicts: ConflictInfo[] = [];
      const warnings = [...parseResult.warnings];
      let applied = 0;

      for (const row of parseResult.rows) {
        let matchedEmployee = null;

        if (row.sicilNo) {
          matchedEmployee = allEmployees.find(e => e.enNo === row.sicilNo);
        }

        if (!matchedEmployee && row.name) {
          const normalizedRowName = row.name.toLowerCase().replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch: string) => {
            const map: Record<string, string> = {
              "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I",
              "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U",
            };
            return map[ch] || ch;
          }).trim();

          matchedEmployee = allEmployees.find(e => {
            const empNormalized = e.name.toLowerCase().replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch: string) => {
              const map: Record<string, string> = {
                "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I",
                "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U",
              };
              return map[ch] || ch;
            }).trim();
            return empNormalized === normalizedRowName;
          });
        }

        if (!matchedEmployee) {
          warnings.push(`Personel eslestirilemedi: "${row.identifier}"`);
          continue;
        }

        const effectiveWeekStart = row.weekStartDate || weekStartDate;
        if (!effectiveWeekStart) {
          warnings.push(`Hafta baslangic tarihi eksik: "${row.identifier}". Format A icin weekStartDate parametresi gerekli.`);
          continue;
        }

        const existing = await storage.getWeeklyAssignmentByWeek(matchedEmployee.id, effectiveWeekStart);

        if (existing && !overwrite) {
          conflicts.push({
            employeeName: matchedEmployee.name,
            enNo: matchedEmployee.enNo,
            weekStartDate: effectiveWeekStart,
            existingId: existing.id,
          });
          continue;
        }

        const assignmentData = {
          employeeId: matchedEmployee.id,
          weekStartDate: effectiveWeekStart,
          monday: row.monday,
          tuesday: row.tuesday,
          wednesday: row.wednesday,
          thursday: row.thursday,
          friday: row.friday,
          saturday: row.saturday,
          sunday: row.sunday,
        };

        if (existing) {
          await storage.updateWeeklyAssignment(existing.id, assignmentData);
        } else {
          await storage.createWeeklyAssignment(assignmentData);
        }
        applied++;
      }

      res.json({
        success: true,
        applied,
        warnings,
        conflicts,
      });
    } catch (err: any) {
      console.error("Schedule upload error:", err);
      res.status(500).json({ error: err.message || "Sift plani yukleme hatasi" });
    }
  });

  app.post("/api/clear-data", requireRole("yonetim"), async (_req, res) => {
    try {
      await storage.clearAllData();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== PAYROLL ROUTES =====

  // GET /api/payroll/periods - Bordro dönemleri listele
  app.get("/api/payroll/periods", requireAuth, async (req, res) => {
    try {
      const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
      const periods = await storage.getPayrollPeriods(branchId);
      res.json(periods);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/positions - Pozisyonları listele
  app.get("/api/positions", requireAuth, async (_req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/payroll/process - Excel yükle, AI ile işle, maaş hesapla
  app.post("/api/payroll/process", requireRole("yonetim"), upload.single("file"), async (req, res) => {
    try {
      const branchId = parseInt(req.body.branchId);
      if (!branchId) return res.status(400).json({ error: "Şube seçilmeli" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "Dosya yüklenmedi" });

      // 1. Excel'i oku
      const wb = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (rawData.length < 2) return res.status(400).json({ error: "Dosya boş veya hatalı" });

      // 2. Kolon algılama
      const headers = rawData[0];
      const colMap = detectColumns(headers);

      if (colMap.enNo === undefined || colMap.dateTime === undefined) {
        return res.status(400).json({ error: "Sicil No veya Tarih kolonu bulunamadı" });
      }

      // 3. Upload kaydı oluştur
      const uploadRecord = await storage.createUpload({
        fileName: file.originalname,
        totalRecords: rawData.length - 1,
        status: "processing",
        branchId,
      });

      // 4. Kayıtları parse et
      const records: any[] = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row[colMap.enNo!] || !row[colMap.dateTime!]) continue;

        const enNo = parseInt(String(row[colMap.enNo!]));
        const name = colMap.name !== undefined ? String(row[colMap.name]) : `Personel-${enNo}`;
        let dateTime: Date;

        const rawDate = row[colMap.dateTime!];
        if (rawDate instanceof Date) {
          dateTime = rawDate;
        } else {
          dateTime = new Date(String(rawDate));
        }

        if (isNaN(enNo) || isNaN(dateTime.getTime())) continue;

        records.push({
          uploadId: uploadRecord.id,
          enNo,
          name: name.toLowerCase().trim(),
          dateTime,
          tmNo: colMap.tmNo !== undefined ? parseInt(String(row[colMap.tmNo])) || null : null,
          gmNo: colMap.gmNo !== undefined ? parseInt(String(row[colMap.gmNo])) || null : null,
          mode: colMap.mode !== undefined ? parseInt(String(row[colMap.mode])) || null : null,
          inOut: colMap.inOut !== undefined ? String(row[colMap.inOut]) || null : null,
          antipass: null,
          proxyWork: null,
        });
      }

      // 5. DB'ye kaydet
      await storage.createAttendanceRecords(records);

      // 6. AI Akıllı İşleme
      const { corrections, patterns } = await smartProcessPunches(records, true);

      // 7. AI düzeltmeleri DB'ye kaydet
      for (const corr of corrections) {
        await storage.createAiCorrection({
          uploadId: uploadRecord.id,
          enNo: corr.enNo,
          date: corr.date,
          originalPunches: JSON.stringify(corr.originalPunches),
          correctedPunches: JSON.stringify(corr.correctedPunches),
          correctionType: corr.correctionType,
          confidence: corr.confidence,
          reasoning: corr.reasoning,
          approved: corr.confidence >= 70 ? true : null, // yüksek güvenli → otomatik onayla
        });
      }

      // 7.5 AI düzeltmelerini kayıtlara uygula (yüksek güvenli olanları)
      const approvedCorrections = corrections.filter(c => c.confidence >= 70);
      for (const corr of approvedCorrections) {
        // Düzeltilen gün için mevcut kayıtları bul
        const datePrefix = corr.date; // "2026-03-15" formatında
        const existingRecords = records.filter(r =>
          r.enNo === corr.enNo && String(r.dateTime).startsWith(datePrefix)
        );

        if (corr.correctionType === "missing_exit" && corr.correctedPunches.length === 2) {
          // Eksik çıkış → tahmini çıkış saatini ekle
          const [hours, mins] = corr.correctedPunches[1].split(":").map(Number);
          const exitDate = new Date(datePrefix + "T00:00:00");
          exitDate.setHours(hours, mins, 0);
          records.push({
            uploadId: uploadRecord.id,
            enNo: corr.enNo,
            name: corr.name,
            dateTime: exitDate,
            tmNo: null, gmNo: null, mode: null, inOut: "AI", antipass: null, proxyWork: null,
          });
        }

        if ((corr.correctionType === "missing_break_in" || corr.correctionType === "missing_break_out")
            && corr.correctedPunches.length === 4) {
          // Eksik mola okutması → tahmini mola zamanını ekle
          // correctedPunches tam 4 elemanlı, eksik olan eklenmeli
          const existingTimes = existingRecords.map(r => new Date(r.dateTime).getTime());
          for (const punchStr of corr.correctedPunches) {
            const [h, m] = punchStr.split(":").map(Number);
            const punchDate = new Date(datePrefix + "T00:00:00");
            punchDate.setHours(h, m, 0);
            // Bu zaman zaten var mı?
            const exists = existingTimes.some(t => Math.abs(t - punchDate.getTime()) < 120000); // 2dk tolerans
            if (!exists) {
              records.push({
                uploadId: uploadRecord.id,
                enNo: corr.enNo,
                name: corr.name,
                dateTime: punchDate,
                tmNo: null, gmNo: null, mode: null, inOut: "AI", antipass: null, proxyWork: null,
              });
            }
          }
        }
      }

      // 8. Mevcut processor ile hesaplama
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees(branchId);
      const empIdMap = new Map<number, number>();
      for (const emp of allEmployees) {
        empIdMap.set(emp.id, emp.enNo);
      }
      const assignments = await storage.getWeeklyAssignments();
      const schedules = await storage.getWorkSchedules();

      const summaries = processAttendanceData(
        records, settingsMap, holidaysList, leavesList,
        empIdMap, assignments, schedules, allEmployees
      );

      // 9. Ay bilgisini belirle (veriden)
      const dates = records.map(r => new Date(r.dateTime));
      const month = dates[0]?.getMonth() + 1 || new Date().getMonth() + 1;
      const year = dates[0]?.getFullYear() || new Date().getFullYear();

      // 10. Dönem oluştur veya güncelle
      let period = await storage.getPayrollPeriodByMonth(branchId, year, month);
      const trackingDays = parseInt(settingsMap.workDaysPerMonth || "30") ||
        new Date(year, month, 0).getDate(); // ayın gün sayısı

      if (!period) {
        const defaultSettings = { ...DEFAULT_PERIOD_SETTINGS, trackingDays };
        period = await storage.createPayrollPeriod({
          branchId,
          year,
          month,
          workDays: trackingDays,
          salaryDivisor: 30,
          status: "calculated",
          uploadId: uploadRecord.id,
          periodSettings: JSON.stringify(defaultSettings),
        });
      } else {
        await storage.deletePayrollRecordsByPeriod(period.id);
        await storage.updatePayrollPeriod(period.id, { status: "calculated", uploadId: uploadRecord.id });
      }

      // 11. Dönem ayarlarını belirle
      const periodSettings: PeriodSettings = period.periodSettings
        ? JSON.parse(period.periodSettings)
        : { ...DEFAULT_PERIOD_SETTINGS, trackingDays };

      // 12. Her personel için maaş hesapla
      const positions = await storage.getPositions();
      const payrollResults: any[] = [];

      for (const summary of summaries) {
        const employee = allEmployees.find(e => e.enNo === summary.enNo);
        let position = employee?.positionId
          ? positions.find(p => p.id === employee.positionId)
          : undefined;

        if (!position && employee?.position) {
          position = positions.find(p =>
            p.name.toLowerCase().includes(employee.position!.toLowerCase()) ||
            employee.position!.toLowerCase().includes(p.name.toLowerCase())
          );
        }

        // FM ve tatil mesai hesabı (PDKS'den)
        const fmMinutes = calculateFMFromDailyReports(summary.dailyReports, periodSettings);
        const holidayWorkedDays = calculateHolidayWorkedDays(summary.dailyReports, periodSettings);

        // Kişi bazlı maaş (customTotalSalary override destekli)
        const totalSalary = position?.totalSalary || 33000;

        const payrollInput: PayrollInput = {
          employeeName: summary.name,
          positionName: position?.name || "Bilinmiyor",
          totalSalary,
          baseSalary: position?.baseSalary || 31000,
          kasaPrim: position?.kasaPrim || 0,
          performansPrim: position?.performansPrim || 0,
          workedDays: summary.workDays,
          offDays: summary.offDays,
          fmMinutes,
          holidayWorkedDays,
          unpaidLeaveDays: 0,
          sickLeaveDays: 0,
        };

        const result = calculatePayroll(payrollInput, periodSettings);

        const empCorrections = corrections.filter(c => c.enNo === summary.enNo);

        const payrollRecord = await storage.createPayrollRecord({
          periodId: period.id,
          employeeId: employee?.id || 0,
          positionName: position?.name || "Bilinmiyor",
          workedDays: summary.workDays,
          offDays: summary.offDays,
          deficitDays: result.deficitDays,
          penaltyDays: result.penaltyDays,
          overtimeDaysHoliday: holidayWorkedDays,
          fmMinutes,
          totalSalary,
          baseSalary: position?.baseSalary || 31000,
          kasaPrim: position?.kasaPrim || 0,
          performansPrim: position?.performansPrim || 0,
          dailyRate: result.dailyRate,
          dayDeduction: result.dayDeduction,
          primDeduction: result.primDeduction,
          overtimeAmount: result.holidayAmount,
          fmAmount: result.fmAmount,
          mealAmount: result.mealAllowance,
          netPayment: result.netPayment,
          aiCorrections: empCorrections.length > 0 ? JSON.stringify(empCorrections) : null,
          aiConfidence: empCorrections.length > 0
            ? empCorrections.reduce((s: number, c: any) => s + c.confidence, 0) / empCorrections.length
            : 100,
          aiNotes: empCorrections.length > 0
            ? empCorrections.map((c: any) => `${c.date}: ${c.reasoning}`).join("\n")
            : null,
        });

        payrollResults.push({
          employeeName: summary.name,
          enNo: summary.enNo,
          position: position?.name || "Bilinmiyor",
          workedDays: summary.workDays,
          offDays: summary.offDays,
          deficitDays: result.deficitDays,
          overtimeDaysHoliday: holidayWorkedDays,
          fmMinutes,
          totalSalary,
          dayDeduction: result.dayDeduction,
          primDeduction: result.primDeduction,
          fmAmount: result.fmAmount,
          overtimeAmount: result.holidayAmount,
          mealAmount: result.mealAllowance,
          netPayment: result.netPayment,
          aiNotes: payrollRecord.aiNotes,
          aiConfidence: payrollRecord.aiConfidence,
          corrections: empCorrections.map((c: any) => ({
            date: c.date,
            type: c.correctionType,
            confidence: c.confidence,
            reasoning: c.reasoning,
          })),
        });
      }

      // 12. AI genel analiz
      const branch = await storage.getBranchById(branchId);
      const aiAnalysis = await aiPayrollAnalysis(
        payrollResults,
        `${month}/${year}`,
        branch?.name || "Şube"
      );

      // Döneme AI analiz kaydet
      await storage.updatePayrollPeriod(period.id, { aiAnalysis });

      // Upload durumunu güncelle
      await storage.updateUpload(uploadRecord.id, {
        totalRecords: records.length,
        totalEmployees: summaries.length,
        status: "completed",
      });

      res.json({
        periodId: period.id,
        records: payrollResults,
        aiAnalysis,
        totalEmployees: summaries.length,
        totalCorrections: corrections.length,
      });

    } catch (err: any) {
      console.error("Payroll processing error:", err);
      res.status(500).json({ error: err.message || "İşleme hatası" });
    }
  });

  // GET /api/payroll/settings/defaults - Varsayılan ayarları getir
  app.get("/api/payroll/settings/defaults", requireAuth, async (_req, res) => {
    res.json(DEFAULT_PERIOD_SETTINGS);
  });

  // GET /api/payroll/periods/:id/settings - Dönem ayarlarını getir
  app.get("/api/payroll/periods/:id/settings", requireAuth, async (req, res) => {
    try {
      const period = await storage.getPayrollPeriodById(parseInt(req.params.id));
      if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });
      const settings = period.periodSettings
        ? JSON.parse(period.periodSettings)
        : { ...DEFAULT_PERIOD_SETTINGS, trackingDays: period.workDays };
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/payroll/periods/:id/settings - Dönem ayarlarını güncelle
  app.put("/api/payroll/periods/:id/settings", requireRole("yonetim"), async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const period = await storage.getPayrollPeriodById(periodId);
      if (!period) return res.status(404).json({ error: "Dönem bulunamadı" });
      if (period.status === "locked") return res.status(400).json({ error: "Kilitli dönem düzenlenemez" });

      const newSettings = { ...DEFAULT_PERIOD_SETTINGS, ...req.body };
      await storage.updatePayrollPeriod(periodId, {
        periodSettings: JSON.stringify(newSettings),
        workDays: newSettings.trackingDays,
        salaryDivisor: newSettings.salaryDivisor,
      });
      res.json(newSettings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/payroll/chat - AI ile sohbet
  app.post("/api/payroll/chat", requireAuth, async (req, res) => {
    try {
      const { question, periodId, branchId } = req.body;
      if (!question) return res.status(400).json({ error: "Soru gerekli" });

      // Dönem verilerini getir
      let context = "";
      if (periodId) {
        const records = await storage.getPayrollRecords(periodId);
        const period = await storage.getPayrollPeriodById(periodId);
        const branch = branchId ? await storage.getBranchById(branchId) : null;

        context = `Şube: ${branch?.name || "Bilinmiyor"}\n`;
        context += `Dönem: ${period?.month}/${period?.year}\n\n`;
        context += `PERSONEL BORDRO VERİLERİ:\n`;

        for (const rec of records) {
          context += `- ${rec.positionName || "?"} | `;
          context += `Çalışılan: ${rec.workedDays}g, Off: ${rec.offDays}g, Eksik: ${rec.deficitDays}g, `;
          context += `FM: ${rec.fmMinutes}dk, Mesai Tatil: ${rec.overtimeDaysHoliday}g, `;
          context += `Brüt: ${rec.totalSalary}₺, Gün Kesinti: ${Math.round(rec.dayDeduction || 0)}₺, `;
          context += `Net: ${Math.round(rec.netPayment || 0)}₺`;
          if (rec.aiNotes) context += `\n  AI Notlar: ${rec.aiNotes}`;
          context += `\n`;
        }

        if (period?.aiAnalysis) {
          context += `\nAI GENEL ANALİZ:\n${period.aiAnalysis}\n`;
        }
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Sen DOSPRESSO cafe zinciri personel puantaj asistanısın. Kullanıcı sana bordro, puantaj, 
çalışma saatleri, eksik günler, fazla mesai hakkında sorular soracak. 
Kısa, net ve Türkçe cevap ver. Rakamları kullan.

Kurallar:
- Full-time haftalık 45 saat (6 gün × 7.5 saat)
- Günlük ücret = Toplam Maaş ÷ 30
- Eksik gün = Devam takip günü - Çalışılan gün - Off gün
- Birkaç günden fazla eksik → rapor, yıllık izin veya ücretsiz izin olabilir
- FM (fazla mesai) = günlük 8 saatten fazla çalışma (30dk altı sayılmaz)

${context ? "MEVCUT VERİ:\n" + context : "Henüz veri yüklenmedi."}`,
          },
          { role: "user", content: question },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const answer = response.choices[0]?.message?.content || "Yanıt oluşturulamadı.";
      res.json({ answer });

    } catch (err: any) {
      console.error("Chat error:", err);
      res.status(500).json({ error: "AI yanıt hatası" });
    }
  });

  // GET /api/payroll/records/:periodId - Dönem kayıtlarını getir
  app.get("/api/payroll/records/:periodId", requireAuth, async (req, res) => {
    try {
      const periodId = parseInt(req.params.periodId);
      const records = await storage.getPayrollRecords(periodId);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
