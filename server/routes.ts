import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processAttendanceData } from "./processor";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function safeStr(val: any): string {
  if (val == null) return "";
  return String(val).toLowerCase().trim();
}

function detectColumns(headers: any[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  const maxCols = headers.length;
  const lowerHeaders: string[] = [];
  for (let i = 0; i < maxCols; i++) {
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
      if (lowerHeaders[i] === "enno" || lowerHeaders[i] === "no") {
        mapping.enNo = i;
        break;
      }
    }
  }

  if (mapping.name === undefined) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (lowerHeaders[i] === "name") {
        mapping.name = i;
        break;
      }
    }
  }

  return mapping;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await storage.initDefaults();

  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.post("/api/settings", async (req, res) => {
    const entries = Object.entries(req.body as Record<string, string>);
    for (const [key, value] of entries) {
      await storage.upsertSetting(key, String(value));
    }
    const s = await storage.getSettings();
    res.json(s);
  });

  app.get("/api/holidays", async (_req, res) => {
    const h = await storage.getHolidays();
    res.json(h);
  });

  app.post("/api/holidays", async (req, res) => {
    const h = await storage.createHoliday(req.body);
    res.json(h);
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    await storage.deleteHoliday(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/employees", async (_req, res) => {
    const e = await storage.getEmployees();
    res.json(e);
  });

  app.get("/api/leaves", async (_req, res) => {
    const l = await storage.getLeaves();
    res.json(l);
  });

  app.get("/api/leaves/employee/:id", async (req, res) => {
    const l = await storage.getLeavesByEmployee(parseInt(req.params.id));
    res.json(l);
  });

  app.post("/api/leaves", async (req, res) => {
    const l = await storage.createLeave(req.body);
    res.json(l);
  });

  app.patch("/api/leaves/:id", async (req, res) => {
    const l = await storage.updateLeave(parseInt(req.params.id), req.body);
    res.json(l);
  });

  app.delete("/api/leaves/:id", async (req, res) => {
    await storage.deleteLeave(parseInt(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/uploads", async (_req, res) => {
    const u = await storage.getUploads();
    res.json(u);
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
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
      const columnMapping = detectColumns(headers);

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
        totalRecords: rawData.length - 1,
        totalEmployees: 0,
        status: "processing",
      });

      const attendanceRows: any[] = [];
      const employeeMap = new Map<number, string>();
      const errors: string[] = [];

      for (let i = 1; i < rawData.length; i++) {
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
      const allRecords = await storage.getAttendanceRecordsByUpload(uploadRecord.id);
      const summaries = processAttendanceData(allRecords, settingsMap, holidaysList, leavesList, employeeIdMap);

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

  app.get("/api/report/:uploadId", async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap);

      res.json({ summaries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/export/:uploadId", async (req, res) => {
    try {
      const uploadId = parseInt(req.params.uploadId);
      const records = await storage.getAttendanceRecordsByUpload(uploadId);
      const settingsMap = await storage.getSettings();
      const holidaysList = await storage.getHolidays();
      const leavesList = await storage.getLeaves();
      const allEmployees = await storage.getEmployees();
      const employeeIdMap = new Map<number, number>();
      for (const emp of allEmployees) { employeeIdMap.set(emp.id, emp.enNo); }
      const summaries = processAttendanceData(records, settingsMap, holidaysList, leavesList, employeeIdMap);

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
            "1. Giris": d.pairs[0]?.in || "",
            "1. Cikis": d.pairs[0]?.out || "",
            "2. Giris": d.pairs[1]?.in || "",
            "2. Cikis": d.pairs[1]?.out || "",
            "Toplam (dk)": d.totalWorkMinutes,
            "Net (dk)": d.netWorkMinutes,
            "Mesai (dk)": d.overtimeMinutes,
            "Eksik (dk)": d.deficitMinutes,
            "Maas Carpani": d.salaryMultiplier,
            "Izinli": d.isOnLeave ? "Evet" : "",
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
            if (st !== "Normal") {
              issueData.push({
                "Personel": s.name,
                "Tarih": d.date,
                "Gun": d.dayName,
                "Sorun": st,
              });
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

  return httpServer;
}
