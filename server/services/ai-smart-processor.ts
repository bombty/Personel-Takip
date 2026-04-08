/**
 * AI Akıllı Okutma Düzeltici (AI Smart Punch Corrector)
 * 
 * Bu modül, hesaplamanın İÇİNDE çalışır — sadece yorum yapmaz, aktif düzeltme yapar.
 * 
 * Akış:
 * 1. Tüm personelin tüm günlerini topla
 * 2. Her personel için çalışma pattern'ını çıkar (normal saatleri, mola alışkanlığı)
 * 3. Sorunlu günleri AI ile analiz et
 * 4. Düzeltme önerilerini confidence score ile kaydet
 * 5. Yüksek güvenli düzeltmeleri otomatik uygula, düşük güvenlileri onaya sun
 */

import OpenAI from "openai";
import type { AttendanceRecord, Employee, EmployeeAlias } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ===== TİPLER =====

interface PunchDay {
  date: string;
  punches: Date[];
  punchCount: number;
}

interface EmployeePattern {
  enNo: number;
  name: string;
  avgFirstPunch: number;   // ortalama ilk giriş (dakika cinsinden 0-1440)
  avgLastPunch: number;    // ortalama son çıkış
  avgWorkMinutes: number;  // ortalama günlük çalışma
  avgBreakMinutes: number; // ortalama mola süresi
  mostCommonPunchCount: number; // en sık okutma sayısı (2 veya 4)
  typicalBreakStart: number;   // mola genelde saat kaçta
  typicalBreakEnd: number;
  totalWorkDays: number;
  reliability: number;     // 0-100 — pattern güvenilirliği (yeterli veri var mı?)
}

export interface PunchCorrection {
  enNo: number;
  name: string;
  date: string;
  originalPunches: string[];  // ["08:00", "17:30"]
  correctedPunches: string[]; // ["08:00", "12:00", "13:00", "17:30"]
  correctionType: "missing_exit" | "missing_entry" | "missing_break_out" | "missing_break_in" | "duplicate" | "anomaly";
  confidence: number;  // 0-100
  reasoning: string;   // Türkçe açıklama
  estimatedWorkMinutes: number; // düzeltilmiş net çalışma
}

// ===== PATTERN ÇIKARMA =====

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function assignWorkDay(dt: Date): string {
  const hour = dt.getHours();
  if (hour < 7) {
    const prev = new Date(dt);
    prev.setDate(prev.getDate() - 1);
    return localDateKey(prev);
  }
  return localDateKey(dt);
}

/**
 * Bir personelin tüm PDKS kayıtlarından çalışma pattern'ını çıkarır
 */
export function extractEmployeePattern(records: AttendanceRecord[]): EmployeePattern {
  // Günlere böl
  const byDay = new Map<string, Date[]>();
  for (const rec of records) {
    const dt = new Date(rec.dateTime);
    const workDay = assignWorkDay(dt);
    if (!byDay.has(workDay)) byDay.set(workDay, []);
    byDay.get(workDay)!.push(dt);
  }

  // Her günü sırala
  for (const [, punches] of byDay) {
    punches.sort((a, b) => a.getTime() - b.getTime());
  }

  // İstatistikler
  const firstPunches: number[] = [];
  const lastPunches: number[] = [];
  const workMinutesList: number[] = [];
  const breakMinutesList: number[] = [];
  const punchCounts: number[] = [];
  const breakStarts: number[] = [];
  const breakEnds: number[] = [];

  for (const [, punches] of byDay) {
    if (punches.length < 2) continue;

    const first = minutesSinceMidnight(punches[0]);
    const last = minutesSinceMidnight(punches[punches.length - 1]);
    // Gece geçişi: son okutma sabah erken saatlerde
    const adjustedLast = last < first ? last + 1440 : last;

    firstPunches.push(first);
    lastPunches.push(adjustedLast);
    punchCounts.push(punches.length);

    const totalMinutes = (punches[punches.length - 1].getTime() - punches[0].getTime()) / 60000;
    workMinutesList.push(totalMinutes);

    // 4 okutma → mola bilgisi
    if (punches.length === 4) {
      const breakStart = minutesSinceMidnight(punches[1]);
      const breakEnd = minutesSinceMidnight(punches[2]);
      const breakDuration = (punches[2].getTime() - punches[1].getTime()) / 60000;
      if (breakDuration > 10 && breakDuration < 180) {
        breakMinutesList.push(breakDuration);
        breakStarts.push(breakStart);
        breakEnds.push(breakEnd);
      }
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const mode = (arr: number[]) => {
    const freq = new Map<number, number>();
    arr.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
    let maxCount = 0, maxVal = 0;
    freq.forEach((count, val) => { if (count > maxCount) { maxCount = count; maxVal = val; } });
    return maxVal;
  };

  return {
    enNo: records[0]?.enNo || 0,
    name: records[0]?.name || "",
    avgFirstPunch: Math.round(avg(firstPunches)),
    avgLastPunch: Math.round(avg(lastPunches)),
    avgWorkMinutes: Math.round(avg(workMinutesList)),
    avgBreakMinutes: Math.round(avg(breakMinutesList)),
    mostCommonPunchCount: mode(punchCounts),
    typicalBreakStart: Math.round(avg(breakStarts)),
    typicalBreakEnd: Math.round(avg(breakEnds)),
    totalWorkDays: byDay.size,
    reliability: Math.min(100, byDay.size * 10), // 10 iş günü = %100 güvenilir
  };
}

// ===== KURAL BAZLI DÜZELTME (AI olmadan hızlı) =====

export function detectPunchIssues(
  enNo: number,
  name: string,
  dayPunches: PunchDay[],
  pattern: EmployeePattern
): PunchCorrection[] {
  const corrections: PunchCorrection[] = [];

  for (const day of dayPunches) {
    const { date, punches, punchCount } = day;
    const punchTimes = punches.map(p => minutesSinceMidnight(p));
    const punchStrings = punches.map(p => {
      const h = String(p.getHours()).padStart(2, "0");
      const m = String(p.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    });

    // === 1 OKUTMA: Çıkış unutulmuş ===
    if (punchCount === 1) {
      // Pattern'dan tahmini çıkış saati
      let estimatedExit = pattern.avgLastPunch;
      let confidence = 0;
      let reasoning = "";

      if (pattern.reliability >= 50) {
        confidence = Math.min(85, pattern.reliability);
        reasoning = `${name} genelde ${formatMinutes(pattern.avgLastPunch)}'de çıkış yapıyor. ` +
          `Bugün sadece ${punchStrings[0]} girişi var, çıkış unutulmuş olabilir. ` +
          `Pattern güvenilirliği: %${pattern.reliability} (${pattern.totalWorkDays} iş günü verisi).`;
      } else {
        estimatedExit = punchTimes[0] + 510; // varsayılan 8.5 saat
        confidence = 40;
        reasoning = `Yeterli pattern verisi yok (${pattern.totalWorkDays} gün). ` +
          `Standart 8.5 saat varsayımıyla ${formatMinutes(estimatedExit)} çıkışı tahmin edildi.`;
      }

      const netWork = estimatedExit - punchTimes[0] - (pattern.avgBreakMinutes || 60);

      corrections.push({
        enNo, name, date,
        originalPunches: punchStrings,
        correctedPunches: [punchStrings[0], formatMinutes(estimatedExit)],
        correctionType: "missing_exit",
        confidence,
        reasoning,
        estimatedWorkMinutes: Math.max(0, netWork),
      });
    }

    // === 2 OKUTMA: Normal ama mola kontrolü ===
    if (punchCount === 2) {
      const totalMinutes = (punches[1].getTime() - punches[0].getTime()) / 60000;

      // Çok uzun çalışma (12+ saat): muhtemelen çıkış unutulup ertesi gün giriş yapılmış
      if (totalMinutes > 720) {
        corrections.push({
          enNo, name, date,
          originalPunches: punchStrings,
          correctedPunches: punchStrings, // düzeltme yok, sadece uyarı
          correctionType: "anomaly",
          confidence: 60,
          reasoning: `${name} bugün ${Math.round(totalMinutes / 60)} saat çalışmış görünüyor (${punchStrings[0]}→${punchStrings[1]}). ` +
            `Bu anormal uzunlukta — çıkış unutulmuş olabilir veya gerçekten uzun mesai.`,
          estimatedWorkMinutes: totalMinutes,
        });
      }
    }

    // === 3 OKUTMA: Hangi okutma eksik? ===
    if (punchCount === 3) {
      const gap01 = (punches[1].getTime() - punches[0].getTime()) / 60000;
      const gap12 = (punches[2].getTime() - punches[1].getTime()) / 60000;

      let correctedPunches: string[];
      let correctionType: PunchCorrection["correctionType"];
      let confidence: number;
      let reasoning: string;
      let netWork: number;

      if (pattern.reliability >= 50 && pattern.typicalBreakStart > 0) {
        // Pattern'dan mola saatlerini biliyoruz
        const breakStartDiff = Math.abs(punchTimes[1] - pattern.typicalBreakStart);
        const breakEndDiff = Math.abs(punchTimes[1] - pattern.typicalBreakEnd);

        if (breakStartDiff < breakEndDiff) {
          // 2. okutma mola çıkışı → mola dönüşü eksik
          const estimatedBreakEnd = pattern.typicalBreakEnd || (punchTimes[1] + 60);
          correctedPunches = [punchStrings[0], punchStrings[1], formatMinutes(estimatedBreakEnd), punchStrings[2]];
          correctionType = "missing_break_in";
          confidence = Math.min(80, pattern.reliability);
          reasoning = `${name} genelde ${formatMinutes(pattern.typicalBreakStart)}'de molaya çıkıyor, ${formatMinutes(pattern.typicalBreakEnd)}'de dönüyor. ` +
            `Bugün mola dönüş okutması eksik. Tahmini dönüş: ${formatMinutes(estimatedBreakEnd)}.`;
          const seg1 = punchTimes[1] - punchTimes[0];
          const seg2 = punchTimes[2] - estimatedBreakEnd;
          netWork = seg1 + Math.max(0, seg2);
        } else {
          // 2. okutma mola dönüşü → mola çıkışı eksik
          const estimatedBreakStart = pattern.typicalBreakStart || (punchTimes[1] - 60);
          correctedPunches = [punchStrings[0], formatMinutes(estimatedBreakStart), punchStrings[1], punchStrings[2]];
          correctionType = "missing_break_out";
          confidence = Math.min(80, pattern.reliability);
          reasoning = `${name} genelde ${formatMinutes(pattern.typicalBreakStart)}'de molaya çıkıyor. ` +
            `Bugün mola çıkış okutması eksik. Tahmini çıkış: ${formatMinutes(estimatedBreakStart)}.`;
          const seg1 = estimatedBreakStart - punchTimes[0];
          const seg2 = punchTimes[2] - punchTimes[1];
          netWork = Math.max(0, seg1) + seg2;
        }
      } else {
        // Pattern yok, kural bazlı (mevcut processor mantığı)
        if (gap01 < gap12) {
          correctedPunches = [punchStrings[0], punchStrings[1], formatMinutes(punchTimes[1] + 60), punchStrings[2]];
          correctionType = "missing_break_in";
          confidence = 45;
          reasoning = `Yeterli pattern yok. İlk aralık (${Math.round(gap01)}dk) < ikinci aralık (${Math.round(gap12)}dk), ` +
            `dolayısıyla mola dönüşü eksik olabilir. 60dk mola varsayıldı.`;
          netWork = gap01 + (gap12 - 60);
        } else {
          correctedPunches = [punchStrings[0], formatMinutes(punchTimes[1] - 60), punchStrings[1], punchStrings[2]];
          correctionType = "missing_break_out";
          confidence = 45;
          reasoning = `Yeterli pattern yok. İlk aralık (${Math.round(gap01)}dk) > ikinci aralık (${Math.round(gap12)}dk), ` +
            `dolayısıyla mola çıkışı eksik olabilir. 60dk mola varsayıldı.`;
          netWork = (gap01 - 60) + gap12;
        }
      }

      corrections.push({
        enNo, name, date,
        originalPunches: punchStrings,
        correctedPunches,
        correctionType,
        confidence,
        reasoning,
        estimatedWorkMinutes: Math.max(0, Math.round(netWork)),
      });
    }
  }

  return corrections;
}

// ===== AI TOPLU ANALİZ =====

/**
 * AI ile tüm şüpheli günleri toplu analiz et.
 * Kural bazlı düzeltmeleri AI ile doğrula/iyileştir.
 */
export async function aiAnalyzePunchCorrections(
  corrections: PunchCorrection[],
  patterns: Map<number, EmployeePattern>
): Promise<PunchCorrection[]> {
  if (corrections.length === 0) return [];

  // Düşük güvenli düzeltmeleri AI'a gönder
  const lowConfidence = corrections.filter(c => c.confidence < 70);
  if (lowConfidence.length === 0) return corrections;

  // AI'a göndereceğimiz context
  const patternSummary = Array.from(patterns.values())
    .map(p => `${p.name} (Sicil:${p.enNo}): Giriş ~${formatMinutes(p.avgFirstPunch)}, Çıkış ~${formatMinutes(p.avgLastPunch)}, ` +
      `Mola ~${formatMinutes(p.typicalBreakStart)}-${formatMinutes(p.typicalBreakEnd)}, Ort.çalışma=${Math.round(p.avgWorkMinutes)}dk, ` +
      `Güvenilirlik=%${p.reliability}`)
    .join("\n");

  const correctionsList = lowConfidence.map((c, i) =>
    `#${i + 1} ${c.name} (${c.date}): ${c.originalPunches.join(",")} → Önerilen: ${c.correctedPunches.join(",")} ` +
    `[${c.correctionType}] Güven:%${c.confidence}\n   Gerekçe: ${c.reasoning}`
  ).join("\n\n");

  const prompt = `Sen DOSPRESSO cafe zinciri PDKS (parmak izi devam kontrol) uzmanısın. 
Aşağıda personel çalışma pattern'ları ve düzeltme gereken okutma kayıtları var.

PERSONEL PATTERNLERİ:
${patternSummary}

DÜZELTME GEREKTİREN KAYITLAR:
${correctionsList}

Her kayıt için JSON formatında yanıt ver:
[
  {
    "index": 0,
    "approvedCorrection": ["08:00", "12:00", "13:00", "17:30"],
    "confidence": 75,
    "reasoning": "Türkçe açıklama..."
  }
]

KURALLAR:
- Pattern verisi güvenilirse (%50+), pattern'a dayanarak düzelt
- Pattern verisi yetersizse, sektör standardı uygula (08:00 giriş, 12:00-13:00 mola, 17:30 çıkış)
- 1 okutma → çıkış eksik. Pattern'dan tahmin et.
- 3 okutma → hangi mola okutması eksik? Pattern'daki mola saatlerini kullan.
- Confidence %50 altındaysa "yönetici onayı gerekli" yaz.
- SADECE JSON döndür, başka metin yazma.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const aiResults = JSON.parse(cleaned) as Array<{
      index: number;
      approvedCorrection: string[];
      confidence: number;
      reasoning: string;
    }>;

    // AI sonuçlarını mevcut düzeltmelere uygula
    for (const result of aiResults) {
      const idx = result.index;
      if (idx >= 0 && idx < lowConfidence.length) {
        const original = lowConfidence[idx];
        // AI corrections array'deki orijinal indeksi bul
        const mainIdx = corrections.indexOf(original);
        if (mainIdx >= 0) {
          corrections[mainIdx] = {
            ...corrections[mainIdx],
            correctedPunches: result.approvedCorrection,
            confidence: result.confidence,
            reasoning: result.reasoning,
          };
        }
      }
    }
  } catch (error) {
    console.error("AI punch analysis error:", error);
    // AI başarısız olursa kural bazlı düzeltmelerle devam et
  }

  return corrections;
}

// ===== MAAŞ HESAPLAMA İÇİN AI ANALİZ =====

export async function aiPayrollAnalysis(
  employeeSummaries: Array<{
    name: string;
    enNo: number;
    position: string;
    workedDays: number;
    offDays: number;
    deficitDays: number;
    fmMinutes: number;
    overtimeDaysHoliday: number;
    corrections: PunchCorrection[];
    totalSalary: number;
    netPayment: number;
  }>,
  month: string,
  branchName: string
): Promise<string> {
  const employeeLines = employeeSummaries.map(e => {
    const correctionInfo = e.corrections.length > 0
      ? `\n    AI Düzeltmeler: ${e.corrections.map(c => `${c.date} ${c.correctionType} (güven:%${c.confidence})`).join(", ")}`
      : "";
    return `  ${e.name} (${e.position}): Çalışılan=${e.workedDays}g, Off=${e.offDays}g, Eksik=${e.deficitDays}g, ` +
      `FM=${e.fmMinutes}dk, Mesai Tatil=${e.overtimeDaysHoliday}g, Brüt=${e.totalSalary}₺, Net=${Math.round(e.netPayment)}₺${correctionInfo}`;
  }).join("\n");

  const prompt = `Sen DOSPRESSO ${branchName} şubesi bordro uzmanısın. ${month} dönemi maaş hesabını incele.

PERSONEL BORDRO ÖZETİ:
${employeeLines}

Lütfen Türkçe bir analiz raporu yaz:
1. Genel bordro özeti (toplam maliyet, ortalamalar)
2. Dikkat gereken personeller (çok eksik, çok fazla mesai, düşük güvenli AI düzeltmeleri)
3. Maaş hesaplamada anomali var mı? (örn: çok fazla FM, çok fazla eksik gün)
4. Yönetici önerileri

Kısa ve öz yaz, maddeler halinde.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || "Analiz yapılamadı.";
  } catch (error) {
    console.error("AI payroll analysis error:", error);
    return "AI analizi şu anda kullanılamıyor.";
  }
}

// ===== ANA İŞLEM FONKSİYONU =====

/**
 * PDKS verilerini alıp tüm personel için pattern çıkarır ve sorunlu günleri düzeltir.
 * Bu fonksiyon processor.ts'den ÖNCE çalışır.
 */
export async function smartProcessPunches(
  records: AttendanceRecord[],
  useAI: boolean = true
): Promise<{
  corrections: PunchCorrection[];
  patterns: Map<number, EmployeePattern>;
}> {
  // 1. Personel bazlı grupla
  const byEmployee = new Map<number, AttendanceRecord[]>();
  for (const rec of records) {
    if (!byEmployee.has(rec.enNo)) byEmployee.set(rec.enNo, []);
    byEmployee.get(rec.enNo)!.push(rec);
  }

  // 2. Her personel için pattern çıkar
  const patterns = new Map<number, EmployeePattern>();
  for (const [enNo, empRecords] of byEmployee) {
    patterns.set(enNo, extractEmployeePattern(empRecords));
  }

  // 3. Her personelin sorunlu günlerini tespit et
  let allCorrections: PunchCorrection[] = [];
  for (const [enNo, empRecords] of byEmployee) {
    const pattern = patterns.get(enNo)!;

    // Günlere böl
    const byDay = new Map<string, Date[]>();
    for (const rec of empRecords) {
      const dt = new Date(rec.dateTime);
      const workDay = assignWorkDay(dt);
      if (!byDay.has(workDay)) byDay.set(workDay, []);
      byDay.get(workDay)!.push(dt);
    }

    // Her gün sırala + duplikat temizle
    const dayPunches: PunchDay[] = [];
    for (const [date, punches] of byDay) {
      const sorted = punches.sort((a, b) => a.getTime() - b.getTime());
      // 2dk altı duplikatları temizle
      const cleaned: Date[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i].getTime() - sorted[i - 1].getTime()) / 60000 >= 2) {
          cleaned.push(sorted[i]);
        }
      }
      dayPunches.push({ date, punches: cleaned, punchCount: cleaned.length });
    }

    // Sorunlu günleri bul (1, 3, veya anormal okutmalar)
    const issues = dayPunches.filter(d => d.punchCount === 1 || d.punchCount === 3 || d.punchCount >= 5);

    if (issues.length > 0) {
      const corrections = detectPunchIssues(enNo, pattern.name, issues, pattern);
      allCorrections.push(...corrections);
    }
  }

  // 4. AI ile düşük güvenli düzeltmeleri iyileştir
  if (useAI && allCorrections.some(c => c.confidence < 70)) {
    allCorrections = await aiAnalyzePunchCorrections(allCorrections, patterns);
  }

  return { corrections: allCorrections, patterns };
}
