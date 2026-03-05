import * as XLSX from "xlsx";
import type { WorkSchedule } from "@shared/schema";

export interface ParsedScheduleRow {
  identifier: string;
  sicilNo?: number;
  name?: string;
  weekStartDate: string;
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
}

export interface ParseScheduleResult {
  rows: ParsedScheduleRow[];
  warnings: string[];
}

const turkishToAsciiMap: Record<string, string> = {
  "ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I",
  "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U",
};

function turkishToAscii(str: string): string {
  return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => turkishToAsciiMap[ch] || ch);
}

function normalizeName(name: string): string {
  return turkishToAscii(name).toLowerCase().trim();
}

const alternativeCodeMap: Record<string, string> = {
  "acilis": "A", "kapanis": "K", "sabah": "A", "aksam": "K",
  "morning": "A", "closing": "K", "tamgun": "T", "yarim": "Y",
  "full": "T", "half": "Y", "tam": "T",
  "a": "A", "k": "K", "t": "T", "y": "Y",
};

function resolveShiftCode(
  rawCode: string,
  schedules: WorkSchedule[]
): string | null | "OFF" {
  const trimmed = rawCode.trim();
  if (!trimmed || trimmed === "-") return null;

  const upper = trimmed.toUpperCase();
  if (upper === "OFF" || upper === "KAPALI" || upper === "TATIL" || upper === "X") {
    return "OFF";
  }

  for (const sched of schedules) {
    if (sched.shortCode && sched.shortCode.toUpperCase() === upper) {
      return sched.shortCode;
    }
  }

  for (const sched of schedules) {
    if (normalizeName(sched.name) === normalizeName(trimmed)) {
      return sched.shortCode || sched.name;
    }
  }

  const normalized = normalizeName(turkishToAscii(trimmed)).replace(/\s+/g, "");
  const mapped = alternativeCodeMap[normalized];
  if (mapped) {
    for (const sched of schedules) {
      if (sched.shortCode && sched.shortCode.toUpperCase() === mapped.toUpperCase()) {
        return sched.shortCode;
      }
    }
    return mapped;
  }

  return null;
}

function parseIdentifier(raw: string): { sicilNo?: number; name?: string } {
  const trimmed = raw.trim();
  const slashMatch = trimmed.match(/^(.+?)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return { name: slashMatch[1].trim(), sicilNo: parseInt(slashMatch[2]) };
  }
  const numOnly = trimmed.match(/^\d+$/);
  if (numOnly) {
    return { sicilNo: parseInt(trimmed) };
  }
  return { name: trimmed };
}

function isDateString(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const dayHeaders = ["pzt", "sal", "car", "per", "cum", "cts", "paz"];
const dayHeadersEn = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayHeadersFull = ["pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi", "pazar"];
const dayHeadersFullEn = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function isDayHeader(val: string): boolean {
  const lower = normalizeName(val);
  return dayHeaders.includes(lower) ||
    dayHeadersEn.includes(lower) ||
    dayHeadersFull.includes(lower) ||
    dayHeadersFullEn.includes(lower);
}

function findDayColumns(headerRow: any[]): { startCol: number; dayIndices: number[] } | null {
  const indices: number[] = [];
  let startCol = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const val = String(headerRow[i] || "").trim();
    if (isDayHeader(val)) {
      if (startCol === -1) startCol = i;
      indices.push(i);
    }
  }

  if (indices.length >= 7) {
    return { startCol, dayIndices: indices.slice(0, 7) };
  }
  return null;
}

export function parseScheduleFile(
  buffer: Buffer,
  fileType: string,
  schedules: WorkSchedule[]
): ParseScheduleResult {
  const warnings: string[] = [];
  const rows: ParsedScheduleRow[] = [];

  let rawData: any[][];

  if (fileType === "csv") {
    const text = buffer.toString("utf-8");
    rawData = text.split(/\r?\n/).map(line =>
      line.split(",").map(cell => cell.trim().replace(/^["']|["']$/g, ""))
    );
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  if (rawData.length < 2) {
    warnings.push("Dosya bos veya yetersiz veri");
    return { rows, warnings };
  }

  let headerRowIdx = -1;
  let dayIndicesResult: { startCol: number; dayIndices: number[] } | null = null;

  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const result = findDayColumns(rawData[i]);
    if (result) {
      headerRowIdx = i;
      dayIndicesResult = result;
      break;
    }
  }

  if (headerRowIdx === -1 || !dayIndicesResult) {
    warnings.push("Gun basliklari bulunamadi (Pzt, Sal, Car, Per, Cum, Cts, Paz)");
    return { rows, warnings };
  }

  const headerRow = rawData[headerRowIdx];
  const { dayIndices } = dayIndicesResult;

  let identifierCol = -1;
  let weekDateCol = -1;
  let isFormatB = false;

  for (let i = 0; i < headerRow.length; i++) {
    if (dayIndices.includes(i)) continue;
    const val = normalizeName(String(headerRow[i] || ""));
    if (val.includes("hafta") || val.includes("week") || val.includes("tarih") || val.includes("date")) {
      if (val.includes("hafta") || val.includes("week") || val.includes("start")) {
        weekDateCol = i;
      }
    }
    if (val.includes("sicil") || val.includes("isim") || val.includes("ad") ||
        val.includes("personel") || val.includes("name") || val.includes("calisan")) {
      identifierCol = i;
    }
  }

  if (identifierCol === -1) {
    for (let i = 0; i < headerRow.length; i++) {
      if (dayIndices.includes(i) && i !== weekDateCol) continue;
      identifierCol = i;
      break;
    }
  }

  if (weekDateCol === -1) {
    const dataRow = rawData[headerRowIdx + 1];
    if (dataRow) {
      for (let i = 0; i < dataRow.length; i++) {
        if (i === identifierCol || dayIndices.includes(i)) continue;
        const val = String(dataRow[i] || "").trim();
        if (isDateString(val)) {
          weekDateCol = i;
          isFormatB = true;
          break;
        }
      }
    }
  } else {
    isFormatB = true;
  }

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const identifierRaw = String(row[identifierCol] || "").trim();
    if (!identifierRaw) continue;

    if (isDayHeader(identifierRaw)) continue;

    const parsed = parseIdentifier(identifierRaw);
    if (!parsed.sicilNo && !parsed.name) {
      warnings.push(`Satir ${i + 1}: Personel bilgisi alinamadi: "${identifierRaw}"`);
      continue;
    }

    let weekStart = "";
    if (isFormatB && weekDateCol >= 0) {
      let dateVal = row[weekDateCol];
      if (dateVal) {
        let dateStr = String(dateVal).trim();
        if (typeof dateVal === "number") {
          const epoch = new Date(1899, 11, 30);
          const d = new Date(epoch.getTime() + dateVal * 86400000);
          dateStr = d.toISOString().slice(0, 10);
        }
        if (isDateString(dateStr)) {
          weekStart = getMondayOfWeek(dateStr);
        }
      }
    }

    const dayCodes: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const colIdx = dayIndices[d];
      const cellVal = row[colIdx];
      if (cellVal == null || String(cellVal).trim() === "") {
        dayCodes.push(null);
      } else {
        const resolved = resolveShiftCode(String(cellVal), schedules);
        if (resolved === null) {
          warnings.push(`Satir ${i + 1}, ${dayHeaders[d]}: Bilinmeyen vardiya kodu "${String(cellVal).trim()}"`);
          dayCodes.push(null);
        } else {
          dayCodes.push(resolved);
        }
      }
    }

    rows.push({
      identifier: identifierRaw,
      sicilNo: parsed.sicilNo,
      name: parsed.name,
      weekStartDate: weekStart,
      monday: dayCodes[0],
      tuesday: dayCodes[1],
      wednesday: dayCodes[2],
      thursday: dayCodes[3],
      friday: dayCodes[4],
      saturday: dayCodes[5],
      sunday: dayCodes[6],
    });
  }

  if (rows.length === 0) {
    warnings.push("Hicbir personel satiri bulunamadi");
  }

  return { rows, warnings };
}
