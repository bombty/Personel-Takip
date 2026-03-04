import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processAttendanceData } from "./processor";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function safeStr(val: any): string {
  if (val == null) return "";
  return String(val).toLowerCase().trim();
}

function detectColumns(headers: any[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const lowerHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    lowerHeaders.push(safeStr(headers[i]));
  }

  const nameKeys = ["name", "ad", "personel", "isim", "calisan", "sicil"];
  const dateKeys = ["datetime", "tarih", "date", "zaman", "time"];
  const enNoKeys = ["enno", "no", "sicil", "id", "numara"];
  const inOutKeys = ["in/out", "giris", "cikis", "tip"];

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (!h) continue;
    if (!mapping.name && nameKeys.some(k => h.includes(k)) && h !== "tmno" && h !== "gmno") {
      if (h === "no" || h === "numara" || h === "id") continue;
      mapping.name = i;
    }
    if (!mapping.dateTime && dateKeys.some(k => h.includes(k))) mapping.dateTime = i;
    if (!mapping.enNo && enNoKeys.some(k => h === k || (h.includes(k) && h !== "tmno" && h !== "gmno"))) mapping.enNo = i;
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

  app.get("/api/employees", requireAuth, async (_req, res) => {
    res.json(await storage.getEmployees());
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

  app.get("/api/uploads", requireAuth, async (_req, res) => {
    res.json(await storage.getUploads());
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

      const uploadRecord = await storage.createUpload({
        fileName: req.file.originalname,
        totalRecords: rawData.length - dataStartRow,
        totalEmployees: 0,
        status: "processing",
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
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules);

      res.json({
        uploadId: uploadRecord.id,
        totalRecords: attendanceRows.length,
        totalEmployees: employeeMap.size,
        errors,
        summaries,
        headers,
        columnMapping,
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
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules);
      res.json({ summaries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/export/:uploadId", requireAuth, async (req, res) => {
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
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap, assignments, schedules);

      const wb = XLSX.utils.book_new();

      const summaryData = summaries.map(s => ({
        "Personel": s.name,
        "Sicil No": s.enNo,
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
      res.setHeader("Content-Disposition", `attachment; filename=PDKS_Rapor_${uploadId}.xlsx`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

  return httpServer;
}
