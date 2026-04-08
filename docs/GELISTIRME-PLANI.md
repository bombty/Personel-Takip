# DOSPRESSO Personel Puantaj & Takip Sistemi — Geliştirme Planı

**Tarih:** 9 Nisan 2026  
**Proje:** Personel-Takip  
**Hazırlayan:** Claude (IT Danışman)  
**Karar Veren:** Aslan (Ürün Sahibi)

---

## 1. VİZYON

PDKS cihazından gelen Excel verilerini yükle → AI destekli otomatik puantaj hesapla → maaş tablosu çıktısı al.

**Temel Felsefe:** 🔵 Otomatik (PDKS'den) + 🟡 Elle Giriş (yönetici kararı) + 🤖 AI Analiz

---

## 2. MEVCUT DURUM ANALİZİ

### 2.1 Ne Var?
| Bileşen | Satır | Durum |
|---------|-------|-------|
| processor.ts (hesaplama motoru) | 914 | Çalışıyor ama karmaşık, refaktör gerekli |
| routes.ts (API) | 1,167 | Çalışıyor, temizlenmeli |
| ai-analyzer.ts (OpenAI) | 211 | Çalışıyor, geliştirilmeli |
| storage.ts (DB ops) | 437 | Çalışıyor |
| schema.ts (DB şeması) | 286 | 11 tablo, genişletilmeli |
| Frontend (8 sayfa) | ~3,500 | Temel UI var, yeniden tasarlanmalı |

### 2.2 Ne Eksik?
1. **Maaş Hesaplama Modülü** — Pozisyon bazlı maaş, kesinti, FM tutarı, net ödeme
2. **Personel-Pozisyon Eşleştirme** — PDKS'deki "deniz" → Maaş tablosundaki "DENİZ HALİL ÇOLAK"
3. **Maaş Tablosu Çıktısı** — Excel export (Lara_Sube_Maas formatında)
4. **Dönem Yönetimi** — Ay bazlı açma/kapama, onaylama akışı
5. **Multi-Şube** — Birden fazla şube desteği
6. **AI Akıllı Eşleştirme** — Kolon algılama + personel isim eşleştirme
7. **Dashboard v2** — Görsel maaş özeti, trend grafikleri

### 2.3 Ne Yanlış / Düzeltilmeli?
1. Processor.ts'de çift okutma mantığı karmaşık → basitleştirilmeli
2. Varsayılan ayarlar hardcoded → DB'den dinamik gelmeli
3. Mola hesabı tutarsız olabiliyor (3 okutma senaryoları)
4. İzin çakışma kontrolü zayıf
5. Auth sistemi basit → güçlendirilmeli (şube yöneticisi rolü)

---

## 3. VERİ AKIŞI (End-to-End)

```
PDKS Cihazı → Excel Export → Sisteme Yükle
                                    ↓
                          AI Kolon Algılama
                                    ↓
                        Personel Otomatik Eşleştirme
                                    ↓
                      Giriş-Çıkış Çiftleme (Punch Pairing)
                                    ↓
                    Günlük Hesaplama (Net Çalışma, Mola, Mesai)
                                    ↓
                  Aylık Toplama (Çalışılan Gün, Off, Eksik, FM)
                                    ↓
                     🟡 Yönetici Manuel Düzeltme
                     (Ücretsiz izin, Rapor, Yemek bedeli)
                                    ↓
                      Maaş Hesaplama (Taban + Prim - Kesinti + FM)
                                    ↓
                          AI Analiz & Anomali Raporu
                                    ↓
                        Excel Maaş Tablosu Export
```

---

## 4. VERİTABANI TASARIMI (Yeni/Güncellenecek Tablolar)

### 4.1 Mevcut Tablolar (Korunacak)
- `users` — Kullanıcı giriş
- `branches` — Şubeler
- `employees` — Personel bilgileri
- `attendance_records` — PDKS ham kayıtları
- `uploads` — Yükleme geçmişi
- `settings` — Sistem ayarları
- `holidays` — Resmi tatiller
- `leaves` — İzinler
- `work_schedules` — Vardiya tanımları
- `weekly_assignments` — Haftalık atamalar
- `report_periods` — Dönem tanımları

### 4.2 Yeni Tablolar

#### `positions` — Pozisyon & Maaş Tanımları
```
id, name, base_salary, total_salary, description, active
Örnek: "Barista", 31000, 41000, "Taban 31K + Prim 10K", true
```

#### `salary_components` — Maaş Bileşenleri
```
id, position_id, component_type, amount, description
Örnek: position_id=3, "kasa_prim", 3500, "Kasa Primi"
       position_id=3, "performans_prim", 6500, "Performans Primi"
```

#### `employee_positions` — Personel-Pozisyon Eşleştirme
```
id, employee_id, position_id, start_date, end_date, custom_salary
→ Bir personel zaman içinde pozisyon değiştirebilir
```

#### `payroll_periods` — Bordro Dönemleri
```
id, branch_id, year, month, work_days, salary_divisor,
status (draft/calculated/reviewed/approved/locked),
created_at, approved_at, approved_by
```

#### `payroll_records` — Personel Bordro Kayıtları (ANA TABLO)
```
id, period_id, employee_id,
-- 🔵 Otomatik (PDKS'den)
worked_days, off_days, deficit_days,
overtime_days_holiday, fm_minutes,
-- 🟡 Manuel
unpaid_leave_days, sick_leave_days, meal_allowance,
-- Hesaplanan
total_salary, base_salary, kasa_prim, performans_prim,
daily_rate, day_deduction, prim_deduction,
overtime_amount, fm_amount, meal_amount,
net_payment,
-- Meta
auto_calculated, manually_adjusted, notes,
ai_analysis
```

#### `payroll_adjustments` — Manuel Düzeltme Geçmişi
```
id, payroll_record_id, field_name, old_value, new_value,
adjusted_by, adjusted_at, reason
→ Her 🟡 değişikliğin izi tutulur
```

#### `employee_aliases` — İsim Eşleştirme
```
id, employee_id, alias_name
→ PDKS: "deniz" → Employee: "DENİZ HALİL ÇOLAK"
→ PDKS: "jennifer" → Employee: "DİLARA JENNEFER ELMAS"
```

---

## 5. MAAŞ HESAPLAMA KURALLARI

### 5.1 Varsayımlar (Lara Şubesi Maaş Tablosundan)

| Pozisyon | Toplam Maaş | Taban | Prim |
|----------|-------------|-------|------|
| Stajyer | 33,000 | 31,000 | 2,000 |
| Bar Buddy | 36,000 | 31,000 | 5,000 |
| Barista | 41,000 | 31,000 | 10,000 |
| Supervisor Buddy | 45,000 | 31,000 | 14,000 |
| Supervisor | 49,000 | 31,000 | 18,000 |

### 5.2 Formüller

```
Günlük Ücret       = Toplam Maaş ÷ 30 (sabit bölen)
Gün Kesinti         = Eksik Gün × Günlük Ücret
Prim Kesinti        = (Eksik Gün / Devam Takip Günü) × Toplam Prim  [oran bazlı]
FM Tutarı           = FM Dakika × (Günlük Ücret ÷ 450) × 1.5
Mesai Gün Tutarı    = Mesai Gün (Bayram/Tatil) × Günlük Ücret × 2
NET ÖDEME           = Toplam Maaş - Gün Kesinti - Prim Kesinti + FM Tutarı + Mesai Gün Tutarı + Yemek Bedeli
```

### 5.3 Otomatik Hesaplanan Alanlar (🔵)
- **Çalışılan Gün**: PDKS giriş-çıkış çiftinden ≥2 okutma olan günler
- **Off Gün**: Haftalık atamada "OFF" olan günler
- **Eksik Gün**: Devam Takip Günü - Çalışılan Gün - Off Gün - Ücretsiz İzin - Raporlu Gün
- **Mesai Gün (Bayram/Tatil)**: Resmi tatil günlerinde çalışılan gün sayısı (0.5 gün = yarım gün)
- **FM Dakika**: Günlük net çalışma > 480dk (8 saat) olan günlerdeki fazla dakika toplamı (30dk altı sayılmaz)

### 5.4 Manuel Girilen Alanlar (🟡)
- Ücretsiz İzin Gün
- Raporlu Gün
- Yemek Bedeli
- Özel notlar

---

## 6. SPRINT PLANI

### Sprint 1: Temel Altyapı (DB + API Refaktör)
**Süre:** ~3-4 saat  
**Hedef:** Yeni tablolar + mevcut kod temizliği

1. Yeni tablolar ekle: `positions`, `salary_components`, `employee_positions`, `payroll_periods`, `payroll_records`, `payroll_adjustments`, `employee_aliases`
2. `employees` tablosuna `full_name` (ad soyad), `alias` (PDKS kısa isim) alanları ekle
3. Pozisyon seed data (Stajyer, Bar Buddy, Barista, Supervisor Buddy, Supervisor)
4. Mevcut Lara şubesi personel seed data (15 kişi)
5. Storage fonksiyonları yaz (CRUD for new tables)
6. processor.ts refaktör — sınıf bazlı, test edilebilir yapı

### Sprint 2: Akıllı Excel İçe Aktarma + AI Eşleştirme
**Süre:** ~3-4 saat  
**Hedef:** Excel yükle → otomatik kolon algıla → personel eşleştir

1. Excel kolon otomatik algılama (mevcut `detectColumns` geliştirilecek)
2. AI destekli personel isim eşleştirme:
   - PDKS "deniz" → DB'de "DENİZ HALİL ÇOLAK" 
   - Fuzzy matching + AI doğrulama
   - Eşleşmeyen isimler için kullanıcıya onay ekranı
3. `employee_aliases` tablosuna öğrenilen eşleştirmeleri kaydet
4. Yükleme sayfası yeniden tasarımı:
   - Sürükle-bırak
   - Kolon eşleştirme önizleme
   - Personel eşleştirme onay ekranı
   - İşleme progress bar

### Sprint 3: Puantaj Hesaplama Motoru v2
**Süre:** ~4-5 saat  
**Hedef:** Tam otomatik puantaj + maaş hesaplama

1. Punch pairing algoritması iyileştirme:
   - 2 okutma: giriş-çıkış (mola otomatik düş)
   - 3 okutma: AI ile hangi okutmanın eksik olduğunu tahmin et
   - 4 okutma: giriş-mola_çıkış-mola_dönüş-çıkış (standart)
   - 5+ okutma: akıllı gruplama
2. Günlük hesaplama:
   - Net çalışma süresi
   - Geç kalma (tolerans ayarı)
   - Erken çıkma
   - Fazla mesai (günlük + haftalık)
3. Aylık toplama:
   - Çalışılan gün sayısı
   - Off gün sayısı
   - Eksik gün hesabı
   - Tatil mesai günü (0.5 gün destekli)
   - FM dakika (30dk üstü hesaplama)
4. Maaş hesaplama:
   - Pozisyon bazlı maaş çekme
   - Tüm formülleri uygulama
   - `payroll_records` tablosuna kaydetme
5. AI anomali tespiti:
   - Olağandışı çalışma saatleri
   - Şüpheli punch paternleri
   - Mola ihlalleri

### Sprint 4: Bordro Yönetim UI
**Süre:** ~4-5 saat  
**Hedef:** Yönetici arayüzü — görüntüle, düzelt, onayla

1. **Bordro Dashboard sayfası:**
   - Dönem seçici (Ay/Yıl)
   - Maaş tablosu görünümü (Lara_Sube_Maas Excel formatında)
   - 🔵 alanlar otomatik, 🟡 alanlar editable
   - Satır bazlı düzenleme (inline edit)
   - Toplam satırı
2. **Personel detay modal:**
   - Günlük giriş-çıkış listesi
   - Haftalık kırılım
   - AI analiz sonucu
   - Sorunlu günler vurgulanmış
3. **Dönem yönetimi:**
   - Taslak → Hesaplandı → İncelendi → Onaylandı → Kilitlendi
   - Onay sonrası düzenleme engeli
4. **Excel export:**
   - Lara_Sube_Maas formatında çıktı
   - Formüllü ve formülsüz versiyonlar
   - Aylık rapor PDF

### Sprint 5: AI Geliştirme + Raporlama
**Süre:** ~3 saat  
**Hedef:** Yapay zeka analiz derinleştirme + gelişmiş raporlar

1. AI Genel Rapor:
   - Şube performans özeti
   - Personel karşılaştırma
   - Maaş trendi analizi
   - Anomali tespiti ve öneriler
2. AI Personel Rapor:
   - Bireysel performans değerlendirme
   - Devam düzeni analizi
   - Mola alışkanlık analizi
   - İyileştirme önerileri
3. Trend Dashboard:
   - Aylık çalışma saati trendi
   - Geç kalma trendi
   - Mesai trendi
   - Personel maliyet analizi

### Sprint 6: Multi-Şube + Rol Yönetimi
**Süre:** ~3 saat  
**Hedef:** Birden fazla şube, farklı kullanıcı rolleri

1. Şube yönetimi:
   - Şube ekleme/düzenleme
   - Şube bazlı personel atama
   - Şube bazlı ayarlar (çalışma saatleri, sezon)
2. Rol sistemi:
   - `admin` — Tüm şubeleri görür, sistem ayarları
   - `sube_muduru` — Kendi şubesini yönetir
   - `muhasebe` — Bordro onayı, maaş tablosu export
   - `viewer` — Salt okunur erişim
3. Yetki kontrolü middleware

---

## 7. TEKNİK MİMARİ

### 7.1 Tech Stack (Mevcut, Korunacak)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM
- **AI:** OpenAI GPT-4o (Replit AI entegrasyonu)
- **Excel:** SheetJS (xlsx)

### 7.2 Dosya Yapısı (Hedef)
```
server/
  index.ts
  db.ts
  routes/
    auth.ts
    upload.ts
    employees.ts
    payroll.ts          ← YENİ
    positions.ts        ← YENİ
    reports.ts
    settings.ts
  services/
    processor.ts        ← Refaktör
    salary-calculator.ts ← YENİ
    excel-importer.ts   ← YENİ
    excel-exporter.ts   ← YENİ
    ai-analyzer.ts      ← Geliştirilecek
    name-matcher.ts     ← YENİ (AI isim eşleştirme)
  middleware/
    auth.ts
    branch-scope.ts
shared/
  schema.ts             ← Genişletilecek
  types.ts              ← YENİ
client/src/
  pages/
    dashboard.tsx        ← Yeniden tasarım
    upload.tsx           ← Yeniden tasarım
    payroll.tsx          ← YENİ (ana maaş tablosu)
    payroll-detail.tsx   ← YENİ (personel detay)
    employees.tsx        ← Güncelleme
    positions.tsx        ← YENİ
    settings.tsx         ← Güncelleme
    periods.tsx          ← Güncelleme
```

---

## 8. ÖNCELİK SIRASI

| # | Sprint | Önem | Neden |
|---|--------|------|-------|
| 1 | Temel Altyapı | 🔴 Kritik | Her şey buna bağlı |
| 2 | Excel İçe Aktarma | 🔴 Kritik | Veri girişi olmadan hesaplama yok |
| 3 | Puantaj Motoru v2 | 🔴 Kritik | Ana iş mantığı |
| 4 | Bordro UI | 🔴 Kritik | Kullanıcının göreceği ekran |
| 5 | AI + Raporlama | 🟡 Önemli | Katma değer |
| 6 | Multi-Şube + Rol | 🟢 Gelecek | İlk aşamada tek şube yeterli |

---

## 9. ÇALIŞMA MODELİ

| Görev | Kim |
|-------|-----|
| Mimari tasarım, büyük özellikler, DB şeması | Claude → GitHub push |
| Küçük düzeltmeler, build, test, deploy | Replit Agent |
| Ürün kararları, test, onay | Aslan |

**Git akışı:**
```
Claude: git push https://[TOKEN]@github.com/bombty/Personel-Takip.git HEAD:main
Replit: Auto-pull from GitHub → Build → Deploy
```

---

## 10. HEDEF ÇIKTI

Sprint 4 sonunda sistem şunu yapabilmeli:

1. ✅ PDKS Excel yükle (sürükle-bırak)
2. ✅ Otomatik kolon algıla
3. ✅ Personel eşleştir (AI destekli)
4. ✅ Puantaj hesapla (çalışılan gün, off, eksik, mesai, FM)
5. ✅ Maaş hesapla (taban + prim - kesinti + FM = net)
6. ✅ Yönetici düzeltme yapabilsin (🟡 alanlar)
7. ✅ AI analiz raporu göster
8. ✅ Excel maaş tablosu export et (Lara formatında)
