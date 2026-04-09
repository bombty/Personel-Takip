/**
 * DOSPRESSO Maaş Hesaplama Motoru v2
 * 
 * TEMEL KURALLAR:
 * - Günlük brüt süre: 8.5 saat (şubede kalma)
 * - Mola: 1 saat (mesaiden SAYILMAZ)
 * - Günlük net çalışma: 7.5 saat = 450 dakika
 * - Haftalık: 6 gün × 7.5 saat = 45 saat
 * 
 * FORMÜLLER (Excel'den birebir):
 * - Günlük Ücret = Toplam Maaş ÷ Bölen (varsayılan 30)
 * - FM saatlik ücret = Günlük Ücret ÷ 8 (Varsayımlar: Aylık saat = Gün × 8)
 * - FM Tutarı = FM_dakika × (Günlük_Ücret / 480) × 1.5
 * - Mesai Gün Tutarı = Mesai_Gün × Günlük_Ücret × Çarpan
 * - Gün Kesinti = Eksik_Gün × Günlük_Ücret (opsiyonel +1 ceza)
 * - Yemek Bedeli = Çalışılan Gün × Günlük Yemek Ücreti (pozisyona göre)
 * - NET = Toplam Maaş - Gün Kesinti - Prim Kesinti + FM Tutarı + Mesai Tutarı + Yemek
 */

// ===== DÖNEM AYARLARI =====
export interface PeriodSettings {
  // Temel
  salaryDivisor: number;          // Günlük ücret böleni (varsayılan: 30)
  trackingDays: number;           // Devam takip günü (ayın iş günü sayısı)
  
  // Çalışma saatleri
  dailyGrossHours: number;        // Şubede kalma süresi (varsayılan: 8.5)
  dailyBreakMinutes: number;      // Mola süresi dk (varsayılan: 60)
  dailyNetMinutes: number;        // Net çalışma dk (varsayılan: 450 = 7.5 saat)
  weeklyNetHours: number;         // Haftalık net saat (varsayılan: 45)
  workDaysPerWeek: number;        // Haftalık iş günü (varsayılan: 6)
  
  // FM (Fazla Mesai)
  fmCalcBasis: number;            // FM hesap bazı saat (varsayılan: 8, Varsayımlar'dan)
  fmMultiplier: number;           // FM çarpanı (varsayılan: 1.5)
  fmDailyMinThreshold: number;    // Günlük minimum FM eşiği dk (varsayılan: 30)
  
  // Mesai (Tatil/Bayram)
  holidayMultiplier: number;      // Tatil mesai çarpanı (varsayılan: 1, Excel gerçeği)
  
  // Kesinti
  deficitPenaltyPlusOne: boolean; // Eksik gün +1 ceza kuralı (varsayılan: false)
  autoPrimDeduction: boolean;     // Otomatik prim kesintisi (varsayılan: false)
  
  // Toleranslar
  lateToleranceMinutes: number;   // Geç kalma toleransı dk (varsayılan: 0)
  earlyLeaveToleranceMinutes: number; // Erken çıkış toleransı dk (varsayılan: 0)
  breakOverTolerance: number;     // Mola aşım toleransı dk (varsayılan: 5)
  
  // Yemek
  mealAllowancePerDay: number;    // Günlük yemek bedeli ₺ (varsayılan: 330)
  mealAllowancePositions: string[]; // Yemek bedeli alan pozisyonlar (varsayılan: ["Stajyer"])
}

export const DEFAULT_PERIOD_SETTINGS: PeriodSettings = {
  salaryDivisor: 30,
  trackingDays: 30,
  dailyGrossHours: 8.5,
  dailyBreakMinutes: 60,
  dailyNetMinutes: 450,
  weeklyNetHours: 45,
  workDaysPerWeek: 6,
  fmCalcBasis: 8,
  fmMultiplier: 1.5,
  fmDailyMinThreshold: 30,
  holidayMultiplier: 1,
  deficitPenaltyPlusOne: false,
  autoPrimDeduction: false,
  lateToleranceMinutes: 0,
  earlyLeaveToleranceMinutes: 0,
  breakOverTolerance: 5,
  mealAllowancePerDay: 330,
  mealAllowancePositions: ["Stajyer"],
};

// ===== PERSONEL GİRDİSİ =====
export interface PayrollInput {
  employeeName: string;
  positionName: string;
  
  // Maaş (kişi bazlı override destekli)
  totalSalary: number;
  baseSalary: number;
  kasaPrim: number;
  performansPrim: number;
  
  // 🔵 Otomatik (PDKS'den)
  workedDays: number;
  offDays: number;
  fmMinutes: number;           // toplam FM dakika (30dk+ günlerin toplamı)
  holidayWorkedDays: number;   // tatil/bayram çalışılan gün (ondalıklı: 3.5)
  
  // 🟡 Manuel
  unpaidLeaveDays: number;
  sickLeaveDays: number;
  manualMealAllowance?: number; // manuel yemek bedeli (override)
  manualPrimDeduction?: number; // manuel prim kesintisi
}

// ===== HESAPLAMA SONUCU =====
export interface PayrollResult {
  dailyRate: number;
  deficitDays: number;
  penaltyDays: number;         // kesinti uygulanan gün (+1 varsa)
  dayDeduction: number;
  primDeduction: number;
  fmAmount: number;
  holidayAmount: number;
  mealAllowance: number;
  netPayment: number;
  
  // Detay
  fmHourlyRate: number;
  totalPrim: number;
  grossBeforeDeductions: number;
}

// ===== ANA HESAPLAMA =====
export function calculatePayroll(
  input: PayrollInput,
  settings: PeriodSettings
): PayrollResult {
  const totalPrim = input.kasaPrim + input.performansPrim;
  
  // 1. Günlük Ücret = Toplam Maaş ÷ Bölen
  const dailyRate = input.totalSalary / settings.salaryDivisor;
  
  // 2. Eksik Gün = Takip Günü - Çalışılan - Off - Ücretsiz İzin - Rapor
  const deficitDays = Math.max(0,
    settings.trackingDays - input.workedDays - input.offDays 
    - input.unpaidLeaveDays - input.sickLeaveDays
  );
  
  // 3. Kesinti Günü (opsiyonel +1 ceza)
  const penaltyDays = deficitDays > 0 && settings.deficitPenaltyPlusOne
    ? deficitDays + 1
    : deficitDays;
  
  // 4. Gün Kesinti = Kesinti Günü × Günlük Ücret
  const dayDeduction = penaltyDays * dailyRate;
  
  // 5. Prim Kesinti (varsayılan: 0, manuel veya oran bazlı)
  let primDeduction = 0;
  if (input.manualPrimDeduction !== undefined && input.manualPrimDeduction > 0) {
    primDeduction = input.manualPrimDeduction;
  } else if (settings.autoPrimDeduction && deficitDays > 0 && settings.trackingDays > 0) {
    primDeduction = (deficitDays / settings.trackingDays) * totalPrim;
  }
  
  // 6. FM Saatlik Ücret = Günlük Ücret ÷ FM Hesap Bazı (8 saat)
  //    FM Dakika Ücret = FM Saatlik ÷ 60
  //    FM Tutarı = FM_dakika × FM_dakika_ücret × Çarpan (1.5)
  const fmHourlyRate = dailyRate / settings.fmCalcBasis;
  const fmMinuteRate = fmHourlyRate / 60;
  const fmAmount = input.fmMinutes * fmMinuteRate * settings.fmMultiplier;
  
  // 7. Mesai Gün (Tatil/Bayram) Tutarı = Gün × Günlük Ücret × Çarpan
  const holidayAmount = input.holidayWorkedDays * dailyRate * settings.holidayMultiplier;
  
  // 8. Yemek Bedeli
  let mealAllowance = 0;
  if (input.manualMealAllowance !== undefined) {
    mealAllowance = input.manualMealAllowance;
  } else if (settings.mealAllowancePositions.includes(input.positionName)) {
    mealAllowance = input.workedDays * settings.mealAllowancePerDay;
  }
  
  // 9. NET ÖDEME = Maaş - Gün Kesinti - Prim Kesinti + FM + Mesai + Yemek
  const grossBeforeDeductions = input.totalSalary + fmAmount + holidayAmount + mealAllowance;
  const netPayment = input.totalSalary - dayDeduction - primDeduction + fmAmount + holidayAmount + mealAllowance;
  
  return {
    dailyRate: round2(dailyRate),
    deficitDays,
    penaltyDays,
    dayDeduction: round2(dayDeduction),
    primDeduction: round2(primDeduction),
    fmAmount: round2(fmAmount),
    holidayAmount: round2(holidayAmount),
    mealAllowance: round2(mealAllowance),
    netPayment: round2(netPayment),
    fmHourlyRate: round2(fmHourlyRate),
    totalPrim,
    grossBeforeDeductions: round2(grossBeforeDeductions),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ===== FM DAKİKA HESABI (PDKS'den) =====
/**
 * Günlük raporlardan toplam FM dakikasını hesaplar.
 * Kural: Günlük net çalışma > dailyNetMinutes ise fark FM.
 * Günlük FM < fmDailyMinThreshold ise o gün sayılmaz.
 */
export function calculateFMFromDailyReports(
  dailyReports: Array<{
    netWorkMinutes: number;
    isOffDay: boolean;
    isOnLeave: boolean;
    isHoliday: boolean;
    punchCount: number;
  }>,
  settings: PeriodSettings
): number {
  let totalFM = 0;
  
  for (const day of dailyReports) {
    if (day.isOffDay || day.isOnLeave || day.isHoliday) continue;
    if (day.punchCount < 2) continue;
    
    const dailyFM = day.netWorkMinutes - settings.dailyNetMinutes;
    if (dailyFM >= settings.fmDailyMinThreshold) {
      totalFM += dailyFM;
    }
  }
  
  return Math.round(totalFM);
}

// ===== TATİL MESAİ GÜN HESABI =====
export function calculateHolidayWorkedDays(
  dailyReports: Array<{
    netWorkMinutes: number;
    isHoliday: boolean;
    punchCount: number;
  }>,
  settings: PeriodSettings
): number {
  let total = 0;
  
  for (const day of dailyReports) {
    if (!day.isHoliday || day.punchCount < 2) continue;
    // Çalışma saati / 8 = gün (0.5 adımla yuvarla)
    const hoursWorked = day.netWorkMinutes / 60;
    const daysWorked = Math.round(hoursWorked / settings.fmCalcBasis * 2) / 2;
    total += daysWorked;
  }
  
  return total;
}

// ===== EXCEL DOĞRULAMA =====
/**
 * Mart 2026 verileriyle formül doğrulaması
 */
export function validateFormulas(): string[] {
  const results: string[] = [];
  const settings: PeriodSettings = { ...DEFAULT_PERIOD_SETTINGS, trackingDays: 30 };
  
  // Test: Eren Demir (Barista, 41K, 27 gün, 4 off, 3.5 mesai, 550 FM dk)
  const eren = calculatePayroll({
    employeeName: "EREN DEMİR", positionName: "Barista",
    totalSalary: 41000, baseSalary: 31000, kasaPrim: 3500, performansPrim: 6500,
    workedDays: 27, offDays: 4, fmMinutes: 550, holidayWorkedDays: 3.5,
    unpaidLeaveDays: 0, sickLeaveDays: 0,
  }, settings);
  
  results.push(`Eren Günlük: ${eren.dailyRate} (beklenen: 1366.67) ${Math.abs(eren.dailyRate - 1366.67) < 1 ? "✅" : "❌"}`);
  results.push(`Eren FM: ${eren.fmAmount} (beklenen: 2348.96) ${Math.abs(eren.fmAmount - 2348.96) < 1 ? "✅" : "❌"}`);
  results.push(`Eren Mesai: ${eren.holidayAmount} (beklenen: 4783.33) ${Math.abs(eren.holidayAmount - 4783.33) < 1 ? "✅" : "❌"}`);
  results.push(`Eren Net: ${eren.netPayment} (beklenen: 48132.29) ${Math.abs(eren.netPayment - 48132.29) < 1 ? "✅" : "❌"}`);
  
  // Test: Berkan Bozdağ (Bar Buddy, 36K, 25 gün, 4 off, 1 eksik)
  const berkan = calculatePayroll({
    employeeName: "BERKAN BOZDAĞ", positionName: "Bar Buddy",
    totalSalary: 36000, baseSalary: 31000, kasaPrim: 3500, performansPrim: 1500,
    workedDays: 25, offDays: 4, fmMinutes: 105, holidayWorkedDays: 2.5,
    unpaidLeaveDays: 0, sickLeaveDays: 0,
  }, settings);
  
  results.push(`Berkan Kesinti: ${berkan.dayDeduction} (beklenen: 1200) ${Math.abs(berkan.dayDeduction - 1200) < 1 ? "✅" : "❌"}`);
  results.push(`Berkan Net: ${berkan.netPayment} (beklenen: 38193.75) ${Math.abs(berkan.netPayment - 38193.75) < 1 ? "✅" : "❌"}`);
  
  // Test: Stajyer yemek bedeli (Yağız, 33K, 2 gün)
  const yagiz = calculatePayroll({
    employeeName: "YAĞIZ TÖRER", positionName: "Stajyer",
    totalSalary: 33000, baseSalary: 31000, kasaPrim: 3500, performansPrim: 0,
    workedDays: 2, offDays: 0, fmMinutes: 0, holidayWorkedDays: 0,
    unpaidLeaveDays: 0, sickLeaveDays: 0,
  }, settings);
  
  results.push(`Yağız Yemek: ${yagiz.mealAllowance} (beklenen: 660) ${Math.abs(yagiz.mealAllowance - 660) < 1 ? "✅" : "❌"}`);
  results.push(`Yağız Net: ${yagiz.netPayment} (beklenen: 2860) ${Math.abs(yagiz.netPayment - 2860) < 1 ? "✅" : "❌"}`);
  
  return results;
}
