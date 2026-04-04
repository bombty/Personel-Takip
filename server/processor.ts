import type { AttendanceRecord, DailyReport, EmployeeSummary, Holiday, Leave, WeeklyAssignment, WorkSchedule, WeeklyBreakdown, Employee, LeaveBreakdown } from "@shared/schema";
import { leaveTypes } from "@shared/schema";

const TURKISH_DAYS = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const NIGHT_CUTOFF_HOUR = 7;
const STORE_CLOSED_START = 150;
const STORE_CLOSED_END = 420;

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

function nextDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return localDateKey(d);
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

function getSunday(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return localDateKey(d);
}

function assignWorkDay(dt: Date): string {
  const hour = dt.getHours();
  const calendarDate = localDateKey(dt);
  if (hour < NIGHT_CUTOFF_HOUR) {
    return prevDateKey(calendarDate);
  }
  return calendarDate;
}

function crossesClosedWindow(p1: Date, p2: Date): boolean {
  const min1 = minutesSinceMidnight(p1);
  const min2 = minutesSinceMidnight(p2);
  const diffMinutes = (p2.getTime() - p1.getTime()) / 60000;

  if (diffMinutes < 120) return false;

  const p1BeforeClosed = min1 < STORE_CLOSED_START;
  const p2AfterClosed = min2 >= STORE_CLOSED_END;

  if (p1BeforeClosed && p2AfterClosed) {
    return true;
  }

  if (min1 < STORE_CLOSED_START && min2 < STORE_CLOSED_START && diffMinutes > 240) {
    return true;
  }

  if (min1 >= STORE_CLOSED_END && p2AfterClosed && diffMinutes > 600) {
    return true;
  }

  return false;
}

function splitPunchesByClosedWindow(
  punches: Date[],
  workDayKey: string
): { before: Date[]; after: Date[]; wasSplit: boolean } {
  if (punches.length < 2) return { before: punches, after: [], wasSplit: false };

  const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime());

  for (let i = 0; i < sorted.length - 1; i++) {
    if (crossesClosedWindow(sorted[i], sorted[i + 1])) {
      return {
        before: sorted.slice(0, i + 1),
        after: sorted.slice(i + 1),
        wasSplit: true,
      };
    }
  }

  return { before: sorted, after: [], wasSplit: false };
}

interface LeaveInfo {
  type: string;
  status: string;
  conflictResolved: boolean;
  leaveId: number;
}

function buildLeaveLookup(leavesList: Leave[], employeeIdMap: Map<number, number>): Map<string, LeaveInfo> {
  const lookup = new Map<string, LeaveInfo>();
  for (const leave of leavesList) {
    if (leave.status !== "approved") continue;
    const enNo = employeeIdMap.get(leave.employeeId);
    if (enNo === undefined) continue;
    const start = new Date(leave.startDate + "T00:00:00");
    const end = new Date(leave.endDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${enNo}_${localDateKey(d)}`;
      lookup.set(key, {
        type: leave.type,
        status: leave.status,
        conflictResolved: leave.conflictResolved === true,
        leaveId: leave.id,
      });
    }
  }
  return lookup;
}

interface ScheduleInfo {
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  expectedNetWork: number;
  name: string;
  crossesMidnight: boolean;
}

function getScheduleForDay(
  employeeId: number,
  dateKey: string,
  dayOfWeek: number,
  assignments: WeeklyAssignment[],
  schedulesMap: Map<number, WorkSchedule>,
  defaultSchedule: ScheduleInfo
): { schedule: ScheduleInfo; isOff: boolean; hasAssignment: boolean } {
  const monday = getMonday(dateKey);
  const dayKey = DAY_KEYS[dayOfWeek];

  const assignment = assignments.find(a =>
    a.employeeId === employeeId && a.weekStartDate === monday
  );

  if (!assignment) {
    return { schedule: defaultSchedule, isOff: false, hasAssignment: false };
  }

  const val = (assignment as any)[dayKey] as string | null;
  if (!val) return { schedule: defaultSchedule, isOff: false, hasAssignment: false };
  if (val.toUpperCase() === "OFF") return { schedule: defaultSchedule, isOff: true, hasAssignment: true };

  const scheduleId = parseInt(val);
  if (isNaN(scheduleId)) return { schedule: defaultSchedule, isOff: false, hasAssignment: false };

  const ws = schedulesMap.get(scheduleId);
  if (!ws) return { schedule: defaultSchedule, isOff: false, hasAssignment: false };

  const startMin = timeStringToMinutes(ws.startTime);
  const endMin = timeStringToMinutes(ws.endTime);
  const brk = ws.breakMinutes ?? 60;
  const crossesMidnight = endMin <= startMin;
  const totalMinutes = crossesMidnight ? (1440 - startMin + endMin) : (endMin - startMin);
  const expectedNet = totalMinutes - brk;

  return {
    schedule: { startMinutes: startMin, endMinutes: endMin, breakMinutes: brk, expectedNetWork: expectedNet, name: ws.name, crossesMidnight },
    isOff: false,
    hasAssignment: true,
  };
}

interface PunchResult {
  pairs: { in: string; out: string }[];
  workMinutes: number;
  breakDeducted: boolean;
  classification?: string;
  breakMinutesActual?: number;
  warnings: string[];
}

function buildPairsFromPunches(filteredPunches: Date[], scheduleBreakMinutes: number = 60): PunchResult {
  const count = filteredPunches.length;
  const pairs: { in: string; out: string }[] = [];
  let workMinutes = 0;
  let breakDeducted = false;
  let classification: string | undefined;
  let breakMinutesActual: number | undefined;
  const warnings: string[] = [];

  if (count === 0) {
    return { pairs, workMinutes: 0, breakDeducted: false, warnings };
  }

  if (count === 1) {
    pairs.push({ in: formatTime(filteredPunches[0]), out: "--:--" });
    return { pairs, workMinutes: 0, breakDeducted: false, warnings };
  }

  if (count === 2) {
    pairs.push({ in: formatTime(filteredPunches[0]), out: formatTime(filteredPunches[1]) });
    workMinutes = (filteredPunches[1].getTime() - filteredPunches[0].getTime()) / 60000;
    return { pairs, workMinutes, breakDeducted: false, warnings };
  }

  if (count === 3) {
    const gap01 = (filteredPunches[1].getTime() - filteredPunches[0].getTime()) / 60000;
    const gap12 = (filteredPunches[2].getTime() - filteredPunches[1].getTime()) / 60000;
    const totalBrut = (filteredPunches[2].getTime() - filteredPunches[0].getTime()) / 60000;

    if (totalBrut < 300) {
      classification = "C";
      pairs.push({ in: formatTime(filteredPunches[0]), out: formatTime(filteredPunches[2]) });
      workMinutes = totalBrut;
      warnings.push("Gercek Eksik");
    } else if (gap01 < gap12 && gap01 < 180) {
      classification = "B";
      const estimatedBreak = Math.min(Math.max(gap01, 30), 90);
      pairs.push({ in: formatTime(filteredPunches[0]), out: formatTime(filteredPunches[1]) });
      pairs.push({ in: formatTime(filteredPunches[2]), out: "--:--" });
      workMinutes = totalBrut - estimatedBreak;
      breakDeducted = true;
      breakMinutesActual = Math.round(gap01);
      warnings.push("Mola Basi Eksik");
    } else {
      classification = "A";
      const estimatedBreak = Math.min(Math.max(gap12, 30), 90);
      pairs.push({ in: formatTime(filteredPunches[0]), out: "--:--" });
      pairs.push({ in: formatTime(filteredPunches[1]), out: formatTime(filteredPunches[2]) });
      workMinutes = totalBrut - estimatedBreak;
      breakDeducted = true;
      breakMinutesActual = Math.round(gap12);
      warnings.push("Mola Donus Eksik");
    }
    return { pairs, workMinutes, breakDeducted, classification, breakMinutesActual, warnings };
  }

  if (count === 4) {
    const breakDuration = (filteredPunches[2].getTime() - filteredPunches[1].getTime()) / 60000;
    breakMinutesActual = Math.round(breakDuration);

    const seg1 = (filteredPunches[1].getTime() - filteredPunches[0].getTime()) / 60000;
    const seg2 = (filteredPunches[3].getTime() - filteredPunches[2].getTime()) / 60000;

    if (breakDuration < 10) {
      // Çok kısa ara → çift giriş şüphesi, tek blok olarak değerlendir
      warnings.push("Cift Giris Suphesi");
      pairs.push({ in: formatTime(filteredPunches[0]), out: formatTime(filteredPunches[3]) });
      workMinutes = (filteredPunches[3].getTime() - filteredPunches[0].getTime()) / 60000;
      breakDeducted = false;
    } else {
      pairs.push({ in: formatTime(filteredPunches[0]), out: formatTime(filteredPunches[1]) });
      pairs.push({ in: formatTime(filteredPunches[2]), out: formatTime(filteredPunches[3]) });
      // Gerçek çalışma = sadece iki segment toplamı (mola hiç sayılmaz)
      workMinutes = seg1 + seg2;
      breakDeducted = true;
      if (breakDuration > scheduleBreakMinutes) {
        // Mola süresi izin verilen limiti aştı → fazla mola maaştan kesilir
        warnings.push("Uygunsuz Mola");
      }
    }
    return { pairs, workMinutes, breakDeducted, breakMinutesActual, warnings };
  }

  for (let i = 0; i < count - 1; i += 2) {
    if (i + 1 < count) {
      pairs.push({ in: formatTime(filteredPunches[i]), out: formatTime(filteredPunches[i + 1]) });
      workMinutes += (filteredPunches[i + 1].getTime() - filteredPunches[i].getTime()) / 60000;
    } else {
      pairs.push({ in: formatTime(filteredPunches[i]), out: "--:--" });
    }
  }
  if (count % 2 !== 0) {
    pairs.push({ in: formatTime(filteredPunches[count - 1]), out: "--:--" });
  }
  breakDeducted = count >= 4;
  return { pairs, workMinutes, breakDeducted, warnings };
}

function buildWeeklyBreakdown(dailyReports: DailyReport[], weeklyExpectedMinutes: number): WeeklyBreakdown[] {
  const weekMap = new Map<string, DailyReport[]>();

  for (const report of dailyReports) {
    const monday = getMonday(report.date);
    if (!weekMap.has(monday)) {
      weekMap.set(monday, []);
    }
    weekMap.get(monday)!.push(report);
  }

  const breakdown: WeeklyBreakdown[] = [];
  const sortedWeeks = Array.from(weekMap.keys()).sort();

  for (const monday of sortedWeeks) {
    const reports = weekMap.get(monday)!;
    const sunday = getSunday(monday);
    const workDays = reports.filter(r => !r.isOffDay && !r.isOnLeave && r.punchCount >= 2).length;
    const totalMinutes = reports.reduce((sum, r) => sum + r.netWorkMinutes, 0);
    const overtimeMinutes = Math.max(0, totalMinutes - weeklyExpectedMinutes);
    const deficitMinutes = Math.max(0, weeklyExpectedMinutes - totalMinutes);

    breakdown.push({
      weekStart: monday,
      weekEnd: sunday,
      totalMinutes: Math.round(totalMinutes),
      expectedMinutes: weeklyExpectedMinutes,
      overtimeMinutes: Math.round(overtimeMinutes),
      deficitMinutes: Math.round(deficitMinutes),
      workDays,
    });
  }

  return breakdown;
}

function calculateMonthlyExpectedHours(
  employeeId: number | undefined,
  enNo: number,
  monthStart: string,
  monthEnd: string,
  assignments: WeeklyAssignment[],
  leaveLookup: Map<string, LeaveInfo>,
  holidayDates: Map<string, Holiday>,
  schedulesMap: Map<number, WorkSchedule>,
  defaultSchedule: ScheduleInfo,
  dailyExpectedMinutes: number,
  hireDate?: string | null,
  leaveDate?: string | null
): number {
  let workDays = 0;
  const current = new Date(monthStart + "T00:00:00");
  const end = new Date(monthEnd + "T00:00:00");

  while (current <= end) {
    const dateStr = localDateKey(current);
    const dayOfWeek = current.getDay();

    if (hireDate && dateStr < hireDate) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    if (leaveDate && dateStr > leaveDate) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    if (employeeId) {
      const { isOff } = getScheduleForDay(employeeId, dateStr, dayOfWeek, assignments, schedulesMap, defaultSchedule);
      if (isOff) {
        current.setDate(current.getDate() + 1);
        continue;
      }
    }

    if (holidayDates.has(dateStr)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const leaveKey = `${enNo}_${dateStr}`;
    if (leaveLookup.has(leaveKey)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    workDays++;
    current.setDate(current.getDate() + 1);
  }

  return Math.round((workDays * dailyExpectedMinutes) / 60 * 10) / 10;
}

export function processAttendanceData(
  records: AttendanceRecord[],
  settingsMap: Record<string, string>,
  holidaysList: Holiday[],
  leavesList: Leave[] = [],
  employeeIdMap: Map<number, number> = new Map(),
  assignments: WeeklyAssignment[] = [],
  schedules: WorkSchedule[] = [],
  employeesList: Employee[] = []
): EmployeeSummary[] {
  const workStart = timeStringToMinutes(settingsMap.workStartTime || "08:00");
  const workEnd = timeStringToMinutes(settingsMap.workEndTime || "00:00");
  const dailyWorkMinutes = parseInt(settingsMap.dailyWorkMinutes || "540");
  const breakMinutesDefault = parseInt(settingsMap.breakMinutes || "60");
  const overtimeThreshold = parseInt(settingsMap.overtimeThreshold || "15");
  const lateTolerance = parseInt(settingsMap.lateToleranceMinutes || "5");
  const earlyLeaveTolerance = parseInt(settingsMap.earlyLeaveToleranceMinutes || "5");
  const autoDeductBreak = settingsMap.autoDeductBreak !== "false";
  const minValidWork = parseInt(settingsMap.minValidWorkMinutes || "30");
  const maxValidWork = parseInt(settingsMap.maxValidWorkMinutes || "960");
  const fullTimeWeeklyHours = parseInt(settingsMap.fullTimeWeeklyHours || "45");
  const partTimeWeeklyHours = parseInt(settingsMap.partTimeWeeklyHours || "30");
  const dailyOvertimeThreshold = parseInt(settingsMap.dailyOvertimeThresholdMinutes || "660");

  const crossesMidnightDefault = workEnd <= workStart && workEnd !== 0;
  const totalDefault = crossesMidnightDefault ? (1440 - workStart + workEnd) : (workEnd === 0 ? (1440 - workStart) : (workEnd - workStart));
  const expectedNetWork = totalDefault - (autoDeductBreak ? breakMinutesDefault : 0);

  const defaultSchedule: ScheduleInfo = {
    startMinutes: workStart,
    endMinutes: workEnd,
    breakMinutes: breakMinutesDefault,
    expectedNetWork,
    name: "Varsayilan",
    crossesMidnight: workEnd <= workStart,
  };

  const schedulesMap = new Map<number, WorkSchedule>();
  for (const s of schedules) {
    schedulesMap.set(s.id, s);
  }

  const enNoToEmployeeId = new Map<number, number>();
  for (const [empId, enNo] of employeeIdMap) {
    enNoToEmployeeId.set(enNo, empId);
  }

  const employeeByEnNo = new Map<number, Employee>();
  for (const emp of employeesList) {
    employeeByEnNo.set(emp.enNo, emp);
  }

  const holidayDates = new Map<string, Holiday>();
  for (const h of holidaysList) {
    holidayDates.set(h.date, h);
  }

  const leaveLookup = buildLeaveLookup(leavesList, employeeIdMap);

  const byEmployee = new Map<number, { name: string; records: AttendanceRecord[] }>();
  for (const record of records) {
    if (!byEmployee.has(record.enNo)) {
      byEmployee.set(record.enNo, { name: record.name, records: [] });
    }
    byEmployee.get(record.enNo)!.records.push(record);
  }

  const summaries: EmployeeSummary[] = [];

  for (const [enNo, data] of byEmployee) {
    const capitalizedName = data.name
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    const empId = enNoToEmployeeId.get(enNo);
    const empRecord = employeeByEnNo.get(enNo);
    const employmentType = empRecord?.employmentType || "full_time";
    const weeklyHours = empRecord?.weeklyHours ||
      (employmentType === "full_time" ? fullTimeWeeklyHours : partTimeWeeklyHours);
    const weeklyExpectedMinutes = weeklyHours * 60;

    const empAssignments = empId
      ? assignments.filter(a => a.employeeId === empId)
      : [];

    const hasAnyAssignment = empAssignments.length > 0;

    const byWorkDay = new Map<string, { punches: Date[]; hasNightCrossing: boolean }>();
    for (const rec of data.records) {
      const dt = new Date(rec.dateTime);
      const workDay = assignWorkDay(dt);
      if (!byWorkDay.has(workDay)) {
        byWorkDay.set(workDay, { punches: [], hasNightCrossing: false });
      }
      const entry = byWorkDay.get(workDay)!;
      entry.punches.push(dt);
      if (dt.getHours() < NIGHT_CUTOFF_HOUR) {
        entry.hasNightCrossing = true;
      }
    }

    const closedWindowSplits: { dateKey: string; afterPunches: Date[] }[] = [];
    for (const [dateKey, dayData] of byWorkDay) {
      const sorted = dayData.punches.sort((a, b) => a.getTime() - b.getTime());
      const { before, after, wasSplit } = splitPunchesByClosedWindow(sorted, dateKey);
      if (wasSplit && after.length > 0) {
        dayData.punches = before;
        const nextDay = nextDateKey(dateKey);
        closedWindowSplits.push({ dateKey: nextDay, afterPunches: after });
      }
    }

    for (const split of closedWindowSplits) {
      if (!byWorkDay.has(split.dateKey)) {
        byWorkDay.set(split.dateKey, { punches: [], hasNightCrossing: false });
      }
      const entry = byWorkDay.get(split.dateKey)!;
      entry.punches.push(...split.afterPunches);
    }

    const punchDates = Array.from(byWorkDay.keys()).sort();
    const punchMinDate = punchDates.length > 0 ? punchDates[0] : null;
    const punchMaxDate = punchDates.length > 0 ? punchDates[punchDates.length - 1] : null;

    if (punchMinDate && punchMaxDate) {
      for (const [key, info] of leaveLookup) {
        const parts = key.split("_");
        const leaveEnNo = parseInt(parts[0]);
        if (leaveEnNo !== enNo) continue;
        const dateKey = parts.slice(1).join("_");
        if (dateKey >= punchMinDate && dateKey <= punchMaxDate && !byWorkDay.has(dateKey)) {
          byWorkDay.set(dateKey, { punches: [], hasNightCrossing: false });
        }
      }
    }

    if (empId && punchMinDate && punchMaxDate) {
      const msDate = new Date(punchMinDate + "T00:00:00");
      const meDate = new Date(punchMaxDate + "T00:00:00");
      const fillStart = new Date(msDate.getFullYear(), msDate.getMonth(), 1);
      const fillEnd = new Date(meDate.getFullYear(), meDate.getMonth() + 1, 0);
      const cur = new Date(fillStart);
      while (cur <= fillEnd) {
        const dk = localDateKey(cur);
        if (!byWorkDay.has(dk)) {
          if (empRecord?.hireDate && dk < empRecord.hireDate) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          if (empRecord?.leaveDate && dk > empRecord.leaveDate) {
            cur.setDate(cur.getDate() + 1);
            continue;
          }
          const dayOfWeek = cur.getDay();
          const { isOff } = getScheduleForDay(empId, dk, dayOfWeek, empAssignments, schedulesMap, defaultSchedule);
          if (isOff) {
            byWorkDay.set(dk, { punches: [], hasNightCrossing: false });
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const dailyReports: DailyReport[] = [];
    let totalWorkMin = 0;
    let totalOvertimeMin = 0;
    let totalDeficitMin = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;
    let issueCount = 0;
    let workDays = 0;
    let offDays = 0;
    let leaveDays = 0;
    const leaveTypeCounts = new Map<string, number>();

    const sortedDates = Array.from(byWorkDay.keys()).sort();

    for (const dateKey of sortedDates) {
      if (empRecord?.hireDate && dateKey < empRecord.hireDate) continue;
      if (empRecord?.leaveDate && dateKey > empRecord.leaveDate) continue;

      const dayData = byWorkDay.get(dateKey)!;
      const allPunches = dayData.punches.sort((a, b) => a.getTime() - b.getTime());
      const nightCrossing = dayData.hasNightCrossing;

      const dateObj = new Date(dateKey + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const dayName = TURKISH_DAYS[dayOfWeek];
      const holiday = holidayDates.get(dateKey);
      const isHoliday = !!holiday;
      const leaveKey = `${enNo}_${dateKey}`;
      const leaveInfo = leaveLookup.get(leaveKey);
      const isOnLeave = !!leaveInfo;

      const { schedule, isOff, hasAssignment } = empId
        ? getScheduleForDay(empId, dateKey, dayOfWeek, empAssignments, schedulesMap, defaultSchedule)
        : { schedule: defaultSchedule, isOff: false, hasAssignment: false };

      let salaryMultiplier = 1;

      const filteredPunches: Date[] = [];
      for (let i = 0; i < allPunches.length; i++) {
        if (i > 0) {
          const diff = (allPunches[i].getTime() - allPunches[i - 1].getTime()) / 60000;
          if (diff < 2) continue;
        }
        filteredPunches.push(allPunches[i]);
      }

      // Akıllı çift okutma tespiti: Mola dönüşü çift basıldıysa veya
      // 2-20 dakika arayla ardışık okutma varsa duplikat temizle.
      // Kural: duplikat olan okutmayı (ikinci olanı) kaldır, bunu raporla.
      let dupRemovedCount = 0;
      const deduped: Date[] = [];
      for (let i = 0; i < filteredPunches.length; i++) {
        if (i < filteredPunches.length - 1) {
          const gap = (filteredPunches[i + 1].getTime() - filteredPunches[i].getTime()) / 60000;
          // Çok kısa aralık (2-20 dk): bir sonraki okutma duplikattır
          if (gap >= 2 && gap < 20) {
            // Duplikatı atla (bir sonraki i zaten alınmayacak)
            deduped.push(filteredPunches[i]);
            i++; // duplikat okutmayı atla
            dupRemovedCount++;
            continue;
          }
        }
        deduped.push(filteredPunches[i]);
      }
      const finalPunches = dupRemovedCount > 0 ? deduped : filteredPunches;

      const punchCount = finalPunches.length;
      const rawPunchCount = filteredPunches.length; // duplikat temizlenmeden önce
      const statuses: string[] = [];
      if (dupRemovedCount > 0) {
        statuses.push(`Cift Okutma Duzeltildi (${rawPunchCount}->${punchCount})`);
      }

      const punchResult = buildPairsFromPunches(finalPunches, schedule.breakMinutes);
      const { pairs, workMinutes: dayWorkMinutes, breakDeducted, classification, breakMinutesActual } = punchResult;

      for (const w of punchResult.warnings) {
        statuses.push(w);
        if (w === "Gercek Eksik" || w === "Cift Giris Suphesi" || w === "Uygunsuz Mola" || w === "Mola Basi Eksik" || w === "Mola Donus Eksik") {
          issueCount++;
        }
      }

      if (punchCount === 1) {
        // Çıkış yapılmamış: o gün normal beklenen süre çalışmış varsay + şüphe işareti
        statuses.push("Eksik Cikis Suphesi");
        issueCount++;
      } else if (punchCount === 3 && !classification) {
        statuses.push("Eksik Okutma");
        issueCount++;
      } else if (punchCount === 3 && classification) {
        issueCount++;
      } else if (punchCount >= 5) {
        statuses.push("Coklu Okutma");
        issueCount++;
      } else if (punchCount % 2 !== 0 && punchCount > 1 && punchCount !== 3) {
        statuses.push("Eksik Kayit");
        issueCount++;
      }

      if (punchCount === 2 && dayWorkMinutes > 360) {
        statuses.push("Molasiz");
      }

      if (nightCrossing) {
        statuses.push("Gece Gecisi");
      }

      let netWork: number;
      if (punchCount === 1) {
        // Çıkış yapılmamış: kurallar gereği beklenen net süre çalışmış sayılır
        netWork = schedule.expectedNetWork;
      } else if (breakDeducted) {
        netWork = dayWorkMinutes;
      } else if (autoDeductBreak && punchCount >= 2) {
        netWork = Math.max(0, dayWorkMinutes - schedule.breakMinutes);
      } else {
        netWork = dayWorkMinutes;
      }

      if (dayWorkMinutes > 0 && dayWorkMinutes < minValidWork) {
        statuses.push("Cok Kisa");
        issueCount++;
      }
      if (dayWorkMinutes > maxValidWork) {
        statuses.push("Cok Uzun");
        issueCount++;
      }

      let lateMinutes = 0;
      let earlyLeaveMin = 0;
      let overtimeMin = 0;
      let deficitMin = 0;
      let leaveConflict = false;

      if (isOnLeave) {
        const leaveLabel = leaveTypes.find(t => t.value === leaveInfo?.type)?.label || "Izinli";
        statuses.push(leaveLabel);
        leaveDays++;
        const lt = leaveInfo?.type || "other";
        leaveTypeCounts.set(lt, (leaveTypeCounts.get(lt) || 0) + 1);

        if (punchCount > 0 && !leaveInfo?.conflictResolved) {
          leaveConflict = true;
          statuses.push("Izin Cakismasi");
        }
      } else if (isOff) {
        if (punchCount > 0) {
          statuses.push("Off Gunu Calisma");
          overtimeMin = netWork;
          salaryMultiplier = 1.5;
        } else {
          statuses.push("Off");
        }
        offDays++;
      } else if (punchCount > 0) {
        workDays++;

        const firstPunch = filteredPunches[0];
        const firstPunchHour = firstPunch.getHours();
        const firstPunchMin = minutesSinceMidnight(firstPunch);

        if (hasAssignment && firstPunchHour >= NIGHT_CUTOFF_HOUR) {
          if (firstPunchMin > schedule.startMinutes + lateTolerance) {
            lateMinutes = firstPunchMin - schedule.startMinutes;
            statuses.push("Gec");
            lateDays++;
          }
        }

        if (hasAssignment && punchCount >= 2) {
          const lastPunch = filteredPunches[filteredPunches.length - 1];
          const lastPunchHour = lastPunch.getHours();
          const lastPunchMin = minutesSinceMidnight(lastPunch);
          const lastIsNight = lastPunchHour < NIGHT_CUTOFF_HOUR;

          if (schedule.crossesMidnight || nightCrossing) {
            if (lastIsNight) {
              const effectiveEnd = schedule.endMinutes;
              if (effectiveEnd > 0 && lastPunchMin < effectiveEnd - earlyLeaveTolerance) {
                earlyLeaveMin = effectiveEnd - lastPunchMin;
                statuses.push("Erken Cikis");
                earlyLeaveDays++;
              }
            }
          } else if (!lastIsNight) {
            const effectiveEnd = schedule.endMinutes === 0 ? 1440 : schedule.endMinutes;
            if (lastPunchMin < effectiveEnd - earlyLeaveTolerance) {
              earlyLeaveMin = effectiveEnd - lastPunchMin;
              statuses.push("Erken Cikis");
              earlyLeaveDays++;
            }
          }
        }

        if (netWork > dailyOvertimeThreshold) {
          overtimeMin = netWork - schedule.expectedNetWork;
          statuses.push("Mesai");
        } else if (hasAssignment && netWork > schedule.expectedNetWork + overtimeThreshold) {
          overtimeMin = netWork - schedule.expectedNetWork;
          statuses.push("Mesai");
        }

        if (hasAssignment && netWork < schedule.expectedNetWork && punchCount >= 2 && punchCount % 2 === 0) {
          deficitMin = schedule.expectedNetWork - netWork;
        }
      }

      if (isHoliday && punchCount > 0) {
        statuses.push("Tatil Calisma");
        overtimeMin = netWork;
        salaryMultiplier = holiday?.salaryMultiplier || 2;
      }

      if (isHoliday && punchCount === 0) {
        salaryMultiplier = holiday?.salaryMultiplier || 2;
      }

      if (statuses.length === 0 && punchCount > 0) {
        statuses.push("Normal");
      }

      totalWorkMin += dayWorkMinutes;
      totalOvertimeMin += overtimeMin;
      totalDeficitMin += deficitMin;

      dailyReports.push({
        date: dateKey,
        dayName,
        punches: filteredPunches.map(p => formatTime(p)),
        pairs,
        totalWorkMinutes: Math.round(dayWorkMinutes),
        netWorkMinutes: Math.round(netWork),
        overtimeMinutes: Math.round(overtimeMin),
        deficitMinutes: Math.round(deficitMin),
        lateMinutes: Math.round(lateMinutes),
        earlyLeaveMinutes: Math.round(earlyLeaveMin),
        status: statuses,
        isWeekend: false,
        isHoliday,
        holidayName: holiday?.name,
        salaryMultiplier,
        isOnLeave,
        leaveType: leaveInfo?.type,
        isOffDay: isOff,
        scheduleName: schedule.name !== "Varsayilan" ? schedule.name : undefined,
        punchCount,
        nightCrossing,
        punchClassification: classification,
        breakMinutesActual,
        leaveConflict,
      });
    }

    const weeklyBreakdown = buildWeeklyBreakdown(dailyReports, weeklyExpectedMinutes);

    const totalWeeklyOvertime = weeklyBreakdown.reduce((sum, w) => sum + w.overtimeMinutes, 0);
    const totalWeeklyDeficit = weeklyBreakdown.reduce((sum, w) => sum + w.deficitMinutes, 0);

    const missingAssignmentWeeks: string[] = [];
    if (empId && punchMinDate && punchMaxDate) {
      const maStart = new Date(punchMinDate + "T00:00:00");
      const maEnd = new Date(punchMaxDate + "T00:00:00");
      const maMonStart = new Date(maStart.getFullYear(), maStart.getMonth(), 1);
      const maMonEnd = new Date(maEnd.getFullYear(), maEnd.getMonth() + 1, 0);
      const maCur = new Date(maMonStart);
      const checkedWeeks = new Set<string>();
      while (maCur <= maMonEnd) {
        const mon = getMonday(localDateKey(maCur));
        if (!checkedWeeks.has(mon)) {
          checkedWeeks.add(mon);
          const weekAssignment = empAssignments.find(a => a.weekStartDate === mon);
          if (!weekAssignment) {
            missingAssignmentWeeks.push(mon);
          }
        }
        maCur.setDate(maCur.getDate() + 1);
      }
    }

    const monthlyTotalHours = Math.round(totalWorkMin / 60 * 10) / 10;

    const netWorkTotal = dailyReports.reduce((sum, r) => sum + r.netWorkMinutes, 0);
    const monthlyTotalNetHours = Math.round(netWorkTotal / 60 * 10) / 10;

    const dailyExpectedForMonthly = hasAnyAssignment ? (weeklyExpectedMinutes / 6) : dailyWorkMinutes;

    let monthStartStr = punchMinDate || "";
    let monthEndStr = punchMaxDate || "";
    if (monthStartStr && monthEndStr) {
      const msDate = new Date(monthStartStr + "T00:00:00");
      const meDate = new Date(monthEndStr + "T00:00:00");
      const realMonthStart = new Date(msDate.getFullYear(), msDate.getMonth(), 1);
      const realMonthEnd = new Date(meDate.getFullYear(), meDate.getMonth() + 1, 0);
      monthStartStr = localDateKey(realMonthStart);
      monthEndStr = localDateKey(realMonthEnd);
    }

    const monthlyExpectedHours = monthStartStr && monthEndStr
      ? calculateMonthlyExpectedHours(
          empId,
          enNo,
          monthStartStr,
          monthEndStr,
          empAssignments,
          leaveLookup,
          holidayDates,
          schedulesMap,
          defaultSchedule,
          dailyExpectedForMonthly,
          empRecord?.hireDate,
          empRecord?.leaveDate
        )
      : 0;

    const performancePercent = monthlyExpectedHours > 0
      ? Math.round((monthlyTotalNetHours / monthlyExpectedHours) * 100)
      : 0;

    const leaveBreakdown: LeaveBreakdown[] = [];
    for (const [type, days] of leaveTypeCounts) {
      const label = leaveTypes.find(t => t.value === type)?.label || type;
      leaveBreakdown.push({ type, label, days });
    }
    leaveBreakdown.sort((a, b) => b.days - a.days);

    summaries.push({
      enNo,
      name: capitalizedName,
      department: empRecord?.department || undefined,
      branchId: empRecord?.branchId || undefined,
      employmentType,
      weeklyHoursExpected: weeklyHours,
      workDays,
      totalWorkMinutes: Math.round(totalWorkMin),
      avgDailyMinutes: workDays > 0 ? Math.round(totalWorkMin / workDays) : 0,
      totalOvertimeMinutes: Math.max(Math.round(totalOvertimeMin), totalWeeklyOvertime),
      totalDeficitMinutes: Math.max(Math.round(totalDeficitMin), totalWeeklyDeficit),
      lateDays,
      earlyLeaveDays,
      issueCount,
      offDays,
      leaveDays,
      leaveBreakdown,
      dailyReports,
      weeklyBreakdown,
      monthlyTotalHours,
      monthlyExpectedHours,
      performancePercent,
      missingAssignmentWeeks: missingAssignmentWeeks.length > 0 ? missingAssignmentWeeks : undefined,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
