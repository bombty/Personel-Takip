/**
 * DOSPRESSO Akıllı Şube Tespit Modülü
 * 
 * 3 Katmanlı Tespit:
 * 1. Dosya formatı analizi (AGL txt vs Excel)
 * 2. EnNo dağılım analizi (hangi şubenin personeli daha çok eşleşiyor)
 * 3. Kullanıcı onayı (sonucu göster, onayla/düzelt)
 */

import type { Employee } from "@shared/schema";

export interface BranchDetectionResult {
  detectedBranchId: number | null;
  detectedBranchName: string | null;
  confidence: number; // 0-100
  matchDetails: Array<{
    branchId: number;
    branchName: string;
    matchedCount: number;
    totalEmployees: number;
    matchedNames: string[];
    unmatchedEnNos: number[];
  }>;
  fileFormat: "agl_txt" | "excel_named" | "unknown";
  totalUniqueEnNos: number;
  reasoning: string;
}

/**
 * Dosya formatını tespit et
 */
export function detectFileFormat(content: string | null, headers: string[] | null): "agl_txt" | "excel_named" | "unknown" {
  // AGL_001.txt formatı: tab-separated, header has No/TMNo/EnNo/Name/INOUT/Mode/DateTime
  if (content) {
    const firstLine = content.split(/\r?\n/)[0]?.toLowerCase() || "";
    if (firstLine.includes("tmno") && firstLine.includes("enno") && firstLine.includes("datetime")) {
      return "agl_txt";
    }
  }
  
  // Excel formatı: KOD/İSİM/TARİH veya SIRA NO/KOD/İSİM/TARİH
  if (headers) {
    const lower = headers.map(h => (h || "").toString().toLowerCase().trim());
    const hasName = lower.some(h => h.includes("isim") || h.includes("name") || h.includes("ad"));
    const hasDate = lower.some(h => h.includes("tarih") || h.includes("date") || h.includes("time"));
    if (hasName && hasDate) return "excel_named";
  }
  
  return "unknown";
}

/**
 * Yüklenen dosyadaki EnNo'ları çıkar
 */
export function extractEnNosFromFile(
  content: string | null,
  rows: any[][] | null
): number[] {
  const enNos = new Set<number>();
  
  if (content) {
    // AGL txt format
    const lines = content.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 3) {
        const enNo = parseInt(parts[2]);
        if (!isNaN(enNo) && enNo > 0) enNos.add(enNo);
      }
    }
  }
  
  if (rows) {
    // Excel format — EnNo genelde 2. kolon (index 1) veya 1. kolon
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      // İlk 3 kolonda sayısal değer ara
      for (let c = 0; c < Math.min(3, row.length); c++) {
        const val = parseInt(String(row[c]));
        if (!isNaN(val) && val > 0 && val < 200000) {
          enNos.add(val);
          break; // ilk bulunan sayı EnNo
        }
      }
    }
  }
  
  return Array.from(enNos);
}

/**
 * Ana şube tespit fonksiyonu
 */
export function detectBranch(
  fileEnNos: number[],
  allEmployees: Employee[],
  branches: Array<{ id: number; name: string }>,
  fileFormat: "agl_txt" | "excel_named" | "unknown"
): BranchDetectionResult {
  const uniqueEnNos = [...new Set(fileEnNos)];
  
  // Her şube için eşleşme hesapla
  const matchDetails = branches.map(branch => {
    const branchEmployees = allEmployees.filter(e => e.branchId === branch.id && e.active);
    const branchEnNos = new Set(branchEmployees.map(e => e.enNo));
    
    const matched: string[] = [];
    const unmatched: number[] = [];
    
    for (const enNo of uniqueEnNos) {
      const emp = branchEmployees.find(e => e.enNo === enNo);
      if (emp) {
        matched.push(`${emp.fullName || emp.name} (${enNo})`);
      }
    }
    
    // Dosyadaki ama şubede olmayan EnNo'lar
    for (const enNo of uniqueEnNos) {
      if (!branchEnNos.has(enNo)) {
        unmatched.push(enNo);
      }
    }
    
    return {
      branchId: branch.id,
      branchName: branch.name,
      matchedCount: matched.length,
      totalEmployees: branchEmployees.length,
      matchedNames: matched,
      unmatchedEnNos: unmatched,
    };
  });
  
  // En yüksek eşleşmeyi bul
  matchDetails.sort((a, b) => b.matchedCount - a.matchedCount);
  const best = matchDetails[0];
  
  if (!best || best.matchedCount === 0) {
    return {
      detectedBranchId: null,
      detectedBranchName: null,
      confidence: 0,
      matchDetails,
      fileFormat,
      totalUniqueEnNos: uniqueEnNos.length,
      reasoning: "Dosyadaki personel numaraları hiçbir şubeyle eşleşmedi. Personel tanımlarını kontrol edin.",
    };
  }
  
  // Güven hesabı
  const matchRatio = best.matchedCount / uniqueEnNos.length;
  let confidence = Math.round(matchRatio * 100);
  
  // Büyük EnNo'lar (50000+) varsa Işıklar güveni artır
  const hasLargeEnNos = uniqueEnNos.some(n => n > 10000);
  if (hasLargeEnNos && best.branchName.toLowerCase().includes("isik")) {
    confidence = Math.min(100, confidence + 10);
  }
  
  // AGL txt formatı ipucu
  if (fileFormat === "agl_txt" && best.branchName.toLowerCase().includes("isik")) {
    confidence = Math.min(100, confidence + 5);
  }
  
  // İkinci en iyi şubeyle fark
  const secondBest = matchDetails[1];
  if (secondBest && secondBest.matchedCount > 0) {
    const gap = best.matchedCount - secondBest.matchedCount;
    if (gap < 2) confidence = Math.max(30, confidence - 20); // çok yakın → güven düş
  }
  
  let reasoning = `Dosyada ${uniqueEnNos.length} benzersiz personel no bulundu. `;
  reasoning += `${best.branchName} şubesiyle ${best.matchedCount}/${uniqueEnNos.length} eşleşme (%${confidence} güven). `;
  
  if (best.unmatchedEnNos.length > 0) {
    reasoning += `Tanınmayan numaralar: ${best.unmatchedEnNos.slice(0, 5).join(", ")}${best.unmatchedEnNos.length > 5 ? "..." : ""}. `;
  }
  
  if (secondBest && secondBest.matchedCount > 0) {
    reasoning += `(${secondBest.branchName}: ${secondBest.matchedCount} eşleşme)`;
  }
  
  return {
    detectedBranchId: best.branchId,
    detectedBranchName: best.branchName,
    confidence,
    matchDetails,
    fileFormat,
    totalUniqueEnNos: uniqueEnNos.length,
    reasoning,
  };
}

/**
 * Tespit edilen şubeye göre EnNo → Employee eşleştirmesi yap
 * Çakışan EnNo'lar (13, 22) doğru şubenin personeline eşlenir
 */
export function mapEnNosToEmployees(
  fileEnNos: number[],
  branchId: number,
  allEmployees: Employee[]
): Map<number, Employee> {
  const branchEmployees = allEmployees.filter(e => e.branchId === branchId && e.active);
  const mapping = new Map<number, Employee>();
  
  for (const enNo of fileEnNos) {
    // Önce aynı şubedeki personeli ara
    const emp = branchEmployees.find(e => e.enNo === enNo);
    if (emp) {
      mapping.set(enNo, emp);
    }
    // Bulunamazsa tüm şubelerde ara (rotasyonla gelen personel olabilir)
    if (!emp) {
      const anyEmp = allEmployees.find(e => e.enNo === enNo && e.active);
      if (anyEmp) {
        mapping.set(enNo, anyEmp);
      }
    }
  }
  
  return mapping;
}
