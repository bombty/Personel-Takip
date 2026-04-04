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
    .map(d => {
      const mola = d.breakMinutesActual != null ? ` | Mola: ${d.breakMinutesActual}dk` : "";
      return `  ${d.date} (${d.dayName}): ${d.status.join(", ")} - ${d.punchCount} okutma${mola}, ${Math.round(d.netWorkMinutes)} dk net`;
    })
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

SORUNLU/DIKKAT GEREKTIREN GUNLER:
${issuesDays || "  Sorun yok"}
`;
}

function buildPunchAnomalyContext(s: EmployeeSummary): string {
  const lines: string[] = [];

  // Mola ihlalleri
  const molaSorunlari = s.dailyReports.filter(d =>
    d.status.some(st => st.includes("Uygunsuz Mola")) && d.breakMinutesActual != null
  );
  if (molaSorunlari.length > 0) {
    lines.push("UYGUNSUZ MOLA DETAYI (limit: 60 dk):");
    molaSorunlari.forEach(d => {
      const fazla = (d.breakMinutesActual ?? 60) - 60;
      lines.push(`  ${d.date}: Mola=${d.breakMinutesActual}dk (${fazla}dk fazla) | Net calisma: ${d.netWorkMinutes}dk`);
    });
  }

  // Cift okutma duzeltmeleri
  const ciftOkutma = s.dailyReports.filter(d =>
    d.status.some(st => st.includes("Cift Okutma Duzeltildi"))
  );
  if (ciftOkutma.length > 0) {
    lines.push("CIFT OKUTMA DUZELTME (yanlilikla 2x basilan):");
    ciftOkutma.forEach(d => {
      const st = d.status.find(s => s.includes("Cift Okutma"));
      lines.push(`  ${d.date}: ${st} | Sonuc: ${d.punchCount} okutma ile islendi`);
    });
  }

  // Tek okutma (eksik cikis suphesi)
  const tekOkutma = s.dailyReports.filter(d =>
    d.status.some(st => st.includes("Eksik Cikis Suphesi"))
  );
  if (tekOkutma.length > 0) {
    lines.push("EKSIK CIKIS SUPHESI (7.5 saat varsayilarak hesaplandi):");
    tekOkutma.forEach(d => {
      lines.push(`  ${d.date}: Sadece ${d.punchCount} okutma mevcut, ${d.netWorkMinutes}dk varsayildi`);
    });
  }

  // Gece vardiyasi
  const geceVardiyasi = s.dailyReports.filter(d =>
    d.status.includes("Gece Gecisi")
  );
  if (geceVardiyasi.length > 0) {
    lines.push(`GECE VARDIYAS: ${geceVardiyasi.length} gun gece vardiyasi calisaldi`);
  }

  // Cok kısa cok uzun
  const extremeDays = s.dailyReports.filter(d =>
    d.status.some(st => st.includes("Cok Kisa") || st.includes("Cok Uzun"))
  );
  if (extremeDays.length > 0) {
    lines.push("ASIRI KISA/UZUN CALISMA:");
    extremeDays.forEach(d => {
      lines.push(`  ${d.date}: Net=${d.netWorkMinutes}dk, Durum: ${d.status.join(",")}`);
    });
  }

  return lines.length > 0 ? lines.join("\n") : "Ozel anomali yok.";
}

export async function analyzeGeneralReport(
  summaries: EmployeeSummary[],
  settings: Record<string, string>
): Promise<string> {
  const employeeSummaryTexts = summaries.map(s => summarizeEmployee(s)).join("\n---\n");

  // Tum anomalileri ozetle
  const uygunsuzMolaToplam = summaries.reduce((sum, s) =>
    sum + s.dailyReports.filter(d => d.status.some(st => st.includes("Uygunsuz Mola"))).length, 0);
  const ciftOkutmaToplam = summaries.reduce((sum, s) =>
    sum + s.dailyReports.filter(d => d.status.some(st => st.includes("Cift Okutma Duzeltildi"))).length, 0);
  const eksikCikisToplam = summaries.reduce((sum, s) =>
    sum + s.dailyReports.filter(d => d.status.some(st => st.includes("Eksik Cikis"))).length, 0);

  const prompt = `Sen DOSPRESSO cafe zinciri icin insan kaynaklari ve bordro uzmanisin. Asagidaki cafe personellerinin aylik devam kontrol (PDKS) verilerini analiz et.

SISTEM KURALLARI:
- Full-time haftalik calisma: ${settings.fullTimeWeeklyHours || "45"} saat (6 gun x 7.5 saat)
- Gunluk mola: ${settings.breakMinutes || "60"} dakika (maasten SAYILMAZ)
- Mola limiti: 60 dakika. Fazlasi uygunsuz mola sayilir ve maastan kesilir
- Acilis saati: 08:00. Sonrasi = gec giris (tolerans yok)
- Kapanista calisanlar 00:00 sonrasi cikiyor (onceki gune sayilir)
- Tek okutma: Cikis yapilamamis, o gun 7.5 saat varsayilir + uyarı

OTOMATIK DUZELTMELER:
- Cift mola donusu: Sistem yanlilikla tekrar basilan okutmayi (2-20 dk aralikli) otomatik temizledi
- Bu ay toplam ${ciftOkutmaToplam} gun cift okutma duzeltmesi yapildi
- Bu ay toplam ${uygunsuzMolaToplam} gun uygunsuz mola tespiti yapildi
- Bu ay toplam ${eksikCikisToplam} gun eksik cikis suphesi var

PERSONEL VERILERI:
${employeeSummaryTexts}

Lutfen asagidaki konularda Turkce bir degerlendirme yap:

1. **Genel Ozet**: Tum personelin genel performans ve uyum durumu
2. **Kritik Sorunlar**: Uygunsuz mola, eksik cikis, haftalik eksik calisma
3. **Sistematik Tutarsizliklar**: Belirli personelde tekrarlayan paternler (her gunu mola uzun, hep tek okutma vb.)
4. **Cift Okutma / Yanlis Basim**: Otomatik duzeltilen gunde herhangi bir risk var mi?
5. **Bordro Etkisi**: Bu ay calisanlarin ne kadari mola kesintisinden etkilendi?
6. **Oneriler**: Yonetici icin somut adimlar, hangi calisan uyarilmali, nasil onlenmeli?

Yaniti markdown formatinda ver. Onemli rakamlari vurgula.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2500,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "Analiz yapilamadi.";
}

export async function analyzeEmployeeReport(
  summary: EmployeeSummary,
  settings: Record<string, string>
): Promise<string> {
  const employeeText = summarizeEmployee(summary);
  const anomalyContext = buildPunchAnomalyContext(summary);

  const dailyDetail = summary.dailyReports
    .filter(d => d.punchCount > 0)
    .map(d => {
      const pairs = d.pairs.map((p, i) => `${i === 0 ? "Giris" : "Giris2"}=${p.in} ${i === 0 ? "Cikis" : "Cikis2"}=${p.out}`).join(" ");
      const mola = d.breakMinutesActual != null ? ` Mola=${d.breakMinutesActual}dk` : "";
      const gece = d.nightCrossing ? " [GECE]" : "";
      return `${d.date} ${d.dayName}${gece}: ${pairs}${mola} | Net=${d.netWorkMinutes}dk | ${d.status.join(",")}`;
    })
    .join("\n");

  const prompt = `Sen DOSPRESSO cafe zinciri icin insan kaynaklari ve bordro uzmanisin. Asagidaki cafe personelinin aylik devam kontrol (PDKS) verilerini detayli analiz et.

SISTEM KURALLARI:
- Haftalik beklenen: ${settings.fullTimeWeeklyHours || "45"} saat (6 gun x 7.5 saat net)
- Gunluk mola: ${settings.breakMinutes || "60"} dk (maasten SAYILMAZ). 60 dk uzeri = uygunsuz mola = kesinti
- Acilis 08:00 — tolerans yok. Tek okutma = 7.5 saat varsayilir + uyarı
- 4 okutma: Giris | Mola-cikis | Mola-donus | Mesai-bitis
- Parmak izi yanlilikla tekrar basilabilir (2-20 dk arasi duplikat otomatik temizlendi)

PERSONEL OZETI:
${employeeText}

OKUTMA ANOMALI DETAYI:
${anomalyContext}

TUM GUNLUK DETAY:
${dailyDetail}

Lutfen asagidaki konularda Turkce detayli bir degerlendirme yap:

1. **Personel Profili**: Calisma tipi, genel performans, haftalik 45 saate uyum
2. **Mola Analizi**: Mola sureleri tutarli mi? Uygunsuz mola egilimleri var mi? Kasitli mi yoksa unutkanlik mi?
3. **Okutma Kalitesi**: Cift basim duzeltmeleri, eksik cikislar — calisan dikkat etmeli mi?
4. **Vardiya Analizi**: Gunduz/gece vardiyasi paternleri, gece vardiyas riski
5. **Bordro Etkisi**: Bu ay kac dakika mola kesintisi var? Haftalik eksik var mi?
6. **Yonetici Icin Oneri**: Bu calisan icin ne yapilmali? Uyari mi, egitim mi, normal mi?

Yaniti markdown formatinda ver. Rakamsal hesaplamalari goster.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2500,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || "Analiz yapilamadi.";
}
