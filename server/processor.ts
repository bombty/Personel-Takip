import type { AttendanceRecord, DailyReport, EmployeeSummary, Holiday, Leave } from "@shared/schema";

const TURKISH_DAYS = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"];

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

export function processAttendanceData(
  records: AttendanceRecord[],
  settingsMap: Record<string, string>,
  holidaysList: Holiday[],
  leavesList: Leave[] = [],
  employeeIdMap: Map<number, number> = new Map()
): EmployeeSummary[] {
  const workStart = timeStringToMinutes(settingsMap.workStartTime || "08:30");
  const workEnd = timeStringToMinutes(settingsMap.workEndTime || "17:30");
  const dailyWorkMinutes = parseInt(settingsMap.dailyWorkMinutes || "540");
  const breakMinutes = parseInt(settingsMap.breakMinutes || "60");
  const overtimeThreshold = parseInt(settingsMap.overtimeThreshold || "15");
  const lateTolerance = parseInt(settingsMap.lateToleranceMinutes || "5");
  const earlyLeaveTolerance = parseInt(settingsMap.earlyLeaveToleranceMinutes || "5");
  const weekendDays = (settingsMap.weekendDays || "6,0").split(",").map(Number);
  const autoDeductBreak = settingsMap.autoDeductBreak !== "false";
  const minValidWork = parseInt(settingsMap.minValidWorkMinutes || "30");
  const maxValidWork = parseInt(settingsMap.maxValidWorkMinutes || "960");
  const expectedNetWork = dailyWorkMinutes - (autoDeductBreak ? breakMinutes : 0);

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

    const byDate = new Map<string, Date[]>();
    for (const rec of data.records) {
      const dt = new Date(rec.dateTime);
      const dateKey = localDateKey(dt);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(dt);
    }

    const dailyReports: DailyReport[] = [];
    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalDeficitMinutes = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;
    let issueCount = 0;
    let workDays = 0;

    const sortedDates = Array.from(byDate.keys()).sort();

    for (const dateKey of sortedDates) {
      const punches = byDate.get(dateKey)!.sort((a, b) => a.getTime() - b.getTime());
      const dateObj = new Date(dateKey + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const dayName = TURKISH_DAYS[dayOfWeek];
      const isWeekend = weekendDays.includes(dayOfWeek);
      const holiday = holidayDates.get(dateKey);
      const isHoliday = !!holiday;
      const leaveKey = `${enNo}_${dateKey}`;
      const leaveInfo = leaveLookup.get(leaveKey);
      const isOnLeave = !!leaveInfo;
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
          pairs.push({
            in: formatTime(filteredPunches[i]),
            out: formatTime(filteredPunches[i + 1]),
          });
        } else {
          pairs.push({
            in: formatTime(filteredPunches[i]),
            out: "--:--",
          });
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

      let netWork = autoDeductBreak ? Math.max(0, dayWorkMinutes - breakMinutes) : dayWorkMinutes;

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
      } else if (!isWeekend && !isHoliday && filteredPunches.length > 0) {
        workDays++;
        const firstIn = minutesSinceMidnight(filteredPunches[0]);
        if (firstIn > workStart + lateTolerance) {
          lateMinutes = firstIn - workStart;
          statuses.push("Gec");
          lateDays++;
        }

        if (filteredPunches.length >= 2) {
          const lastOut = minutesSinceMidnight(filteredPunches[filteredPunches.length - 1]);
          if (filteredPunches.length % 2 === 0 && lastOut < workEnd - earlyLeaveTolerance) {
            earlyLeaveMin = workEnd - lastOut;
            statuses.push("Erken Cikis");
            earlyLeaveDays++;
          }
        }

        if (netWork > expectedNetWork + overtimeThreshold) {
          overtimeMin = netWork - expectedNetWork;
          statuses.push("Mesai");
        } else if (netWork < expectedNetWork && filteredPunches.length % 2 === 0) {
          deficitMin = expectedNetWork - netWork;
        }
      }

      if (isWeekend && filteredPunches.length > 0) {
        statuses.push("Hafta Sonu Calisma");
        overtimeMin = netWork;
        salaryMultiplier = 1.5;
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

      totalWorkMinutes += dayWorkMinutes;
      totalOvertimeMinutes += overtimeMin;
      totalDeficitMinutes += deficitMin;

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
        isWeekend,
        isHoliday,
        holidayName: holiday?.name,
        salaryMultiplier,
        isOnLeave,
        leaveType: leaveInfo?.type,
      });
    }

    summaries.push({
      enNo,
      name: capitalizedName,
      workDays,
      totalWorkMinutes: Math.round(totalWorkMinutes),
      avgDailyMinutes: workDays > 0 ? Math.round(totalWorkMinutes / workDays) : 0,
      totalOvertimeMinutes: Math.round(totalOvertimeMinutes),
      totalDeficitMinutes: Math.round(totalDeficitMinutes),
      lateDays,
      earlyLeaveDays,
      issueCount,
      dailyReports,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
