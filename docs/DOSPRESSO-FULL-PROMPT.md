# DOSPRESSO Personel Puantaj & Maaş Sistemi — Tam Geliştirme Prompt'u

## Proje Tanımı

DOSPRESSO cafe franchise zinciri için web tabanlı personel devam kontrol ve maaş hesaplama sistemi oluştur. Parmak izi okuyucudan gelen ham PDKS verisini yükleyerek, her personelin aylık puantajını otomatik hesaplayan, AI destekli akıllı bir İK sistemi.

**Firma:** BOMBTEA LTD. ŞTİ. (DOSPRESSO markası)
**Şubeler:** Işıklar, Lara, BeachPark, Düzce, Samsun
**Departmanlar:** OFİS, İMALATHANE, IŞIKLAR, LARA
**Dil:** Türkçe arayüz
**Para birimi:** TL (₺)

---

## Teknik Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Veritabanı:** PostgreSQL (Neon Serverless veya Replit DB)
- **ORM:** Drizzle ORM
- **AI:** OpenAI GPT-4o (Replit AI Integration veya doğrudan API)
- **Excel İşleme:** SheetJS (xlsx)
- **Marka Renkleri:** Navy #192838, Kırmızı #c0392b, Bej #edeae4

---

## PDKS Veri Formatları

### Format 1: AGL_001.txt (Işıklar şubesi — parmak izi cihazı)
```
No	TMNo	EnNo	Name	INOUT	Mode	DateTime
1	1	50014		0	0	2026/03/01 08:05:23
2	1	43		0	0	2026/03/01 12:15:44
```
- Tab-separated
- **Name kolonu BOŞ** — EnNo ile eşleştirme zorunlu
- DateTime formatı: YYYY/MM/DD HH:MM:SS
- Cihaz tüm okutmaları sıralı kaydeder (giriş/çıkış ayrımı yok)

### Format 2: Excel (Lara şubesi)
```
SIRA NO | KOD | İSİM    | TARİH
21775   | 55  | efe     | 2026-03-01 07:57:37
21776   | 13  | gul     | 2026-03-01 08:06:57
```
- KOD = EnNo (sicil numarası)
- İSİM dolu (küçük harf olabilir)
- TARİH = giriş/çıkış zaman damgası

### Kolon Otomatik Algılama
Farklı cihaz markaları farklı kolon adları kullanabilir. Şu anahtar kelimeleri otomatik algıla:
- **Sicil No:** "EnNo", "No", "Sicil", "ID", "Numara", "KOD"
- **Ad:** "Name", "Ad", "Personel", "İsim", "Çalışan"
- **Tarih:** "DateTime", "Tarih", "Date", "Zaman", "Time"

---

## Personel Veritabanı (Seed Data)

### LARA Şubesi Personeli
| EnNo | İsim | Tam Ad | Pozisyon | Maaş |
|------|------|--------|----------|------|
| 32 | deniz | DENİZ HALİL ÇOLAK | Supervisor Buddy | 40.000₺ |
| 22 | eren | EREN DEMİR | Barista | 41.000₺ |
| 6 | veysel | VEYSEL HÜSEYİNOĞLU | Barista | 41.000₺ |
| 5 | jennifer | DİLARA JENNEFER ELMAS | Barista | 41.000₺ |
| 9 | berkan | BERKAN BOZDAĞ | Bar Buddy | 36.000₺ |
| 55 | efe | EFE YÜKSEL | Bar Buddy | 36.000₺ |
| 13 | gul | GÜL DEMİR | Bar Buddy | 36.000₺ |
| 15 | yagiz | YAĞIZ TÖRER | Stajyer | 33.000₺ |
| 4 | aybuke | AYBÜKE | Stajyer | 33.000₺ |
| 1 | berk | BERK | Stajyer | 33.000₺ |
| 12 | burcu | BURCU | Stajyer | 33.000₺ |
| 17 | goktug | GÖKTUĞ | Stajyer | 33.000₺ |
| 7 | jasmin | JASMİN | Stajyer | 33.000₺ |
| 3 | seref | ŞEREF | Stajyer | 33.000₺ |
| 10 | tugba | TUĞBA | Stajyer | 33.000₺ |

### IŞIKLAR Şubesi Personeli
| EnNo | İsim | Tam Ad | Pozisyon | Maaş |
|------|------|--------|----------|------|
| 50014 | basri | BASRİ ŞEN | Supervisor Buddy | 45.000₺ |
| 13 | kemal | KEMAL HÜSEYİNOĞLU | Barista | 41.000₺ |
| 100059 | cihan | CİHAN KOLAKAN | Barista | 41.000₺ |
| 19 | ates | ATEŞ GÜNEY YILMAZ | Barista | 41.000₺ |
| 39 | efe | EFE | Bar Buddy | 36.000₺ |
| 40 | ahmet | AHMET | Bar Buddy | 36.000₺ |
| 43 | suleyman | SÜLEYMAN UYGUN | Supervisor Buddy | 45.000₺ |
| 45 | ismail | İSMAİL SİVRİ | Stajyer | 33.000₺ |
| 46 | hulya | HÜLYA TÜZÜN | Crosscheck | 36.000₺ |
| 50022 | ece | ECE ÖZ | Trainer Coach | 41.000₺ |
| 44 | muzaffer | MUZAFFER İLKER | Bar Buddy | 36.000₺ |

**⚠️ DİKKAT: EnNo 13 hem Lara'da (Gül) hem Işıklar'da (Kemal) var! Şube tespiti sonrası doğru kişiye eşleştir.**

### Pozisyon ve Maaş Tablosu
| Pozisyon | Toplam Maaş | Taban | Kasa Prim | Performans Prim |
|----------|------------|-------|-----------|-----------------|
| Stajyer | 33.000₺ | 31.000₺ | 0 | 2.000₺ |
| Bar Buddy | 36.000₺ | 31.000₺ | 3.500₺ | 1.500₺ |
| Barista | 41.000₺ | 31.000₺ | 3.500₺ | 6.500₺ |
| Crosscheck | 36.000₺ | 31.000₺ | 3.500₺ | 1.500₺ |
| Supervisor Buddy | 45.000₺ | 31.000₺ | 3.500₺ | 10.500₺ |
| Supervisor | 49.000₺ | 31.000₺ | 3.500₺ | 14.500₺ |
| Trainer Coach | 41.000₺ | 31.000₺ | 3.500₺ | 6.500₺ |

**Not:** Kişi bazlı maaş override olabilir (örn: Deniz normalde 45K ama 40K alıyor).

---

## İş Kuralları

### Çalışma Düzeni
- Şubede kalma: 8.5 saat (örn: 08:00-16:30 veya 16:30-01:00)
- Mola: 1 saat (mesaiden SAYILMAZ)
- Günlük net çalışma: 7.5 saat = 450 dakika
- Haftalık: 6 gün × 7.5 saat = 45 saat
- Off: Haftada 1 gün (shift planına göre)

### Gece Vardiyası Kuralı
Saat 07:00'den ÖNCE yapılan okutma, bir önceki takvim gününe ait sayılır.
- 02 Mart 00:46 → 01 Mart'ın son okutması
- 02 Mart 08:10 → 02 Mart'ın ilk okutması

### Devamsızlık Kodları (10 adet)
| Kod | Anlamı | Maaş Etkisi |
|-----|--------|-------------|
| 1 | Çalıştı (tam gün) | Ödenir |
| 0.5 | Yarım gün | Yarım ödenir |
| 0 | Gelmedi (devamsız) | Kesilir |
| (boş) | Off / Hafta tatili | Ödenir |
| Yİ | Yıllık izin | Ödenir, kesilmez |
| R | Rapor (sağlık) | Kademeli prim kesinti |
| Üİ | Ücretsiz izin | Kesilir + kademeli prim kesinti |
| D | Devamsız | Kesilir |
| G | Görevli (başka şubede) | Ödenir, çalışılan gün sayılır |
| Mİ | Mazeret izni | Ödenir |
| RT | Resmi tatil | Ödenir, çalışırsa ×2 |

### Okutma Sayısına Göre Hesaplama
- **0 okutma:** Çalışma yok (off, izin veya devamsız)
- **1 okutma:** Çıkış eksik → AI pattern'dan tahmin eder veya 7.5 saat varsayar
- **2 okutma:** Giriş + Çıkış. Mola 1 saat otomatik düşülür
- **3 okutma:** Eksik okutma var. AI hangi molann eksik olduğunu tahmin eder
- **4 okutma:** İdeal. Giriş → Mola Çıkış → Mola Dönüş → Mesai Bitişi. Net = Segment1 + Segment2
- **5+ okutma:** Çiftler halinde eşleştirilir

### Çift Okutma Temizleme
2-20 dakika arayla ardışık okutma → duplikat, ikincisi silinir.
2 dakikadan kısa arayla okutma → sistem çift kayıt, yok sayılır.

### Fazla Mesai (FM) Hesabı
- Günlük bazda: Net çalışma - 450dk = FM dakika
- Pozitif = fazla mesai, Negatif = eksik çalışma
- Günlük FM < 30dk → tolerans, sayılmaz
- Aylık FM = tüm günlerin net toplamı (pozitif + negatif)
- **FM Tutarı = FM_dakika × (Günlük_Ücret / 480) × 1.5**
  - 480 = 8 saat × 60 dk (Varsayımlar: "Aylık saat = Çalışma Günü × 8")

### Maaş Formülleri
```
Günlük Ücret = Toplam Maaş ÷ 30 (sabit bölen)
Eksik Gün = Devam Takip Günü - Çalışılan Gün - Off Gün - Yİ Gün - R Gün
Gün Kesinti = Eksik Gün × Günlük Ücret
FM Tutarı = FM_dakika × (Günlük_Ücret / 480) × 1.5
Mesai Gün Tutarı = Tatil Çalışılan Gün × Günlük Ücret × Çarpan (1 veya 2)
Yemek Bedeli = Stajyer ise → Çalışılan Gün × 330₺
NET ÖDEME = Toplam Maaş - Gün Kesinti - Prim Kesinti + FM Tutarı + Mesai Tutarı + Yemek
```

### Prim Kesinti Kuralları (Kademeli)
```
Kesilebilir Prim: 3.000₺

Ücretsiz İzin:
  1 gün → %25 prim kesinti + gün kesintisi
  2 gün → %50 prim kesinti + gün kesintisi
  3+ gün → %100 prim kesinti + gün kesintisi

Rapor:
  1. gün (ayda 1 kez) → %0 prim + 1 gün kesinti
  2. gün → %25 prim + gün kesintisi
  3. gün → %50 prim + gün kesintisi
  4+ gün → %100 prim + gün kesintisi
```

### Formül Doğrulama (Mart 2026 Gerçek Veri)
```
Eren Demir (Barista, 41.000₺):
  27 gün çalıştı, 4 off, 0 eksik, 3.5 mesai gün, 550dk FM
  Günlük = 41000/30 = 1366.67₺
  FM = 550 × (1366.67/480) × 1.5 = 2348.96₺
  Mesai = 3.5 × 1366.67 = 4783.33₺
  Net = 41000 + 2348.96 + 4783.33 = 48132.29₺ ✅

Berkan Bozdağ (Bar Buddy, 36.000₺):
  25 gün, 4 off, 1 eksik, 2.5 mesai, 105dk FM
  Kesinti = 1 × 1200 = 1200₺
  FM = 105 × (1200/480) × 1.5 = 393.75₺
  Mesai = 2.5 × 1200 = 3000₺
  Net = 36000 - 1200 + 393.75 + 3000 = 38193.75₺ ✅

Yağız Törer (Stajyer, 33.000₺):
  2 gün çalıştı, 0 off, 28 eksik
  Kesinti = 28 × 1100 = 30800₺
  Yemek = 2 × 330 = 660₺
  Net = 33000 - 30800 + 660 = 2860₺ ✅
```

---

## Akıllı Şube Tespiti

Yanlış şubeye yükleme yapılırsa sistem otomatik tespit etmeli:

```
1. DOSYA FORMATI → İpucu
   AGL_001.txt (tab-sep, Name boş) → Işıklar
   Excel (KOD/İSİM/TARİH, isim dolu) → Lara

2. EnNo DAĞILIMI → Kesin tespit
   50014, 100059 gibi büyük numaralar → Işıklar
   Dosyadaki tüm EnNo'ları tara → en çok eşleşen şube = doğru şube

3. KULLANICI ONAYI
   "Bu dosya IŞIKLAR şubesine ait görünüyor (%85 güven). Doğru mu?"
```

---

## AI Davranışı

AI sadece yorum yapmaz — **aktif soru sorar ve akıllı düzeltme önerir:**

### Yükleme Anında:
- Personel pattern analizi (geçmiş veriden normal giriş/çıkış saatlerini öğrenir)
- Shift plan ↔ PDKS karşılaştırma
- Rotasyon tespiti: "Ateş B.Park'ta, Işıklar PDKS'de yok → Görevli (G)"

### Sorular (tek tıkla cevaplanır):
```
🔄 "Ateş 24 Mart — Shift: B.Park, PDKS: yok → Görevli mi?"
   [Evet, Görevli] [Hayır, Devamsız] [Ücretsiz İzin]

❌ "Basri 14 Mart — Shift var ama PDKS yok"  
   [Off] [Rapor] [Yıllık İzin] [Devamsız]

⚠️ "Gül 4 gün eksik — izin türü belirtilmeli"
   [Yıllık İzin] [Rapor] [Ücretsiz İzin]
```

### Chat:
Kullanıcı serbest soru sorabilir:
- "Ateş neden 5 gün yok?" → Rotasyon açıklaması
- "Bu ay toplam maliyet?" → Hesaplama
- "Kemal'in izin günleri?" → Detay

---

## Kullanıcı Arayüzü

### Akış (3 Adım)
```
ADIM 1: İK dosyayı sürükler (2 dk)
  → AI otomatik doldurur + uyarı gösterir

ADIM 2: İK soruları tek tıkla cevaplar (5 dk)
  → "Bu gün Off mü, İzin mi, Devamsız mı?"

ADIM 3: Muhasebe maaş tablosunu onaylar (3 dk)
  → Excel indir, dönem kilitle
```

### Ana Ekranlar

**1. Dashboard:** Departman kartları (Işıklar/Lara/Ofis/İmalathane) + dönem durumu
**2. Dönem Sayfası:** 
  - Filtreler: Ay, Yıl, Şube, Personel dropdown
  - Varsayılan: Özet görünüm (KPI + maaş tablosu)
  - Satıra tıkla → 31 günlük mini grid açılır
  - Tab: Gün Detay (tam 31 sütun grid, hücre tıkla → durum değiştir)
  - Tab: Ayarlar (dönem parametreleri)
**3. AI Panel:** Sağ tarafta açılır/kapanır chat + uyarılar

### Dönem Workflow
```
⚪ Boş → ⏳ İnceleme → ✅ Hesaplandı → 📨 Gönderildi → ✅ Onaylandı → 🔒 Kilitli
```

### Roller
| İşlem | İK | Muhasebe | Yönetim |
|-------|-----|----------|---------|
| PDKS yükle | ✅ | ❌ | ✅ |
| Gün durumu değiştir | ✅ | ❌ | ✅ |
| Maaş düzelt | ❌ | ✅ | ✅ |
| Dönemi onayla | ❌ | ✅ | ✅ |
| Ayarları değiştir | ❌ | ❌ | ✅ |

---

## Dönem Ayarları (18 parametre)

| Ayar | Varsayılan | Açıklama |
|------|-----------|----------|
| salaryDivisor | 30 | Günlük ücret böleni |
| trackingDays | 27 | Devam takip günü (ayın iş günü) |
| dailyGrossHours | 8.5 | Şubede kalma süresi |
| dailyBreakMinutes | 60 | Mola süresi |
| dailyNetMinutes | 450 | Net çalışma (7.5 saat) |
| weeklyNetHours | 45 | Haftalık beklenen |
| workDaysPerWeek | 6 | Haftalık iş günü |
| fmCalcBasis | 8 | FM hesap bazı (saat) |
| fmMultiplier | 1.5 | FM çarpanı |
| fmDailyMinThreshold | 30 | FM minimum eşik (dk) |
| holidayMultiplier | 1 | Tatil mesai çarpanı |
| deficitPenaltyPlusOne | false | Eksik gün +1 cezası |
| autoPrimDeduction | true | Prim kesinti aktif |
| deductiblePrim | 3000 | Kesilebilir prim tutarı |
| lateToleranceMinutes | 0 | Geç kalma toleransı |
| earlyLeaveToleranceMinutes | 0 | Erken çıkış toleransı |
| mealAllowancePerDay | 330 | Günlük yemek bedeli |
| mealAllowancePositions | ["Stajyer"] | Yemek alan pozisyonlar |

---

## Veritabanı Şeması

### users
id, username, password, displayName, role (ik/muhasebe/yonetim)

### branches
id, name, active

### departments
id, name, branch_id, active

### positions
id, name, baseSalary, totalSalary, kasaPrim, performansPrim, description, active

### employees
id, enNo, name, fullName, position, positionId, branchId, departmentId, 
active, employmentType, weeklyHours, hireDate, leaveDate, customSalary

### employee_aliases
id, employeeId, aliasName, source (pdks/manual/ai)

### daily_attendance ⭐ ANA TABLO
id, periodId, employeeId, day (1-31),
status (1/0/0.5/Yi/R/Ui/D/G/Mi/RT/""),
fmMinutes (int, + veya -),
source (pdks/manual/ai),
shiftStart, shiftEnd, actualStart, actualEnd,
breakMinutes, notes

### payroll_periods
id, branchId, year, month, workDays, salaryDivisor,
status (draft/review/calculated/submitted/approved/locked),
periodSettings (JSON — 18 parametre),
uploadId, aiAnalysis,
submittedAt, approvedAt, approvedBy

### payroll_records
id, periodId, employeeId, positionName,
workedDays, offDays, deficitDays, penaltyDays,
yiDays, rDays, uiDays, gDays,
overtimeDaysHoliday, fmMinutes,
customTotalSalary, totalSalary, baseSalary, kasaPrim, performansPrim,
dailyRate, dayDeduction, primDeduction, fmAmount, overtimeAmount,
mealAmount, netPayment,
aiCorrections (JSON), aiConfidence, aiNotes, notes

### prim_rules
id, ruleType (ucretsiz_izin/rapor/devamsiz), dayCount, primPercentage, description, active

### holidays
id, date, name, salaryMultiplier

---

## API Endpoints

```
POST   /api/upload              — PDKS dosyası yükle + AI işle + şube tespit
GET    /api/period/:id          — Dönem verisi (grid + özet + maaş)
GET    /api/period/:id/grid     — Gün-gün puantaj grid (daily_attendance)
PUT    /api/period/:id/day      — Tek gün durumu değiştir {employeeId, day, status}
PUT    /api/period/:id/workflow — Durum değiştir (submit/approve/reject/lock)
GET    /api/period/:id/settings — Dönem ayarları
PUT    /api/period/:id/settings — Dönem ayarları güncelle
POST   /api/chat               — AI sohbet
GET    /api/employees           — Personel listesi
GET    /api/positions           — Pozisyon listesi
GET    /api/branches            — Şube listesi
GET    /api/prim-rules          — Prim kesinti kuralları
POST   /api/period/:id/export   — Excel export (puantaj formatında)
```

---

## Dikkat Edilecekler

1. **EnNo çakışması:** 13 ve 22 numaralar iki şubede var. Şube tespiti sonrası doğru kişiye eşleştir.
2. **Gece vardiyası:** 07:00 öncesi okutma önceki güne sayılır.
3. **Negatif FM:** Eksik çalışma günleri negatif FM olarak izlenir, toplama dahil edilir.
4. **Rotasyon:** Personel başka şubede çalışırsa kendi şubesinin PDKS'inde görünmez → "G" (Görevli) kodu.
5. **Yarım gün (0.5):** Net çalışma < 4 saat ama > 0 ise yarım gün.
6. **İşten ayrılan:** Ayrılan personel prorated hesaplanır (çalıştığı güne kadar).
7. **Türkçe karakter normalizasyonu:** İ→i, Ş→s, Ğ→g, Ü→u, Ö→o, Ç→c.
8. **FM formülü:** ÷480 kullan (8 saat), ÷450 DEĞİL (7.5 saat).
9. **Prim kesinti pratikte 0:** Şubat/Mart verilerinde prim kesintisi uygulanmamış, ama kurallar mevcut. Toggle ile açılabilir.
10. **Excel export:** Resmi puantaj formatında — 31 sütun gün + çalışılan/eksik/FM toplamları.
