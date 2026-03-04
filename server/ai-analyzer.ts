import OpenAI from "openai";
import type { EmployeeSummary } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function summarizeEmployee(s: EmployeeSummary): string {
  const weeklyInfo = s.weeklyBreakdown.map(w =>
    `  Hafta ${w.weekStart}: ${Math.round(w.totalMinutes / 60 * 10) / 10}s calisma, ${Math.round(w.expectedMinutes / 60 * 10) / 10}s beklenen, mesai: ${Math.round(w.overtimeMinutes / 60 * 10) / 10}s, eksik: ${Math.round(w.deficitMinutes / 60 * 10) / 10}s`
  ).join("\n");

  const issuesDays = s.dailyReports
    .filter(d => d.status.some(st => !["Normal", "Off", "Izinli", "Gece Gecisi"].includes(st)))
    .map(d => `  ${d.date} (${d.dayName}): ${d.status.join(", ")} - ${d.punchCount} okutma, ${Math.round(d.netWorkMinutes)} dk net calisma`)
    .join("\n");

  return `
PERSONEL: ${s.name} (Sicil: ${s.enNo})
Tip: ${s.employmentType === "full_time" ? "Tam Zamanli" : "Yari Zamanli"}
Haftalik Beklenen: ${s.weeklyHoursExpected} saat
Is Gunu: ${s.workDays}, Off: ${s.offDays}, Izin: ${s.leaveDays}
Aylik Toplam: ${s.monthlyTotalHours}s / Beklenen: ${s.monthlyExpectedHours}s
Performans: %${s.performancePercent}
Toplam Mesai: ${Math.round(s.totalOvertimeMinutes / 60 * 10) / 10} saat
Toplam Eksik: ${Math.round(s.totalDeficitMinutes / 60 * 10) / 10} saat
Gec Kalma: ${s.lateDays} gun, Erken Cikis: ${s.earlyLeaveDays} gun
Sorun Sayisi: ${s.issueCount}
Ort. Gunluk Calisma: ${Math.round(s.avgDailyMinutes)} dk

HAFTALIK KIRILIM:
${weeklyInfo || "  Veri yok"}

SORUNLU GUNLER:
${issuesDays || "  Sorun yok"}
`;
}

export async function analyzeGeneralReport(
  summaries: EmployeeSummary[],
  settings: Record<string, string>
): Promise<string> {
  const employeeSummaryTexts = summaries.map(s => summarizeEmployee(s)).join("\n---\n");

  const prompt = `Sen bir insan kaynaklari ve bordro uzmanisin. Asagidaki cafe personellerinin aylik devam kontrol (PDKS) verilerini analiz et.

GENEL AYARLAR:
- Full-time haftalik calisma: ${settings.fullTimeWeeklyHours || "45"} saat
- Part-time haftalik calisma: ${settings.partTimeWeeklyHours || "30"} saat
- Gunluk mola suresi: ${settings.breakMinutes || "60"} dakika
- Gec kalma toleransi: ${settings.lateToleranceMinutes || "5"} dakika
- Erken cikis toleransi: ${settings.earlyLeaveToleranceMinutes || "5"} dakika

PERSONEL VERILERI:
${employeeSummaryTexts}

Lutfen asagidaki konularda Turkce bir degerlendirme yap:

1. **Genel Ozet**: Tum personelin genel performans durumu
2. **Dikkat Edilmesi Gereken Personeller**: Dusuk performans, cok fazla mesai veya sorunlu kayitlari olan personeller
3. **Calisma Duzeni Analizi**: Mesai dagilimi, duzensiz calisma paternleri
4. **Kayit Sorunlari**: Eksik/fazla okutma, tek okutma gibi sistem sorunlari
5. **Oneriler**: Is verimliligi ve bordro dogrulugu icin yapilabilecek iyilestirmeler

Yaniti markdown formatinda ver. Kisa ve oze yonelik ol.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "Analiz yapilamadi.";
}

export async function analyzeEmployeeReport(
  summary: EmployeeSummary,
  settings: Record<string, string>
): Promise<string> {
  const employeeText = summarizeEmployee(summary);

  const dailyDetail = summary.dailyReports
    .filter(d => d.punchCount > 0)
    .map(d => `${d.date} ${d.dayName}: Giris=${d.pairs[0]?.in || "-"} Cikis=${d.pairs[0]?.out || "-"} ${d.pairs[1] ? `Giris2=${d.pairs[1].in} Cikis2=${d.pairs[1].out}` : ""} Toplam=${d.totalWorkMinutes}dk Net=${d.netWorkMinutes}dk Durum=${d.status.join(",")}`)
    .join("\n");

  const prompt = `Sen bir insan kaynaklari ve bordro uzmanisin. Asagidaki cafe personelinin aylik devam kontrol (PDKS) verilerini detayli analiz et.

GENEL AYARLAR:
- Full-time haftalik calisma: ${settings.fullTimeWeeklyHours || "45"} saat
- Part-time haftalik calisma: ${settings.partTimeWeeklyHours || "30"} saat
- Gunluk mola suresi: ${settings.breakMinutes || "60"} dakika

PERSONEL OZETI:
${employeeText}

GUNLUK DETAY:
${dailyDetail}

Lutfen asagidaki konularda Turkce detayli bir degerlendirme yap:

1. **Personel Profili**: Calisma tipi ve genel performans degerlendirmesi
2. **Calisma Duzeni**: Gunluk calisma saatleri tutarli mi? Duzensizlikler var mi?
3. **Mesai Analizi**: Haftalik mesai dagilimi, asiri mesai riski
4. **Sorunlu Kayitlar**: Eksik okutma, tek okutma veya tutarsiz gunler
5. **Gec Kalma/Erken Cikis Egilimleri**: Bir patern var mi?
6. **Bordro Onerisi**: Bu personel icin bordro hesaplamasinda dikkat edilmesi gerekenler
7. **Genel Degerlendirme**: Ozet ve oneriler

Yaniti markdown formatinda ver. Kisa ve oze yonelik ol.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "Analiz yapilamadi.";
}
