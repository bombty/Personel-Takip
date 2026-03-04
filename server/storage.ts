import { db } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  users, type User, type InsertUser,
  employees, type Employee, type InsertEmployee,
  attendanceRecords, type AttendanceRecord, type InsertAttendanceRecord,
  uploads, type Upload, type InsertUpload,
  settings, type InsertSetting,
  holidays, type Holiday, type InsertHoliday,
  leaves, type Leave, type InsertLeave,
  seasons, type Season, type InsertSeason,
  workSchedules, type WorkSchedule, type InsertWorkSchedule,
  weeklyAssignments, type WeeklyAssignment, type InsertWeeklyAssignment,
  defaultSettings,
} from "@shared/schema";

export interface IStorage {
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  getEmployees(): Promise<Employee[]>;
  getEmployeeByEnNo(enNo: number): Promise<Employee | undefined>;
  getEmployeeById(id: number): Promise<Employee | undefined>;
  upsertEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<void>;

  createUpload(upload: InsertUpload): Promise<Upload>;
  getUploads(): Promise<Upload[]>;
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

  clearAllData(): Promise<void>;
  initDefaults(): Promise<void>;
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

  async getEmployees(): Promise<Employee[]> {
    return db.select().from(employees);
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

  async getUploads(): Promise<Upload[]> {
    return db.select().from(uploads);
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

  async clearAllData(): Promise<void> {
    await db.delete(attendanceRecords);
    await db.delete(uploads);
    await db.delete(leaves);
    await db.delete(weeklyAssignments);
    await db.delete(employees);
  }

  async initDefaults(): Promise<void> {
    const currentSettings = await db.select().from(settings);
    if (currentSettings.length === 0) {
      for (const [key, value] of Object.entries(defaultSettings)) {
        await db.insert(settings).values({ key, value });
      }
    }

    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      const supervisorHash = await bcrypt.hash("1234", 10);
      const yonetimHash = await bcrypt.hash("1234", 10);
      await db.insert(users).values({ username: "supervisor", password: supervisorHash, displayName: "Supervisor", role: "supervisor" });
      await db.insert(users).values({ username: "yonetim", password: yonetimHash, displayName: "Yonetim", role: "yonetim" });
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
      await db.insert(workSchedules).values({ name: "Acilis Vardiyasi", startTime: "08:00", endTime: "16:00", breakMinutes: 60 });
      await db.insert(workSchedules).values({ name: "Kapanis Vardiyasi", startTime: "16:00", endTime: "00:00", breakMinutes: 60 });
      await db.insert(workSchedules).values({ name: "Tam Gun", startTime: "09:00", endTime: "22:00", breakMinutes: 60 });
      await db.insert(workSchedules).values({ name: "Yarim Gun", startTime: "09:00", endTime: "14:00", breakMinutes: 30 });
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
  }
}

export const storage = new DatabaseStorage();
