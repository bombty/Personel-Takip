import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  employees, type Employee, type InsertEmployee,
  attendanceRecords, type AttendanceRecord, type InsertAttendanceRecord,
  uploads, type Upload, type InsertUpload,
  settings, type Setting, type InsertSetting,
  holidays, type Holiday, type InsertHoliday,
  leaves, type Leave, type InsertLeave,
  defaultSettings,
} from "@shared/schema";

export interface IStorage {
  getEmployees(): Promise<Employee[]>;
  getEmployeeByEnNo(enNo: number): Promise<Employee | undefined>;
  upsertEmployee(employee: InsertEmployee): Promise<Employee>;

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

  initDefaults(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getEmployees(): Promise<Employee[]> {
    return db.select().from(employees);
  }

  async getEmployeeByEnNo(enNo: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.enNo, enNo));
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

  async initDefaults(): Promise<void> {
    const currentSettings = await db.select().from(settings);
    if (currentSettings.length === 0) {
      for (const [key, value] of Object.entries(defaultSettings)) {
        await db.insert(settings).values({ key, value });
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
  }
}

export const storage = new DatabaseStorage();
