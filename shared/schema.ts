import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, date, boolean, real, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").default(true),
});

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  enNo: integer("en_no").notNull(),
  name: text("name").notNull(),
  department: text("department"),
  position: text("position"),
  phone: text("phone"),
  hireDate: date("hire_date"),
  leaveDate: date("leave_date"),
  active: boolean("active").default(true),
  employmentType: text("employment_type").default("full_time"),
  weeklyHours: integer("weekly_hours").default(45),
  branchId: integer("branch_id"),
  annualLeaveQuota: integer("annual_leave_quota").default(14),
  fullName: text("full_name"), // AD SOYAD (maaş tablosundaki isim)
  positionId: integer("position_id"), // positions tablosuna FK
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id").notNull(),
  enNo: integer("en_no").notNull(),
  name: text("name").notNull(),
  dateTime: timestamp("date_time").notNull(),
  tmNo: integer("tm_no"),
  gmNo: integer("gm_no"),
  mode: integer("mode"),
  inOut: text("in_out"),
  antipass: text("antipass"),
  proxyWork: integer("proxy_work"),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true });
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  uploadDate: timestamp("upload_date").defaultNow(),
  totalRecords: integer("total_records").default(0),
  totalEmployees: integer("total_employees").default(0),
  status: text("status").default("processed"),
  branchId: integer("branch_id"),
});

export const insertUploadSchema = createInsertSchema(uploads).omit({ id: true, uploadDate: true });
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploads.$inferSelect;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  salaryMultiplier: real("salary_multiplier").default(1.5),
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidays.$inferSelect;

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  type: text("type").notNull(),
  status: text("status").default("approved"),
  notes: text("notes"),
  conflictResolved: boolean("conflict_resolved").default(false),
});

export const insertLeaveSchema = createInsertSchema(leaves).omit({ id: true });
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leaves.$inferSelect;

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startMonth: integer("start_month").notNull(),
  endMonth: integer("end_month").notNull(),
  weekdayOpen: text("weekday_open").notNull(),
  weekdayClose: text("weekday_close").notNull(),
  weekendOpen: text("weekend_open").notNull(),
  weekendClose: text("weekend_close").notNull(),
  weekendDays: text("weekend_days").default("5,6"),
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasons.$inferSelect;

export const workSchedules = pgTable("work_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").default(60),
  shortCode: text("short_code"),
});

export const insertWorkScheduleSchema = createInsertSchema(workSchedules).omit({ id: true });
export type InsertWorkSchedule = z.infer<typeof insertWorkScheduleSchema>;
export type WorkSchedule = typeof workSchedules.$inferSelect;

export const weeklyAssignments = pgTable("weekly_assignments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  weekStartDate: date("week_start_date").notNull(),
  monday: text("monday"),
  tuesday: text("tuesday"),
  wednesday: text("wednesday"),
  thursday: text("thursday"),
  friday: text("friday"),
  saturday: text("saturday"),
  sunday: text("sunday"),
});

export const insertWeeklyAssignmentSchema = createInsertSchema(weeklyAssignments).omit({ id: true });
export type InsertWeeklyAssignment = z.infer<typeof insertWeeklyAssignmentSchema>;
export type WeeklyAssignment = typeof weeklyAssignments.$inferSelect;

export const reportPeriods = pgTable("report_periods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  uploadIds: text("upload_ids"),
  status: text("status").default("draft"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
});

export const insertReportPeriodSchema = createInsertSchema(reportPeriods).omit({ id: true, createdAt: true, finalizedAt: true });
export type InsertReportPeriod = z.infer<typeof insertReportPeriodSchema>;
export type ReportPeriod = typeof reportPeriods.$inferSelect;

// ===== YENİ TABLOLAR (Sprint 1) =====

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  baseSalary: integer("base_salary").notNull(),
  totalSalary: integer("total_salary").notNull(),
  kasaPrim: integer("kasa_prim").default(0),
  performansPrim: integer("performans_prim").default(0),
  description: text("description"),
  active: boolean("active").default(true),
});

export const insertPositionSchema = createInsertSchema(positions).omit({ id: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export const employeeAliases = pgTable("employee_aliases", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  aliasName: text("alias_name").notNull(),
  source: text("source").default("manual"), // manual | pdks | ai
});

export const insertEmployeeAliasSchema = createInsertSchema(employeeAliases).omit({ id: true });
export type InsertEmployeeAlias = z.infer<typeof insertEmployeeAliasSchema>;
export type EmployeeAlias = typeof employeeAliases.$inferSelect;

export const payrollPeriods = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  workDays: integer("work_days").notNull(),
  salaryDivisor: integer("salary_divisor").default(30),
  status: text("status").default("draft"), // draft | calculated | reviewed | approved | locked
  uploadId: integer("upload_id"),
  periodSettings: text("period_settings"), // JSON: PeriodSettings (kurallar, toleranslar, çarpanlar)
  createdAt: timestamp("created_at").defaultNow(),
  calculatedAt: timestamp("calculated_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"),
  aiAnalysis: text("ai_analysis"),
});

export const insertPayrollPeriodSchema = createInsertSchema(payrollPeriods).omit({ id: true, createdAt: true });
export type InsertPayrollPeriod = z.infer<typeof insertPayrollPeriodSchema>;
export type PayrollPeriod = typeof payrollPeriods.$inferSelect;

export const payrollRecords = pgTable("payroll_records", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  positionName: text("position_name"),
  // 🔵 Otomatik (PDKS'den)
  workedDays: integer("worked_days").default(0),
  offDays: integer("off_days").default(0),
  deficitDays: integer("deficit_days").default(0),
  penaltyDays: integer("penalty_days").default(0),          // kesinti uygulanan gün (+1 varsa)
  overtimeDaysHoliday: real("overtime_days_holiday").default(0),
  fmMinutes: integer("fm_minutes").default(0),
  // 🟡 Manuel
  unpaidLeaveDays: integer("unpaid_leave_days").default(0),
  sickLeaveDays: integer("sick_leave_days").default(0),
  mealAllowance: integer("meal_allowance").default(0),
  // Maaş (kişi bazlı override destekli)
  customTotalSalary: integer("custom_total_salary"),         // null ise pozisyon maaşı kullanılır
  totalSalary: integer("total_salary").default(0),
  baseSalary: integer("base_salary").default(0),
  kasaPrim: integer("kasa_prim").default(0),
  performansPrim: integer("performans_prim").default(0),
  dailyRate: real("daily_rate").default(0),
  dayDeduction: real("day_deduction").default(0),
  primDeduction: real("prim_deduction").default(0),
  overtimeAmount: real("overtime_amount").default(0),        // tatil/bayram mesai tutarı
  fmAmount: real("fm_amount").default(0),
  mealAmount: integer("meal_amount").default(0),
  netPayment: real("net_payment").default(0),
  // AI
  aiCorrections: text("ai_corrections"),
  aiConfidence: real("ai_confidence"),
  aiNotes: text("ai_notes"),
  // Meta
  manuallyAdjusted: boolean("manually_adjusted").default(false),
  notes: text("notes"),
});

export const insertPayrollRecordSchema = createInsertSchema(payrollRecords).omit({ id: true });
export type InsertPayrollRecord = z.infer<typeof insertPayrollRecordSchema>;
export type PayrollRecord = typeof payrollRecords.$inferSelect;

export const payrollAdjustments = pgTable("payroll_adjustments", {
  id: serial("id").primaryKey(),
  payrollRecordId: integer("payroll_record_id").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  adjustedBy: integer("adjusted_by"),
  adjustedAt: timestamp("adjusted_at").defaultNow(),
  reason: text("reason"),
});

export const insertPayrollAdjustmentSchema = createInsertSchema(payrollAdjustments).omit({ id: true, adjustedAt: true });
export type InsertPayrollAdjustment = z.infer<typeof insertPayrollAdjustmentSchema>;
export type PayrollAdjustment = typeof payrollAdjustments.$inferSelect;

// AI okutma düzeltme kayıtları
export const aiPunchCorrections = pgTable("ai_punch_corrections", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id").notNull(),
  employeeId: integer("employee_id"),
  enNo: integer("en_no").notNull(),
  date: date("date").notNull(),
  originalPunches: text("original_punches").notNull(), // JSON array
  correctedPunches: text("corrected_punches").notNull(), // JSON array
  correctionType: text("correction_type").notNull(), // missing_exit | missing_entry | duplicate | anomaly
  confidence: real("confidence").notNull(), // 0-100
  reasoning: text("reasoning").notNull(), // AI'ın açıklaması
  approved: boolean("approved"), // null=bekliyor, true=onaylı, false=reddedildi
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiPunchCorrectionSchema = createInsertSchema(aiPunchCorrections).omit({ id: true, createdAt: true });
export type InsertAiPunchCorrection = z.infer<typeof insertAiPunchCorrectionSchema>;
export type AiPunchCorrection = typeof aiPunchCorrections.$inferSelect;

export const defaultSettings: Record<string, string> = {
  workStartTime: "08:00",
  workEndTime: "00:00",
  dailyWorkMinutes: "540",
  breakMinutes: "60",
  overtimeThreshold: "15",
  lateToleranceMinutes: "5",
  earlyLeaveToleranceMinutes: "5",
  workDaysPerWeek: "6",
  weekendDays: "",
  autoDeductBreak: "true",
  nightShiftSupport: "true",
  minValidWorkMinutes: "30",
  maxValidWorkMinutes: "960",
  fullTimeWeeklyHours: "45",
  partTimeWeeklyHours: "30",
  monthlyPayPeriodStart: "1",
  dailyOvertimeThresholdMinutes: "660",
};

export interface WeeklyBreakdown {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  workDays: number;
}

export interface DailyReport {
  date: string;
  dayName: string;
  punches: string[];
  pairs: { in: string; out: string }[];
  totalWorkMinutes: number;
  netWorkMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: string[];
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  salaryMultiplier: number;
  isOnLeave: boolean;
  leaveType?: string;
  isOffDay: boolean;
  scheduleName?: string;
  punchCount: number;
  nightCrossing: boolean;
  punchClassification?: string;
  breakMinutesActual?: number;
  leaveConflict?: boolean;
}

export interface LeaveBreakdown {
  type: string;
  label: string;
  days: number;
}

export interface EmployeeSummary {
  enNo: number;
  name: string;
  department?: string;
  branchId?: number;
  branchName?: string;
  employmentType: string;
  weeklyHoursExpected: number;
  workDays: number;
  totalWorkMinutes: number;
  avgDailyMinutes: number;
  totalOvertimeMinutes: number;
  totalDeficitMinutes: number;
  lateDays: number;
  earlyLeaveDays: number;
  issueCount: number;
  offDays: number;
  leaveDays: number;
  leaveBreakdown: LeaveBreakdown[];
  dailyReports: DailyReport[];
  weeklyBreakdown: WeeklyBreakdown[];
  monthlyTotalHours: number;
  monthlyExpectedHours: number;
  performancePercent: number;
  missingAssignmentWeeks?: string[];
}

export interface ProcessingResult {
  uploadId: number;
  totalRecords: number;
  totalEmployees: number;
  errors: string[];
  summaries: EmployeeSummary[];
}

export const leaveTypes = [
  { value: "annual", label: "Yillik Izin" },
  { value: "sick", label: "Hastalik Izni" },
  { value: "report", label: "Rapor" },
  { value: "maternity", label: "Dogum Izni" },
  { value: "marriage", label: "Evlilik Izni" },
  { value: "bereavement", label: "Vefat Izni" },
  { value: "unpaid", label: "Ucretsiz Izin" },
  { value: "special", label: "Ozel Izin" },
  { value: "other", label: "Diger" },
];
