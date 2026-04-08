/**
 * DOSPRESSO Maaş Hesaplama Motoru
 * 
 * Formüller (Lara_Sube_Maas Excel'inden):
 * - Günlük Ücret = Toplam Maaş ÷ 30 (sabit bölen)
 * - Gün Kesinti = Eksik Gün × Günlük Ücret
 * - Prim Kesinti = (Eksik Gün / Devam Takip Günü) × Toplam Prim
 * - FM Tutarı = FM Dakika × (Günlük Ücret ÷ 450) × 1.5
 * - Mesai Gün Tutarı = Mesai Gün (Bayram/Tatil) × Günlük Ücret × 2
 * - NET ÖDEME = Toplam Maaş - Gün Kesinti - Prim Kesinti + FM Tutarı + Mesai Gün Tutarı + Yemek Bedeli
 */

import type { Position, EmployeeSummary } from "@shared/schema";

export interface SalaryInput {
  // Personel bilgileri
  employeeId: number;
  employeeName: string;
  positionName: string;
  
  // Pozisyon maaş bilgileri
  totalSalary: number;     // Toplam Maaş (ör: 41000)
  baseSalary: number;      // Taban Maaş (ör: 31000)
  kasaPrim: number;        // Kasa Primi (ör: 3500)
  performansPrim: number;  // Performans Primi (ör: 6500)
  
  // Dönem bilgileri
  salaryDivisor: number;   // Günlük Ücret Böleni (varsayılan: 30)
  trackingDays: number;    // Devam Takip Günü (ayın toplam çalışma günü)
  
  // 🔵 Otomatik (PDKS'den)
  workedDays: number;      // Çalışılan Gün
  offDays: number;         // Off Gün
  fmMinutes: number;       // Fazla Mesai Dakika (30dk üstü)
  overtimeDaysHoliday: number; // Mesai Gün (Bayram/Tatil)
  
  // 🟡 Manuel
  unpaidLeaveDays: number; // Ücretsiz İzin Gün
  sickLeaveDays: number;   // Raporlu Gün
  mealAllowance: number;   // Yemek Bedeli
}

export interface SalaryResult {
  // Hesaplanan değerler
  dailyRate: number;         // Günlük Ücret
  deficitDays: number;       // Eksik Gün
  dayDeduction: number;      // Gün Kesinti tutarı
  primDeduction: number;     // Prim Kesinti tutarı
  overtimeAmount: number;    // Mesai Gün Tutarı (Bayram/Tatil)
  fmAmount: number;          // FM Tutarı
  mealAmount: number;        // Yemek Bedeli
  netPayment: number;        // NET ÖDEME
  
  // Detay
  totalPrim: number;         // Toplam Prim
  hourlyRate: number;        // Saatlik Ücret (FM hesabı için)
}

/**
 * Eksik gün hesabı
 * Eksik Gün = Devam Takip Günü - Çalışılan Gün - Off Gün - Ücretsiz İzin - Raporlu Gün
 */
function calculateDeficitDays(input: SalaryInput): number {
  const deficit = input.trackingDays - input.workedDays - input.offDays - input.unpaidLeaveDays - input.sickLeaveDays;
  return Math.max(0, deficit);
}

/**
 * FM (Fazla Mesai) Dakika hesabı
 * PDKS verilerinden günlük net çalışma > 480dk (8 saat) olan günlerdeki
 * fazla dakika toplamı. 30dk altı günlük FM sayılmaz.
 */
export function calculateFMMinutes(dailyReports: EmployeeSummary["dailyReports"]): number {
  let totalFM = 0;
  
  for (const day of dailyReports) {
    if (day.isOffDay || day.isOnLeave || day.isHoliday) continue;
    if (day.punchCount < 2) continue;
    
    // Net çalışma 480dk (8 saat) üstündeki kısım
    const dailyFM = day.netWorkMinutes - 480;
    
    // Günlük 30dk altı FM sayılmaz
    if (dailyFM >= 30) {
      totalFM += dailyFM;
    }
  }
  
  return Math.round(totalFM);
}

/**
 * Mesai Gün (Bayram/Tatil) hesabı
 * Tatil günlerinde çalışılan saat / 8 = gün (0.5 gün destekli)
 */
export function calculateOvertimeDaysHoliday(dailyReports: EmployeeSummary["dailyReports"]): number {
  let totalHolidayWork = 0;
  
  for (const day of dailyReports) {
    if (!day.isHoliday || day.punchCount < 2) continue;
    
    // Çalışma saati / 8 = gün (yarım gün destekli, 0.5'e yuvarla)
    const hoursWorked = day.netWorkMinutes / 60;
    const daysWorked = Math.round(hoursWorked / 8 * 2) / 2; // 0.5 adımla yuvarla
    totalHolidayWork += daysWorked;
  }
  
  return totalHolidayWork;
}

/**
 * Ana maaş hesaplama fonksiyonu
 */
export function calculateSalary(input: SalaryInput): SalaryResult {
  const totalPrim = input.kasaPrim + input.performansPrim;
  
  // Günlük Ücret = Toplam Maaş ÷ Bölen (varsayılan 30)
  const dailyRate = input.totalSalary / input.salaryDivisor;
  
  // Eksik Gün
  const deficitDays = calculateDeficitDays(input);
  
  // Gün Kesinti = Eksik Gün × Günlük Ücret
  const dayDeduction = deficitDays * dailyRate;
  
  // Prim Kesinti = (Eksik Gün / Devam Takip Günü) × Toplam Prim
  // NOT: Eksik gün yoksa prim kesintisi yok
  const primDeduction = deficitDays > 0 && input.trackingDays > 0
    ? (deficitDays / input.trackingDays) * totalPrim
    : 0;
  
  // Saatlik Ücret (FM hesabı için) = Günlük Ücret ÷ 7.5 saat
  const hourlyRate = dailyRate / 7.5;
  
  // FM Tutarı = FM Dakika × (Saatlik Ücret / 60) × 1.5
  const fmAmount = input.fmMinutes > 0
    ? input.fmMinutes * (hourlyRate / 60) * 1.5
    : 0;
  
  // Mesai Gün Tutarı = Mesai Gün × Günlük Ücret × 2
  const overtimeAmount = input.overtimeDaysHoliday * dailyRate * 2;
  
  // Yemek Bedeli
  const mealAmount = input.mealAllowance || 0;
  
  // NET ÖDEME = Toplam Maaş - Gün Kesinti - Prim Kesinti + FM Tutarı + Mesai Gün Tutarı + Yemek Bedeli
  const netPayment = input.totalSalary - dayDeduction - primDeduction + fmAmount + overtimeAmount + mealAmount;
  
  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    deficitDays,
    dayDeduction: Math.round(dayDeduction * 100) / 100,
    primDeduction: Math.round(primDeduction * 100) / 100,
    overtimeAmount: Math.round(overtimeAmount * 100) / 100,
    fmAmount: Math.round(fmAmount * 100) / 100,
    mealAmount,
    netPayment: Math.round(netPayment * 100) / 100,
    totalPrim,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
  };
}

/**
 * EmployeeSummary'den SalaryInput oluştur (otomatik alanları doldur)
 */
export function buildSalaryInputFromSummary(
  summary: EmployeeSummary,
  position: Position | undefined,
  trackingDays: number,
  salaryDivisor: number = 30,
  manualInputs?: { unpaidLeaveDays?: number; sickLeaveDays?: number; mealAllowance?: number }
): SalaryInput {
  const totalSalary = position?.totalSalary || 33000;
  const baseSalary = position?.baseSalary || 31000;
  const kasaPrim = position?.kasaPrim || 0;
  const performansPrim = position?.performansPrim || 0;
  
  return {
    employeeId: 0, // caller tarafından set edilecek
    employeeName: summary.name,
    positionName: position?.name || "Bilinmiyor",
    totalSalary,
    baseSalary,
    kasaPrim,
    performansPrim,
    salaryDivisor,
    trackingDays,
    workedDays: summary.workDays,
    offDays: summary.offDays,
    fmMinutes: calculateFMMinutes(summary.dailyReports),
    overtimeDaysHoliday: calculateOvertimeDaysHoliday(summary.dailyReports),
    unpaidLeaveDays: manualInputs?.unpaidLeaveDays || 0,
    sickLeaveDays: manualInputs?.sickLeaveDays || 0,
    mealAllowance: manualInputs?.mealAllowance || 0,
  };
}
