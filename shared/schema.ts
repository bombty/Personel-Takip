import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, real, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  enNo: integer("en_no").notNull(),
  name: text("name").notNull(),
  department: text("department"),
  position: text("position"),
  active: boolean("active").default(true),
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
});

export const insertLeaveSchema = createInsertSchema(leaves).omit({ id: true });
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leaves.$inferSelect;

export const defaultSettings: Record<string, string> = {
  workStartTime: "08:30",
  workEndTime: "17:30",
  dailyWorkMinutes: "540",
  breakMinutes: "60",
  overtimeThreshold: "15",
  lateToleranceMinutes: "5",
  earlyLeaveToleranceMinutes: "5",
  workDaysPerWeek: "5",
  weekendDays: "6,0",
  autoDeductBreak: "true",
  nightShiftSupport: "false",
  minValidWorkMinutes: "30",
  maxValidWorkMinutes: "960",
};

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
}

export interface EmployeeSummary {
  enNo: number;
  name: string;
  department?: string;
  workDays: number;
  totalWorkMinutes: number;
  avgDailyMinutes: number;
  totalOvertimeMinutes: number;
  totalDeficitMinutes: number;
  lateDays: number;
  earlyLeaveDays: number;
  issueCount: number;
  dailyReports: DailyReport[];
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
  { value: "maternity", label: "Dogum Izni" },
  { value: "marriage", label: "Evlilik Izni" },
  { value: "bereavement", label: "Vefat Izni" },
  { value: "unpaid", label: "Ucretsiz Izin" },
  { value: "other", label: "Diger" },
];
