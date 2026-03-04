import type { AttendanceRecord, DailyReport, EmployeeSummary, Holiday, Leave, WeeklyAssignment, WorkSchedule } from "@shared/schema";

const TURKISH_DAYS = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

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

interface LeaveInfo {
  type: string;
  status: string;
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
      lookup.set(key, { type: leave.type, status: leave.status });
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
): { schedule: ScheduleInfo; isOff: boolean } {
  const monday = getMonday(dateKey);
  const dayKey = DAY_KEYS[dayOfWeek];

  const assignment = assignments.find(a =>
    a.employeeId === employeeId && a.weekStartDate === monday
  );

  if (!assignment) {
    return { schedule: defaultSchedule, isOff: false };
  }

  const val = (assignment as any)[dayKey] as string | null;
  if (!val) return { schedule: defaultSchedule, isOff: false };
  if (val.toUpperCase() === "OFF") return { schedule: defaultSchedule, isOff: true };

  const scheduleId = parseInt(val);
  if (isNaN(scheduleId)) return { schedule: defaultSchedule, isOff: false };

  const ws = schedulesMap.get(scheduleId);
  if (!ws) return { schedule: defaultSchedule, isOff: false };

  const startMin = timeStringToMinutes(ws.startTime);
  const endMin = timeStringToMinutes(ws.endTime);
  const brk = ws.breakMinutes ?? 60;
  const crossesMidnight = endMin <= startMin;
  const totalMinutes = crossesMidnight ? (1440 - startMin + endMin) : (endMin - startMin);
  const expectedNet = totalMinutes - brk;

  return {
    schedule: { startMinutes: startMin, endMinutes: endMin, breakMinutes: brk, expectedNetWork: expectedNet, name: ws.name, crossesMidnight },
    isOff: false,
  };
}

export function processAttendanceData(
  records: AttendanceRecord[],
  settingsMap: Record<string, string>,
  holidaysList: Holiday[],
  leavesList: Leave[] = [],
  employeeIdMap: Map<number, number> = new Map(),
  assignments: WeeklyAssignment[] = [],
  schedules: WorkSchedule[] = []
): EmployeeSummary[] {
  const workStart = timeStringToMinutes(settingsMap.workStartTime || "08:00");
  const workEnd = timeStringToMinutes(settingsMap.workEndTime || "00:00");
  const dailyWorkMinutes = parseInt(settingsMap.dailyWorkMinutes || "540");
  const breakMinutes = parseInt(settingsMap.breakMinutes || "60");
  const overtimeThreshold = parseInt(settingsMap.overtimeThreshold || "15");
  const lateTolerance = parseInt(settingsMap.lateToleranceMinutes || "5");
  const earlyLeaveTolerance = parseInt(settingsMap.earlyLeaveToleranceMinutes || "5");
  const autoDeductBreak = settingsMap.autoDeductBreak !== "false";
  const minValidWork = parseInt(settingsMap.minValidWorkMinutes || "30");
  const maxValidWork = parseInt(settingsMap.maxValidWorkMinutes || "960");

  const crossesMidnightDefault = workEnd <= workStart && workEnd !== 0;
  const totalDefault = crossesMidnightDefault ? (1440 - workStart + workEnd) : (workEnd === 0 ? (1440 - workStart) : (workEnd - workStart));
  const expectedNetWork = totalDefault - (autoDeductBreak ? breakMinutes : 0);

  const defaultSchedule: ScheduleInfo = {
    startMinutes: workStart,
    endMinutes: workEnd,
    breakMinutes,
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

  const assignmentsByEmpId = assignments;

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

    const empAssignments = empId
      ? assignmentsByEmpId.filter(a => a.employeeId === empId)
      : [];

    const byDate = new Map<string, Date[]>();
    for (const rec of data.records) {
      const dt = new Date(rec.dateTime);
      const dateKey = localDateKey(dt);
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(dt);
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

    const sortedDates = Array.from(byDate.keys()).sort();

    for (const dateKey of sortedDates) {
      const punches = byDate.get(dateKey)!.sort((a, b) => a.getTime() - b.getTime());
      const dateObj = new Date(dateKey + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const dayName = TURKISH_DAYS[dayOfWeek];
      const holiday = holidayDates.get(dateKey);
      const isHoliday = !!holiday;
      const leaveKey = `${enNo}_${dateKey}`;
      const leaveInfo = leaveLookup.get(leaveKey);
      const isOnLeave = !!leaveInfo;

      const { schedule, isOff } = empId
        ? getScheduleForDay(empId, dateKey, dayOfWeek, empAssignments, schedulesMap, defaultSchedule)
        : { schedule: defaultSchedule, isOff: false };

      let salaryMultiplier = 1;

      const filteredPunches: Date[] = [];
      for (let i = 0; i < punches.length; i++) {
        if (i > 0) {
          const diff = (punches[i].getTime() - punches[i - 1].getTime()) / 60000;
          if (diff < 2) continue;
        }
        filteredPunches.push(punches[i]);
      }

      const pairs: { in: string; out: string }[] = [];
      const statuses: string[] = [];

      for (let i = 0; i < filteredPunches.length; i += 2) {
        if (i + 1 < filteredPunches.length) {
          pairs.push({ in: formatTime(filteredPunches[i]), out: formatTime(filteredPunches[i + 1]) });
        } else {
          pairs.push({ in: formatTime(filteredPunches[i]), out: "--:--" });
        }
      }

      if (filteredPunches.length % 2 !== 0) {
        statuses.push("Eksik Kayit");
        issueCount++;
      }

      let dayWorkMinutes = 0;
      for (let i = 0; i < filteredPunches.length - 1; i += 2) {
        const inTime = filteredPunches[i];
        const outTime = filteredPunches[i + 1];
        if (outTime) {
          dayWorkMinutes += (outTime.getTime() - inTime.getTime()) / 60000;
        }
      }

      let netWork = autoDeductBreak ? Math.max(0, dayWorkMinutes - schedule.breakMinutes) : dayWorkMinutes;

      if (dayWorkMinutes > 0 && dayWorkMinutes < minValidWork) {
        statuses.push("Cok Kisa");
        issueCount++;
      }
      if (dayWorkMinutes > maxValidWork) {
        statuses.push("Cok Uzun");
        issueCount++;
      }
      if (filteredPunches.length > 4) {
        statuses.push("Coklu Okutma");
        issueCount++;
      }

      let lateMinutes = 0;
      let earlyLeaveMin = 0;
      let overtimeMin = 0;
      let deficitMin = 0;

      if (isOnLeave) {
        statuses.push("Izinli");
        leaveDays++;
      } else if (isOff) {
        if (filteredPunches.length > 0) {
          statuses.push("Off Gunu Calisma");
          overtimeMin = netWork;
          salaryMultiplier = 1.5;
        } else {
          statuses.push("Off");
        }
        offDays++;
      } else if (filteredPunches.length > 0) {
        workDays++;
        const firstIn = minutesSinceMidnight(filteredPunches[0]);
        if (firstIn > schedule.startMinutes + lateTolerance) {
          lateMinutes = firstIn - schedule.startMinutes;
          statuses.push("Gec");
          lateDays++;
        }

        if (filteredPunches.length >= 2) {
          const lastOut = minutesSinceMidnight(filteredPunches[filteredPunches.length - 1]);
          const effectiveEnd = schedule.crossesMidnight ? (schedule.endMinutes || 1440) : schedule.endMinutes;
          if (filteredPunches.length % 2 === 0 && !schedule.crossesMidnight && lastOut < effectiveEnd - earlyLeaveTolerance) {
            earlyLeaveMin = effectiveEnd - lastOut;
            statuses.push("Erken Cikis");
            earlyLeaveDays++;
          }
        }

        if (netWork > schedule.expectedNetWork + overtimeThreshold) {
          overtimeMin = netWork - schedule.expectedNetWork;
          statuses.push("Mesai");
        } else if (netWork < schedule.expectedNetWork && filteredPunches.length % 2 === 0) {
          deficitMin = schedule.expectedNetWork - netWork;
        }
      }

      if (isHoliday && filteredPunches.length > 0) {
        statuses.push("Tatil Calisma");
        overtimeMin = netWork;
        salaryMultiplier = holiday?.salaryMultiplier || 2;
      }

      if (isHoliday && filteredPunches.length === 0) {
        salaryMultiplier = holiday?.salaryMultiplier || 2;
      }

      if (statuses.length === 0 && filteredPunches.length > 0) {
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
      });
    }

    summaries.push({
      enNo,
      name: capitalizedName,
      workDays,
      totalWorkMinutes: Math.round(totalWorkMin),
      avgDailyMinutes: workDays > 0 ? Math.round(totalWorkMin / workDays) : 0,
      totalOvertimeMinutes: Math.round(totalOvertimeMin),
      totalDeficitMinutes: Math.round(totalDeficitMin),
      lateDays,
      earlyLeaveDays,
      issueCount,
      offDays,
      leaveDays,
      dailyReports,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
