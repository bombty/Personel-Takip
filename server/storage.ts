import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  users, type User, type InsertUser,
  branches, type Branch, type InsertBranch,
  employees, type Employee, type InsertEmployee,
  attendanceRecords, type AttendanceRecord, type InsertAttendanceRecord,
  uploads, type Upload, type InsertUpload,
  settings, type InsertSetting,
  holidays, type Holiday, type InsertHoliday,
  leaves, type Leave, type InsertLeave,
  seasons, type Season, type InsertSeason,
  workSchedules, type WorkSchedule, type InsertWorkSchedule,
  weeklyAssignments, type WeeklyAssignment, type InsertWeeklyAssignment,
  reportPeriods, type ReportPeriod, type InsertReportPeriod,
  positions, type Position, type InsertPosition,
  employeeAliases, type EmployeeAlias, type InsertEmployeeAlias,
  payrollPeriods, type PayrollPeriod, type InsertPayrollPeriod,
  payrollRecords, type PayrollRecord, type InsertPayrollRecord,
  payrollAdjustments, type PayrollAdjustment, type InsertPayrollAdjustment,
  aiPunchCorrections, type AiPunchCorrection, type InsertAiPunchCorrection,
  defaultSettings,
} from "@shared/schema";

export interface IStorage {
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  getBranches(): Promise<Branch[]>;
  getBranchById(id: number): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: number, data: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: number): Promise<void>;

  getEmployees(branchId?: number): Promise<Employee[]>;
  getEmployeeByEnNo(enNo: number): Promise<Employee | undefined>;
  getEmployeeById(id: number): Promise<Employee | undefined>;
  upsertEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;

  createUpload(upload: InsertUpload): Promise<Upload>;
  updateUpload(id: number, data: Partial<InsertUpload>): Promise<Upload | undefined>;
  getUploads(branchId?: number): Promise<Upload[]>;
  getUploadById(id: number): Promise<Upload | undefined>;

  createAttendanceRecords(records: InsertAttendanceRecord[]): Promise<void>;
  getAttendanceRecordsByUpload(uploadId: number): Promise<AttendanceRecord[]>;

  getSettings(): Promise<Record<string, string>>;
  upsertSetting(key: string, value: string): Promise<void>;

  getHolidays(): Promise<Holiday[]>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  deleteHoliday(id: number): Promise<void>;

  getLeaves(): Promise<Leave[]>;
  getLeavesByEmployee(employeeId: number): Promise<Leave[]>;
  createLeave(leave: InsertLeave): Promise<Leave>;
  updateLeave(id: number, leave: Partial<InsertLeave>): Promise<Leave | undefined>;
  deleteLeave(id: number): Promise<void>;

  getSeasons(): Promise<Season[]>;
  createSeason(season: InsertSeason): Promise<Season>;
  updateSeason(id: number, data: Partial<InsertSeason>): Promise<Season | undefined>;
  deleteSeason(id: number): Promise<void>;

  getWorkSchedules(): Promise<WorkSchedule[]>;
  createWorkSchedule(schedule: InsertWorkSchedule): Promise<WorkSchedule>;
  updateWorkSchedule(id: number, data: Partial<InsertWorkSchedule>): Promise<WorkSchedule | undefined>;
  deleteWorkSchedule(id: number): Promise<void>;

  getWeeklyAssignments(): Promise<WeeklyAssignment[]>;
  getWeeklyAssignmentsByEmployee(employeeId: number): Promise<WeeklyAssignment[]>;
  getWeeklyAssignmentByWeek(employeeId: number, weekStartDate: string): Promise<WeeklyAssignment | undefined>;
  createWeeklyAssignment(assignment: InsertWeeklyAssignment): Promise<WeeklyAssignment>;
  updateWeeklyAssignment(id: number, data: Partial<InsertWeeklyAssignment>): Promise<WeeklyAssignment | undefined>;

  getReportPeriods(branchId?: number): Promise<ReportPeriod[]>;
  getReportPeriodById(id: number): Promise<ReportPeriod | undefined>;
  createReportPeriod(period: InsertReportPeriod): Promise<ReportPeriod>;
  updateReportPeriod(id: number, data: Partial<InsertReportPeriod>): Promise<ReportPeriod | undefined>;
  deleteReportPeriod(id: number): Promise<void>;
  finalizeReportPeriod(id: number): Promise<ReportPeriod | undefined>;

  clearAllData(): Promise<void>;
  initDefaults(): Promise<void>;

  // Positions
  getPositions(): Promise<Position[]>;
  getPositionById(id: number): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined>;

  // Employee Aliases
  getAliasesByEmployee(employeeId: number): Promise<EmployeeAlias[]>;
  getAllAliases(): Promise<EmployeeAlias[]>;
  createAlias(alias: InsertEmployeeAlias): Promise<EmployeeAlias>;
  deleteAlias(id: number): Promise<void>;
  findEmployeeByAlias(aliasName: string): Promise<Employee | undefined>;

  // Payroll Periods
  getPayrollPeriods(branchId?: number): Promise<PayrollPeriod[]>;
  getPayrollPeriodById(id: number): Promise<PayrollPeriod | undefined>;
  getPayrollPeriodByMonth(branchId: number, year: number, month: number): Promise<PayrollPeriod | undefined>;
  createPayrollPeriod(period: InsertPayrollPeriod): Promise<PayrollPeriod>;
  updatePayrollPeriod(id: number, data: Partial<InsertPayrollPeriod>): Promise<PayrollPeriod | undefined>;

  // Payroll Records
  getPayrollRecords(periodId: number): Promise<PayrollRecord[]>;
  getPayrollRecordById(id: number): Promise<PayrollRecord | undefined>;
  createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: number, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;
  deletePayrollRecordsByPeriod(periodId: number): Promise<void>;

  // Payroll Adjustments
  getAdjustmentsByRecord(payrollRecordId: number): Promise<PayrollAdjustment[]>;
  createAdjustment(adjustment: InsertPayrollAdjustment): Promise<PayrollAdjustment>;

  // AI Punch Corrections
  getAiCorrections(uploadId: number): Promise<AiPunchCorrection[]>;
  getAiCorrectionsByEmployee(uploadId: number, enNo: number): Promise<AiPunchCorrection[]>;
  createAiCorrection(correction: InsertAiPunchCorrection): Promise<AiPunchCorrection>;
  updateAiCorrection(id: number, data: Partial<InsertAiPunchCorrection>): Promise<AiPunchCorrection | undefined>;
  getPendingCorrections(uploadId: number): Promise<AiPunchCorrection[]>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getBranches(): Promise<Branch[]> {
    return db.select().from(branches).orderBy(branches.name);
  }

  async getBranchById(id: number): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const result = await db.insert(branches).values(branch).returning();
    return result[0];
  }

  async updateBranch(id: number, data: Partial<InsertBranch>): Promise<Branch | undefined> {
    const result = await db.update(branches).set(data).where(eq(branches.id, id)).returning();
    return result[0];
  }

  async deleteBranch(id: number): Promise<void> {
    await db.update(branches).set({ active: false }).where(eq(branches.id, id));
  }

  async getEmployees(branchId?: number): Promise<Employee[]> {
    if (branchId) {
      return db.select().from(employees).where(and(eq(employees.active, true), eq(employees.branchId, branchId)));
    }
    return db.select().from(employees).where(eq(employees.active, true));
  }

  async getEmployeeByEnNo(enNo: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.enNo, enNo));
    return result[0];
  }

  async getEmployeeById(id: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async upsertEmployee(employee: InsertEmployee): Promise<Employee> {
    const existing = await this.getEmployeeByEnNo(employee.enNo);
    if (existing) {
      return existing;
    }
    const result = await db.insert(employees).values(employee).returning();
    return result[0];
  }

  async updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.update(employees).set({ active: false }).where(eq(employees.id, id));
  }

  async createUpload(upload: InsertUpload): Promise<Upload> {
    const result = await db.insert(uploads).values(upload).returning();
    return result[0];
  }

  async updateUpload(id: number, data: Partial<InsertUpload>): Promise<Upload | undefined> {
    const result = await db.update(uploads).set(data).where(eq(uploads.id, id)).returning();
    return result[0];
  }

  async getUploads(branchId?: number): Promise<Upload[]> {
    if (branchId) {
      return db.select().from(uploads).where(eq(uploads.branchId, branchId)).orderBy(desc(uploads.uploadDate));
    }
    return db.select().from(uploads).orderBy(desc(uploads.uploadDate));
  }

  async getUploadById(id: number): Promise<Upload | undefined> {
    const result = await db.select().from(uploads).where(eq(uploads.id, id));
    return result[0];
  }

  async createAttendanceRecords(records: InsertAttendanceRecord[]): Promise<void> {
    if (records.length === 0) return;
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.insert(attendanceRecords).values(batch);
    }
  }

  async getAttendanceRecordsByUpload(uploadId: number): Promise<AttendanceRecord[]> {
    return db.select().from(attendanceRecords).where(eq(attendanceRecords.uploadId, uploadId));
  }

  async getSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = { ...defaultSettings };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async upsertSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length > 0) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getHolidays(): Promise<Holiday[]> {
    return db.select().from(holidays);
  }

  async createHoliday(holiday: InsertHoliday): Promise<Holiday> {
    const result = await db.insert(holidays).values(holiday).returning();
    return result[0];
  }

  async deleteHoliday(id: number): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
  }

  async getLeaves(): Promise<Leave[]> {
    return db.select().from(leaves);
  }

  async getLeavesByEmployee(employeeId: number): Promise<Leave[]> {
    return db.select().from(leaves).where(eq(leaves.employeeId, employeeId));
  }

  async createLeave(leave: InsertLeave): Promise<Leave> {
    const result = await db.insert(leaves).values(leave).returning();
    return result[0];
  }

  async updateLeave(id: number, leave: Partial<InsertLeave>): Promise<Leave | undefined> {
    const result = await db.update(leaves).set(leave).where(eq(leaves.id, id)).returning();
    return result[0];
  }

  async deleteLeave(id: number): Promise<void> {
    await db.delete(leaves).where(eq(leaves.id, id));
  }

  async getSeasons(): Promise<Season[]> {
    return db.select().from(seasons);
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    const result = await db.insert(seasons).values(season).returning();
    return result[0];
  }

  async updateSeason(id: number, data: Partial<InsertSeason>): Promise<Season | undefined> {
    const result = await db.update(seasons).set(data).where(eq(seasons.id, id)).returning();
    return result[0];
  }

  async deleteSeason(id: number): Promise<void> {
    await db.delete(seasons).where(eq(seasons.id, id));
  }

  async getWorkSchedules(): Promise<WorkSchedule[]> {
    return db.select().from(workSchedules);
  }

  async createWorkSchedule(schedule: InsertWorkSchedule): Promise<WorkSchedule> {
    const result = await db.insert(workSchedules).values(schedule).returning();
    return result[0];
  }

  async updateWorkSchedule(id: number, data: Partial<InsertWorkSchedule>): Promise<WorkSchedule | undefined> {
    const result = await db.update(workSchedules).set(data).where(eq(workSchedules.id, id)).returning();
    return result[0];
  }

  async deleteWorkSchedule(id: number): Promise<void> {
    await db.delete(workSchedules).where(eq(workSchedules.id, id));
  }

  async getWeeklyAssignments(): Promise<WeeklyAssignment[]> {
    return db.select().from(weeklyAssignments);
  }

  async getWeeklyAssignmentsByEmployee(employeeId: number): Promise<WeeklyAssignment[]> {
    return db.select().from(weeklyAssignments).where(eq(weeklyAssignments.employeeId, employeeId));
  }

  async getWeeklyAssignmentByWeek(employeeId: number, weekStartDate: string): Promise<WeeklyAssignment | undefined> {
    const result = await db.select().from(weeklyAssignments)
      .where(and(eq(weeklyAssignments.employeeId, employeeId), eq(weeklyAssignments.weekStartDate, weekStartDate)));
    return result[0];
  }

  async createWeeklyAssignment(assignment: InsertWeeklyAssignment): Promise<WeeklyAssignment> {
    const result = await db.insert(weeklyAssignments).values(assignment).returning();
    return result[0];
  }

  async updateWeeklyAssignment(id: number, data: Partial<InsertWeeklyAssignment>): Promise<WeeklyAssignment | undefined> {
    const result = await db.update(weeklyAssignments).set(data).where(eq(weeklyAssignments.id, id)).returning();
    return result[0];
  }

  async getReportPeriods(branchId?: number): Promise<ReportPeriod[]> {
    if (branchId) {
      return db.select().from(reportPeriods).where(eq(reportPeriods.branchId, branchId)).orderBy(desc(reportPeriods.createdAt));
    }
    return db.select().from(reportPeriods).orderBy(desc(reportPeriods.createdAt));
  }

  async getReportPeriodById(id: number): Promise<ReportPeriod | undefined> {
    const result = await db.select().from(reportPeriods).where(eq(reportPeriods.id, id));
    return result[0];
  }

  async createReportPeriod(period: InsertReportPeriod): Promise<ReportPeriod> {
    const result = await db.insert(reportPeriods).values(period).returning();
    return result[0];
  }

  async updateReportPeriod(id: number, data: Partial<InsertReportPeriod>): Promise<ReportPeriod | undefined> {
    const result = await db.update(reportPeriods).set(data).where(eq(reportPeriods.id, id)).returning();
    return result[0];
  }

  async deleteReportPeriod(id: number): Promise<void> {
    const period = await this.getReportPeriodById(id);
    if (period && period.status === "draft") {
      await db.delete(reportPeriods).where(eq(reportPeriods.id, id));
    } else {
      throw new Error("Only draft periods can be deleted");
    }
  }

  async finalizeReportPeriod(id: number): Promise<ReportPeriod | undefined> {
    const result = await db.update(reportPeriods)
      .set({ status: "final", finalizedAt: sql`now()` })
      .where(eq(reportPeriods.id, id))
      .returning();
    return result[0];
  }

  async clearAllData(): Promise<void> {
    await db.delete(payrollAdjustments);
    await db.delete(payrollRecords);
    await db.delete(payrollPeriods);
    await db.delete(aiPunchCorrections);
    await db.delete(attendanceRecords);
    await db.delete(uploads);
    await db.delete(leaves);
    await db.delete(weeklyAssignments);
    await db.delete(employeeAliases);
    await db.delete(employees);
  }

  // ===== POSITIONS =====
  async getPositions(): Promise<Position[]> {
    return db.select().from(positions).where(eq(positions.active, true));
  }

  async getPositionById(id: number): Promise<Position | undefined> {
    const result = await db.select().from(positions).where(eq(positions.id, id));
    return result[0];
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const result = await db.insert(positions).values(position).returning();
    return result[0];
  }

  async updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined> {
    const result = await db.update(positions).set(data).where(eq(positions.id, id)).returning();
    return result[0];
  }

  // ===== EMPLOYEE ALIASES =====
  async getAliasesByEmployee(employeeId: number): Promise<EmployeeAlias[]> {
    return db.select().from(employeeAliases).where(eq(employeeAliases.employeeId, employeeId));
  }

  async getAllAliases(): Promise<EmployeeAlias[]> {
    return db.select().from(employeeAliases);
  }

  async createAlias(alias: InsertEmployeeAlias): Promise<EmployeeAlias> {
    const result = await db.insert(employeeAliases).values(alias).returning();
    return result[0];
  }

  async deleteAlias(id: number): Promise<void> {
    await db.delete(employeeAliases).where(eq(employeeAliases.id, id));
  }

  async findEmployeeByAlias(aliasName: string): Promise<Employee | undefined> {
    const normalizedAlias = aliasName.toLowerCase().trim();
    const aliases = await db.select().from(employeeAliases);
    const match = aliases.find(a => a.aliasName.toLowerCase().trim() === normalizedAlias);
    if (match) {
      return this.getEmployeeById(match.employeeId);
    }
    // Fallback: employees tablosunda name ile ara
    const allEmployees = await db.select().from(employees).where(eq(employees.active, true));
    return allEmployees.find(e =>
      e.name.toLowerCase().trim() === normalizedAlias ||
      (e.fullName && e.fullName.toLowerCase().trim().includes(normalizedAlias))
    );
  }

  // ===== PAYROLL PERIODS =====
  async getPayrollPeriods(branchId?: number): Promise<PayrollPeriod[]> {
    if (branchId) {
      return db.select().from(payrollPeriods).where(eq(payrollPeriods.branchId, branchId)).orderBy(desc(payrollPeriods.createdAt));
    }
    return db.select().from(payrollPeriods).orderBy(desc(payrollPeriods.createdAt));
  }

  async getPayrollPeriodById(id: number): Promise<PayrollPeriod | undefined> {
    const result = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, id));
    return result[0];
  }

  async getPayrollPeriodByMonth(branchId: number, year: number, month: number): Promise<PayrollPeriod | undefined> {
    const result = await db.select().from(payrollPeriods).where(
      and(eq(payrollPeriods.branchId, branchId), eq(payrollPeriods.year, year), eq(payrollPeriods.month, month))
    );
    return result[0];
  }

  async createPayrollPeriod(period: InsertPayrollPeriod): Promise<PayrollPeriod> {
    const result = await db.insert(payrollPeriods).values(period).returning();
    return result[0];
  }

  async updatePayrollPeriod(id: number, data: Partial<InsertPayrollPeriod>): Promise<PayrollPeriod | undefined> {
    const result = await db.update(payrollPeriods).set(data).where(eq(payrollPeriods.id, id)).returning();
    return result[0];
  }

  // ===== PAYROLL RECORDS =====
  async getPayrollRecords(periodId: number): Promise<PayrollRecord[]> {
    return db.select().from(payrollRecords).where(eq(payrollRecords.periodId, periodId));
  }

  async getPayrollRecordById(id: number): Promise<PayrollRecord | undefined> {
    const result = await db.select().from(payrollRecords).where(eq(payrollRecords.id, id));
    return result[0];
  }

  async createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord> {
    const result = await db.insert(payrollRecords).values(record).returning();
    return result[0];
  }

  async updatePayrollRecord(id: number, data: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
    const result = await db.update(payrollRecords).set(data).where(eq(payrollRecords.id, id)).returning();
    return result[0];
  }

  async deletePayrollRecordsByPeriod(periodId: number): Promise<void> {
    // Önce adjustments sil
    const records = await this.getPayrollRecords(periodId);
    for (const rec of records) {
      await db.delete(payrollAdjustments).where(eq(payrollAdjustments.payrollRecordId, rec.id));
    }
    await db.delete(payrollRecords).where(eq(payrollRecords.periodId, periodId));
  }

  // ===== PAYROLL ADJUSTMENTS =====
  async getAdjustmentsByRecord(payrollRecordId: number): Promise<PayrollAdjustment[]> {
    return db.select().from(payrollAdjustments)
      .where(eq(payrollAdjustments.payrollRecordId, payrollRecordId))
      .orderBy(desc(payrollAdjustments.adjustedAt));
  }

  async createAdjustment(adjustment: InsertPayrollAdjustment): Promise<PayrollAdjustment> {
    const result = await db.insert(payrollAdjustments).values(adjustment).returning();
    return result[0];
  }

  // ===== AI PUNCH CORRECTIONS =====
  async getAiCorrections(uploadId: number): Promise<AiPunchCorrection[]> {
    return db.select().from(aiPunchCorrections).where(eq(aiPunchCorrections.uploadId, uploadId));
  }

  async getAiCorrectionsByEmployee(uploadId: number, enNo: number): Promise<AiPunchCorrection[]> {
    return db.select().from(aiPunchCorrections).where(
      and(eq(aiPunchCorrections.uploadId, uploadId), eq(aiPunchCorrections.enNo, enNo))
    );
  }

  async createAiCorrection(correction: InsertAiPunchCorrection): Promise<AiPunchCorrection> {
    const result = await db.insert(aiPunchCorrections).values(correction).returning();
    return result[0];
  }

  async updateAiCorrection(id: number, data: Partial<InsertAiPunchCorrection>): Promise<AiPunchCorrection | undefined> {
    const result = await db.update(aiPunchCorrections).set(data).where(eq(aiPunchCorrections.id, id)).returning();
    return result[0];
  }

  async getPendingCorrections(uploadId: number): Promise<AiPunchCorrection[]> {
    return db.select().from(aiPunchCorrections).where(
      and(eq(aiPunchCorrections.uploadId, uploadId), sql`${aiPunchCorrections.approved} IS NULL`)
    );
  }

  async initDefaults(): Promise<void> {
    const currentSettings = await db.select().from(settings);
    const existingKeys = new Set(currentSettings.map(s => s.key));
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (!existingKeys.has(key)) {
        await db.insert(settings).values({ key, value });
      }
    }

    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      const supervisorHash = await bcrypt.hash("0000", 10);
      const adminHash = await bcrypt.hash("0000", 10);
      await db.insert(users).values({ username: "supervisor", password: supervisorHash, displayName: "Supervisor", role: "supervisor" });
      await db.insert(users).values({ username: "admin", password: adminHash, displayName: "Yonetim", role: "yonetim" });
    }

    const existingBranches = await db.select().from(branches);
    if (existingBranches.length === 0) {
      const defaultBranches = ["Isiklar", "Lara", "Beachpark", "Duzce", "Samsun"];
      for (const name of defaultBranches) {
        await db.insert(branches).values({ name, active: true });
      }
    }

    const existingSeasons = await db.select().from(seasons);
    if (existingSeasons.length === 0) {
      await db.insert(seasons).values({
        name: "Kis Sezonu",
        startMonth: 11, endMonth: 3,
        weekdayOpen: "08:00", weekdayClose: "00:00",
        weekendOpen: "08:00", weekendClose: "02:00",
        weekendDays: "5,6",
      });
      await db.insert(seasons).values({
        name: "Yaz Sezonu",
        startMonth: 4, endMonth: 10,
        weekdayOpen: "08:00", weekdayClose: "01:00",
        weekendOpen: "08:00", weekendClose: "02:00",
        weekendDays: "5,6",
      });
    }

    const existingSchedules = await db.select().from(workSchedules);
    if (existingSchedules.length === 0) {
      await db.insert(workSchedules).values({ name: "Acilis Vardiyasi", startTime: "08:00", endTime: "16:00", breakMinutes: 60, shortCode: "A" });
      await db.insert(workSchedules).values({ name: "Kapanis Vardiyasi", startTime: "16:00", endTime: "00:00", breakMinutes: 60, shortCode: "K" });
      await db.insert(workSchedules).values({ name: "Tam Gun", startTime: "09:00", endTime: "22:00", breakMinutes: 60, shortCode: "T" });
      await db.insert(workSchedules).values({ name: "Yarim Gun", startTime: "09:00", endTime: "14:00", breakMinutes: 30, shortCode: "Y" });
    } else {
      const codeMap: Record<string, string> = {
        "Acilis Vardiyasi": "A",
        "Kapanis Vardiyasi": "K",
        "Tam Gun": "T",
        "Yarim Gun": "Y",
      };
      for (const sched of existingSchedules) {
        const code = codeMap[sched.name];
        if (code && !sched.shortCode) {
          await db.update(workSchedules).set({ shortCode: code }).where(eq(workSchedules.id, sched.id));
        }
      }
    }

    const existingHolidays = await db.select().from(holidays);
    if (existingHolidays.length === 0) {
      const turkishHolidays: InsertHoliday[] = [
        { date: "2026-01-01", name: "Yilbasi", salaryMultiplier: 2 },
        { date: "2026-04-23", name: "Ulusal Egemenlik ve Cocuk Bayrami", salaryMultiplier: 2 },
        { date: "2026-05-01", name: "Emek ve Dayanisma Gunu", salaryMultiplier: 2 },
        { date: "2026-05-19", name: "Ataturk'u Anma Genclik ve Spor Bayrami", salaryMultiplier: 2 },
        { date: "2026-06-15", name: "Ramazan Bayrami 1. Gun", salaryMultiplier: 2 },
        { date: "2026-06-16", name: "Ramazan Bayrami 2. Gun", salaryMultiplier: 2 },
        { date: "2026-06-17", name: "Ramazan Bayrami 3. Gun", salaryMultiplier: 2 },
        { date: "2026-07-15", name: "Demokrasi ve Milli Birlik Gunu", salaryMultiplier: 2 },
        { date: "2026-08-22", name: "Kurban Bayrami 1. Gun", salaryMultiplier: 2 },
        { date: "2026-08-23", name: "Kurban Bayrami 2. Gun", salaryMultiplier: 2 },
        { date: "2026-08-24", name: "Kurban Bayrami 3. Gun", salaryMultiplier: 2 },
        { date: "2026-08-25", name: "Kurban Bayrami 4. Gun", salaryMultiplier: 2 },
        { date: "2026-08-30", name: "Zafer Bayrami", salaryMultiplier: 2 },
        { date: "2026-10-29", name: "Cumhuriyet Bayrami", salaryMultiplier: 2 },
      ];
      for (const h of turkishHolidays) {
        await db.insert(holidays).values(h);
      }
    }

    // Pozisyon seed data
    const existingPositions = await db.select().from(positions);
    if (existingPositions.length === 0) {
      const positionData: InsertPosition[] = [
        { name: "Stajyer", baseSalary: 31000, totalSalary: 33000, kasaPrim: 0, performansPrim: 2000, description: "Taban 31K + Prim 2K" },
        { name: "Bar Buddy", baseSalary: 31000, totalSalary: 36000, kasaPrim: 3500, performansPrim: 1500, description: "Taban 31K + Prim 5K" },
        { name: "Barista", baseSalary: 31000, totalSalary: 41000, kasaPrim: 3500, performansPrim: 6500, description: "Taban 31K + Prim 10K" },
        { name: "Supervisor Buddy", baseSalary: 31000, totalSalary: 45000, kasaPrim: 3500, performansPrim: 10500, description: "Taban 31K + Prim 14K" },
        { name: "Supervisor", baseSalary: 31000, totalSalary: 49000, kasaPrim: 3500, performansPrim: 14500, description: "Taban 31K + Prim 18K" },
      ];
      for (const p of positionData) {
        await db.insert(positions).values(p);
      }
    }

    // Lara şubesi personel seed data
    const existingEmployees = await db.select().from(employees);
    if (existingEmployees.length === 0) {
      // Pozisyonları al
      const positionsList = await db.select().from(positions);
      const posMap = new Map<string, number>();
      for (const p of positionsList) posMap.set(p.name, p.id);

      // Lara şubesini bul
      const branchList = await db.select().from(branches);
      const laraBranch = branchList.find(b => b.name.toLowerCase().includes("lara"));
      const laraId = laraBranch?.id || 1;

      // PDKS'deki enNo → isim → tam isim → pozisyon eşleştirmesi
      const laraPersonel = [
        { enNo: 32, name: "deniz", fullName: "DENİZ HALİL ÇOLAK", position: "Supervisor Buddy" },
        { enNo: 22, name: "eren", fullName: "EREN DEMİR", position: "Barista" },
        { enNo: 6, name: "veysel", fullName: "VEYSEL HÜSEYİNOĞLU", position: "Barista" },
        { enNo: 5, name: "jennifer", fullName: "DİLARA JENNEFER ELMAS", position: "Barista" },
        { enNo: 9, name: "berkan", fullName: "BERKAN BOZDAĞ", position: "Bar Buddy" },
        { enNo: 55, name: "efe", fullName: "EFE YÜKSEL", position: "Bar Buddy" },
        { enNo: 13, name: "gul", fullName: "GÜL DEMİR", position: "Bar Buddy" },
        { enNo: 15, name: "yagiz", fullName: "YAĞIZ TÖRER", position: "Stajyer" },
        { enNo: 4, name: "aybuke", fullName: "AYBÜKE", position: "Stajyer" },
        { enNo: 1, name: "berk", fullName: "BERK", position: "Stajyer" },
        { enNo: 12, name: "burcu", fullName: "BURCU", position: "Stajyer" },
        { enNo: 17, name: "goktug", fullName: "GÖKTUĞ", position: "Stajyer" },
        { enNo: 7, name: "jasmin", fullName: "JASMİN", position: "Stajyer" },
        { enNo: 3, name: "seref", fullName: "ŞEREF", position: "Stajyer" },
        { enNo: 10, name: "tugba", fullName: "TUĞBA", position: "Stajyer" },
      ];

      for (const p of laraPersonel) {
        const posId = posMap.get(p.position);
        const emp = await db.insert(employees).values({
          enNo: p.enNo,
          name: p.name,
          fullName: p.fullName,
          position: p.position,
          positionId: posId || null,
          branchId: laraId,
          active: true,
          employmentType: "full_time",
          weeklyHours: 45,
        }).returning();

        // PDKS alias kaydet
        if (emp[0]) {
          await db.insert(employeeAliases).values({
            employeeId: emp[0].id,
            aliasName: p.name,
            source: "pdks",
          });
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
