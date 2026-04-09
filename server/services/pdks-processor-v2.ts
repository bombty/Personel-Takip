/**
 * DOSPRESSO PDKS Veri İşleyici v2
 * 
 * AGL_001.txt formatı:
 * No\tTMNo\tEnNo\tName\tINOUT\tMode\tDateTime
 * 1\t1\t1010\t\t0\t0\t2022/05/05 11:37:40
 * 
 * ÖNEMLİ: Name kolonu BOŞ — EnNo ile eşleştirme yapılacak
 * 
 * Akış:
 * 1. Dosyayı parse et (txt veya xlsx)
 * 2. Ay filtreleme (seçilen dönem)
 * 3. EnNo bazlı gruplama
 * 4. Gün-gün hesaplama (giriş/çıkış çiftleme, FM hesabı)
 * 5. daily_attendance kayıtları oluştur
 */

import type { InsertDailyAttendance } from "@shared/schema";

// ===== TYPES =====

export interface RawPunch {
  no: number;
  tmNo: number;
  enNo: number;
  name: string;
  inOut: number;
  mode: number;
  dateTime: Date;
}

export interface DayResult {
  day: number; // 1-31
  status: string; // "1", "0", "0.5", ""
  fmMinutes: number; // + veya -
  actualStart: string | null; // "08:05"
  actualEnd: string | null; // "16:32"
  breakMinutes: number | null;
  punchCount: number;
  rawPunches: string[]; // ["08:05", "12:00", "13:00", "16:32"]
  source: string; // "pdks"
  notes: string | null;
}

export interface EmployeeMonthResult {
  enNo: number;
  days: Map<number, DayResult>; // day (1-31) → result
  totalWorkedDays: number;
  totalFmMinutes: number; // NET (pozitif + negatif)
  positiveFmMinutes: number;
  negativeFmMinutes: number;
}

interface ProcessingSettings {
  dailyNetMinutes: number; // 450 (7.5 saat)
  breakMinutes: number; // 60
  fmMinThreshold: number; // 30
  nightCutoffHour: number; // 7
}

const DEFAULT_SETTINGS: ProcessingSettings = {
  dailyNetMinutes: 450,
  breakMinutes: 60,
  fmMinThreshold: 30,
  nightCutoffHour: 7,
};

// ===== PARSER =====

/**
 * AGL_001.txt formatını parse eder
 * Tab-separated, ilk satır header
 */
export function parseAGLFile(content: string): RawPunch[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const punches: RawPunch[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 7) continue;

    const no = parseInt(parts[0]);
    const tmNo = parseInt(parts[1]);
    const enNo = parseInt(parts[2]);
    const name = parts[3] || "";
    const inOut = parseInt(parts[4]) || 0;
    const mode = parseInt(parts[5]) || 0;

    // DateTime: "2026/03/01 08:05:23"
    const dtStr = parts[6]?.trim();
    if (!dtStr) continue;
    const dateTime = new Date(dtStr.replace(/\//g, '-'));
    if (isNaN(dateTime.getTime())) continue;

    punches.push({ no, tmNo, enNo, name, inOut, mode, dateTime });
  }

  return punches;
}

/**
 * Excel PDKS formatını parse eder (Lara şubesi formatı)
 * Kolonlar: SIRA NO, KOD, İSİM, TARİH
 */
export function parseExcelPDKS(rows: any[][]): RawPunch[] {
  const punches: RawPunch[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const no = parseInt(String(row[0])) || i;
    const enNo = parseInt(String(row[1]));
    const name = String(row[2] || "").trim();

    let dateTime: Date;
    if (row[3] instanceof Date) {
      dateTime = row[3];
    } else {
      dateTime = new Date(String(row[3]));
    }

    if (isNaN(enNo) || isNaN(dateTime.getTime())) continue;

    punches.push({ no, tmNo: 1, enNo, name, inOut: 0, mode: 0, dateTime });
  }

  return punches;
}

// ===== GÜNLÜK HESAPLAMA =====

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Bir gün için okutmaları işleyip DayResult üretir
 */
function processDayPunches(
  punches: Date[],
  settings: ProcessingSettings
): DayResult & { day: number } {
  const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime());

  // Duplikat temizle (2dk altı)
  const cleaned: Date[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i].getTime() - sorted[i - 1].getTime()) / 60000 >= 2) {
      cleaned.push(sorted[i]);
    }
  }

  const count = cleaned.length;
  const rawPunches = cleaned.map(formatTime);
  const day = cleaned[0].getDate();
  let notes: string | null = null;

  if (count === 0) {
    return {
      day, status: "0", fmMinutes: 0,
      actualStart: null, actualEnd: null, breakMinutes: null,
      punchCount: 0, rawPunches: [], source: "pdks", notes: null,
    };
  }

  if (count === 1) {
    notes = "Tek okutma — çıkış eksik";
    return {
      day, status: "1", fmMinutes: 0,
      actualStart: rawPunches[0], actualEnd: null, breakMinutes: null,
      punchCount: 1, rawPunches, source: "pdks", notes,
    };
  }

  const first = cleaned[0];
  const last = cleaned[count - 1];
  const actualStart = formatTime(first);
  const actualEnd = formatTime(last);

  let netMinutes: number;
  let breakMinutesActual: number | null = null;

  if (count === 2) {
    // Giriş-Çıkış, mola bilinmiyor → standart mola düş
    const brut = (last.getTime() - first.getTime()) / 60000;
    netMinutes = brut - settings.breakMinutes;
    breakMinutesActual = settings.breakMinutes;
  } else if (count === 4) {
    // Giriş-Mola Çıkış-Mola Dönüş-Çıkış (ideal)
    const seg1 = (cleaned[1].getTime() - cleaned[0].getTime()) / 60000;
    const seg2 = (cleaned[3].getTime() - cleaned[2].getTime()) / 60000;
    breakMinutesActual = Math.round((cleaned[2].getTime() - cleaned[1].getTime()) / 60000);
    netMinutes = seg1 + seg2;

    if (breakMinutesActual > settings.breakMinutes + 5) {
      notes = `Uzun mola: ${breakMinutesActual}dk`;
    }
  } else if (count === 3) {
    // Eksik okutma — tahmini hesaplama
    const gap01 = (cleaned[1].getTime() - cleaned[0].getTime()) / 60000;
    const gap12 = (cleaned[2].getTime() - cleaned[1].getTime()) / 60000;
    const total = (cleaned[2].getTime() - cleaned[0].getTime()) / 60000;
    breakMinutesActual = Math.round(Math.min(gap01, gap12));
    netMinutes = total - Math.max(breakMinutesActual, settings.breakMinutes);
    notes = "3 okutma — eksik okutma tahmini";
  } else {
    // 5+ okutma — çiftler halinde
    netMinutes = 0;
    for (let i = 0; i < count - 1; i += 2) {
      netMinutes += (cleaned[i + 1].getTime() - cleaned[i].getTime()) / 60000;
    }
    notes = `${count} okutma`;
  }

  netMinutes = Math.max(0, Math.round(netMinutes));

  // FM hesabı
  const fmRaw = netMinutes - settings.dailyNetMinutes;
  let fmMinutes: number;
  if (Math.abs(fmRaw) < settings.fmMinThreshold) {
    fmMinutes = 0; // tolerans içinde
  } else {
    fmMinutes = fmRaw; // pozitif = fazla mesai, negatif = eksik
  }

  // Yarım gün tespiti (net < 4 saat ama > 0)
  const status = netMinutes < 240 && netMinutes > 0 ? "0.5" : "1";

  return {
    day, status, fmMinutes,
    actualStart, actualEnd,
    breakMinutes: breakMinutesActual,
    punchCount: count, rawPunches, source: "pdks", notes,
  };
}

// ===== ANA İŞLEME =====

/**
 * Gece geçişini hesaba katarak punch'ı doğru güne ata
 */
function assignPunchToDay(dt: Date, nightCutoff: number): { year: number; month: number; day: number } {
  const hour = dt.getHours();
  if (hour < nightCutoff) {
    // Gece vardiyası — önceki güne ait
    const prev = new Date(dt);
    prev.setDate(prev.getDate() - 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1, day: prev.getDate() };
  }
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
}

/**
 * Belirli bir ay için tüm personelin gün-gün puantajını hesaplar
 */
export function processMonthlyAttendance(
  punches: RawPunch[],
  targetYear: number,
  targetMonth: number,
  settings: ProcessingSettings = DEFAULT_SETTINGS
): Map<number, EmployeeMonthResult> {
  // 1. Ay filtreleme + gün ataması
  const byEmployeeDay = new Map<number, Map<number, Date[]>>(); // enNo → day → punches

  for (const punch of punches) {
    const assigned = assignPunchToDay(punch.dateTime, settings.nightCutoffHour);

    // Sadece hedef ay
    if (assigned.year !== targetYear || assigned.month !== targetMonth) continue;

    if (!byEmployeeDay.has(punch.enNo)) {
      byEmployeeDay.set(punch.enNo, new Map());
    }
    const empDays = byEmployeeDay.get(punch.enNo)!;
    if (!empDays.has(assigned.day)) {
      empDays.set(assigned.day, []);
    }
    empDays.get(assigned.day)!.push(punch.dateTime);
  }

  // 2. Her personel-gün için hesaplama
  const results = new Map<number, EmployeeMonthResult>();

  byEmployeeDay.forEach((dayMap, enNo) => {
    const days = new Map<number, DayResult>();
    let totalWorkedDays = 0;
    let positiveFm = 0;
    let negativeFm = 0;

    dayMap.forEach((dayPunches, dayNum) => {
      const dayResult = processDayPunches(dayPunches, settings);
      dayResult.day = dayNum;
      days.set(dayNum, dayResult);

      if (dayResult.status === "1") totalWorkedDays++;
      if (dayResult.status === "0.5") totalWorkedDays += 0.5;
      if (dayResult.fmMinutes > 0) positiveFm += dayResult.fmMinutes;
      if (dayResult.fmMinutes < 0) negativeFm += dayResult.fmMinutes;
    });

    results.set(enNo, {
      enNo,
      days,
      totalWorkedDays,
      totalFmMinutes: positiveFm + negativeFm, // NET
      positiveFmMinutes: positiveFm,
      negativeFmMinutes: negativeFm,
    });
  });

  return results;
}

/**
 * EmployeeMonthResult'ı daily_attendance kayıtlarına dönüştürür
 */
export function toAttendanceRecords(
  results: Map<number, EmployeeMonthResult>,
  periodId: number,
  enNoToEmployeeId: Map<number, number>
): InsertDailyAttendance[] {
  const records: InsertDailyAttendance[] = [];

  results.forEach((empResult, enNo) => {
    const employeeId = enNoToEmployeeId.get(enNo);
    if (!employeeId) return;

    empResult.days.forEach((dayResult, dayNum) => {
      records.push({
        periodId,
        employeeId,
        day: dayNum,
        status: dayResult.status,
        fmMinutes: dayResult.fmMinutes,
        source: dayResult.source,
        shiftStart: null,
        shiftEnd: null,
        actualStart: dayResult.actualStart,
        actualEnd: dayResult.actualEnd,
        breakMinutes: dayResult.breakMinutes,
        notes: dayResult.notes,
      });
    });
  });

  return records;
}

/**
 * Prim kesinti hesabı (kademeli kurallar)
 */
export function calculatePrimDeduction(
  unpaidLeaveDays: number,
  sickDays: number,
  deductiblePrim: number = 3000,
  rules?: Array<{ ruleType: string; dayCount: number; primPercentage: number }>
): { primDeduction: number; breakdown: string } {
  const defaultRules = [
    { ruleType: "ucretsiz_izin", dayCount: 1, primPercentage: 25 },
    { ruleType: "ucretsiz_izin", dayCount: 2, primPercentage: 50 },
    { ruleType: "ucretsiz_izin", dayCount: 3, primPercentage: 100 },
    { ruleType: "rapor", dayCount: 1, primPercentage: 0 },
    { ruleType: "rapor", dayCount: 2, primPercentage: 25 },
    { ruleType: "rapor", dayCount: 3, primPercentage: 50 },
    { ruleType: "rapor", dayCount: 4, primPercentage: 100 },
  ];

  const activeRules = rules || defaultRules;
  let percentage = 0;
  const parts: string[] = [];

  // Ücretsiz izin
  if (unpaidLeaveDays > 0) {
    const uiRules = activeRules
      .filter(r => r.ruleType === "ucretsiz_izin")
      .sort((a, b) => b.dayCount - a.dayCount);
    for (const rule of uiRules) {
      if (unpaidLeaveDays >= rule.dayCount) {
        percentage = Math.max(percentage, rule.primPercentage);
        parts.push(`Üİ ${unpaidLeaveDays}g → %${rule.primPercentage}`);
        break;
      }
    }
  }

  // Rapor
  if (sickDays > 0) {
    const rRules = activeRules
      .filter(r => r.ruleType === "rapor")
      .sort((a, b) => b.dayCount - a.dayCount);
    for (const rule of rRules) {
      if (sickDays >= rule.dayCount) {
        const rPerc = rule.primPercentage;
        percentage = Math.max(percentage, rPerc);
        parts.push(`R ${sickDays}g → %${rPerc}`);
        break;
      }
    }
  }

  const primDeduction = Math.round(deductiblePrim * percentage / 100);
  const breakdown = parts.length > 0 ? parts.join(", ") : "Kesinti yok";

  return { primDeduction, breakdown };
}
