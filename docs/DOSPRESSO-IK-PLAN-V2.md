# DOSPRESSO İK Puantaj Sistemi — Kapsamlı Yeniden Tasarım Planı

**Tarih:** 9 Nisan 2026
**Hazırlayan:** Claude (IT Danışman)
**Kaynak:** 3 ay onaylı puantaj, 6 hafta shift planı, 40.847 satır PDKS verisi

---

## 1. SİSTEMİN GERÇEK AMACI

Bu bir "basit maaş hesaplayıcı" DEĞİL — **tam kapsamlı İK Devam Kontrol Sistemi**:

```
PDKS Cihazı (AGL_001.txt) → Sistem
    ↓
Gün-gün puantaj grid'i (31 sütun × personel sayısı)
    ↓
Her gün: 1 / 0 / 0.5 / Yİ / R / Üİ / D / G / Mİ / RT
Her gün: FM dakika (+pozitif veya -negatif)
    ↓
Aylık toplam: Çalışılan Gün + Eksik Gün + FM Toplamı
    ↓
Maaş hesaplama + Prim kesinti kuralları
    ↓
Excel export (puantaj formatında)
```

---

## 2. MEVCUT VERİDEN ÇIKARILAN İŞ KURALLARI

### 2.1 Çalışma Düzeni
- **Şubede kalma:** 8.5 saat (ör: 08:00-16:30 veya 16:30-01:00)
- **Mola:** 1 saat (mesaiden sayılmaz)
- **Net çalışma:** 7.5 saat = 450 dakika
- **Haftalık:** 6 gün × 7.5 saat = 45 saat
- **Off:** Haftada 1 gün (shift planına göre)

### 2.2 Vardiya Tipleri (Shift'lerden)
| Vardiya | Saat | Örnek |
|---------|------|-------|
| Sabah açılış | 08:00-16:30 | Sevkiyat, hazırlık |
| Ara vardiya | 09:00-17:30 | Crosscheck, eğitim |
| Geç giriş | 10:00-18:30 / 12:00-20:30 | Destek |
| Öğlen-gece | 13:30-22:00 / 14:30-23:00 | Ara-gece |
| Akşam kapanış | 16:30-01:00 | Kapanış sorumlusu |

### 2.3 Devamsızlık Kodları
| Kod | Anlamı | Maaş Etkisi |
|-----|--------|-------------|
| 1 | Çalıştı (tam gün) | Ödenir |
| 0.5 | Yarım gün | Yarım ödenir |
| 0 | Gelmedi (devamsız) | Kesilir |
| (boş) | Off / Hafta tatili | Ödenir (hakkedilen) |
| Yİ | Yıllık izin | Ödenir |
| R | Rapor (sağlık) | 1. gün ödenir, sonrası kademeli kesinti |
| Üİ | Ücretsiz izin | Kesilir + prim kesintisi |
| D | Devamsız | Kesilir |
| G | Görevli (başka şubede) | Ödenir |
| Mİ | Mazeret izni | Ödenir |
| RT | Resmi tatil | Ödenir (çalışırsa ×2) |

### 2.4 Prim Kesinti Kuralları (PRİM KESİNTİ sheet'ten)
```
Kesilebilir Prim: 3.000₺ (2025 kuralı, güncellenebilir)

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

### 2.5 FM (Fazla/Eksik Mesai) Kuralları
- **Günlük bazda** hesaplanır: Net çalışma - 450dk = FM dakika
- **Pozitif FM:** Fazla mesai (ödenir: ×1.5 çarpan)
- **Negatif FM:** Eksik mesai (kesilir veya toplama etki eder)
- **NET FM:** Ayın tüm günlerinin toplamı (pozitif + negatif)
- **30dk altı günlük FM:** Sayılmaz (tolerans)
- **FM Tutarı:** FM_dakika × (Günlük_Ücret / 480) × 1.5

### 2.6 PDKS Veri Formatı (AGL_001.txt)
```
No  TMNo  EnNo  Name  INOUT  Mode  DateTime
1   1     1010        0      0     2022/05/05 11:37:40
```
- **Name kolonu BOŞ** — EnNo → İsim eşleştirme ZORUNLU
- **40.847 satır** veri (2022'den beri)
- **2026 benzersiz EnNo'lar:** 13, 19, 39, 40, 43, 44, 45, 46, 100059, 50014, 50022, 1000
- **Tarih formatı:** YYYY/MM/DD HH:MM:SS

### 2.7 Multi-Departman Yapısı
```
BOMBTEA LTD. ŞTİ.
├── OFİS (7 kişi) — Samet, Utku, Diana, Ümran, Mahmut, Eren, Sema
├── İMALATHANE (11 kişi) — Atiye, Mustafa Can, Büşra, Mihrican, Galipcan...
└── IŞIKLAR ŞUBESİ (11 kişi) — Basri, Kemal, Cihan, Ateş, Efe, Ahmet...
    ├── Lara (destek gönderilen)
    └── BeachPark (destek gönderilen)
```

---

## 3. SİSTEM MİMARİSİ

### 3.1 Veritabanı (Yeni/Güncellenen Tablolar)

#### `departments` — Departmanlar
```
id, name, branch_id, active
→ "OFİS", "İMALATHANE", "IŞIKLAR"
```

#### `employee_positions` (güncelleme)
```
+ department_id (departman)
+ en_no (PDKS sicil no)
+ custom_salary (kişi bazlı maaş override)
```

#### `daily_attendance` — GÜN-GÜN PUANTAJ (ANA TABLO)
```
id, period_id, employee_id, day (1-31),
status (1/0/0.5/Yi/R/Ui/D/G/Mi/RT/bos),
fm_minutes (int, + veya -),
source (pdks/manual/ai),
shift_start, shift_end, actual_start, actual_end,
notes
```

#### `prim_rules` — Prim Kesinti Kuralları
```
id, rule_type (ucretsiz_izin/rapor/devamsiz),
day_count, prim_percentage, description
→ ücretsiz_izin, 1, 25, "%25 prim + gün kesinti"
→ rapor, 2, 25, "%25 prim + gün kesinti"
```

#### `period_settings` (güncelleme)
```
+ daily_net_minutes: 450
+ daily_gross_minutes: 510
+ break_minutes: 60
+ fm_min_threshold: 30
+ fm_calc_basis_hours: 8
+ fm_multiplier: 1.5
+ salary_divisor: 30
+ deficit_penalty_plus_one: false
+ prim_kesinti_enabled: true
+ meal_per_day: 330
+ meal_positions: ["Stajyer"]
```

### 3.2 Akış

```
1. PDKS Import (AGL_001.txt veya Excel)
   ↓
2. EnNo → Personel Eşleştirme (alias tablosu)
   ↓
3. Gün-gün otomatik hesaplama:
   - Her okutma çifti → giriş/çıkış süre hesabı
   - Net çalışma = brüt - mola
   - FM = net - 450dk (+ veya -)
   - Status = 1 (çalıştı) veya 0 (gelmedi)
   ↓
4. AI Analiz:
   - Eksik okutma → pattern'dan tahmin
   - Off gün → shift planından doğrulama
   - Anormal saat → uyarı
   ↓
5. Yönetici Düzenleme:
   - Status değiştir (0 → Yİ, R, Üİ vb.)
   - FM manuel düzelt
   - Not ekle
   ↓
6. Prim Kesinti Otomatik Hesaplama:
   - Üİ gün sayısına göre kademeli
   - R gün sayısına göre kademeli
   ↓
7. Maaş Hesaplama:
   - Gün kesinti + Prim kesinti + FM tutarı + Mesai tutarı
   ↓
8. Excel Export (onaylı puantaj formatında)
```

---

## 4. KULLANICI ARAYÜZÜ

### 4.1 Ana Sayfa (Dashboard)
```
┌─────────────────────────────────────────┐
│ DOSPRESSO Personel Takip                │
│                                         │
│  [IŞIKLAR]  [OFİS]  [İMALATHANE]       │
│                                         │
│  PDKS Verisi Yükle [Dosya Seç]          │
│                                         │
│  Dönem: [Mart ▼] [2026 ▼]              │
└─────────────────────────────────────────┘
```

### 4.2 Puantaj Grid (Ana Ekran)
```
┌──────────────────────────────────────────────────────────┐
│ IŞIKLAR — Mart 2026                        [Ayarlar ⚙]  │
├────────────┬───┬───┬───┬───┬─── ... ───┬──────┬──────────┤
│ Personel   │ 1 │ 2 │ 3 │ 4 │    ...   │ Gün  │ FM(dk)   │
├────────────┼───┼───┼───┼───┼─── ... ───┼──────┼──────────┤
│ BASRİ ŞEN  │ 1 │   │ 1 │ 1 │    ...   │  26  │    0     │
│ KEMAL H.   │ 1 │ 1 │ 1 │ 1 │    ...   │  22  │    0     │
│ CİHAN K.   │ 1 │ 1 │ 1 │ 1 │    ...   │  27  │    0     │
│ ATEŞ G.Y.  │ 1 │ 1 │ 1 │ 1 │    ...   │  25  │    0     │
│ EFE        │ 1 │ 1 │   │ 1 │    ...   │  27  │  263     │
│ ...        │   │   │   │   │    ...   │      │          │
├────────────┴───┴───┴───┴───┴─── ... ───┴──────┴──────────┤
│ Renk kodları: 🟢1  ⚪Off  🟡Yİ  🔵R  🔴0  🟠Üİ          │
│ Hücre tıkla → Durum değiştir (1/0/Yİ/R/Üİ)             │
└──────────────────────────────────────────────────────────┘
```

### 4.3 AI Chat (Sağ Panel)
```
"Basri neden 1 gün eksik?"
→ "Basri 14. gün (Cumartesi) çalışmamış, shift planında 
   off olarak görünmüyor. PDKS'de o gün okutma yok. 
   Yöneticiden teyit gerekli."

"Kemal'in yıllık izin günlerini göster"
→ "Kemal 26-31 Mart arası 6 gün Yİ. Shift planında 
   26 Mart'tan itibaren 'Yıllık izin' yazıyor."
```

### 4.4 Ayarlar Paneli
```
┌─ Dönem Ayarları ─────────────────────┐
│ Günlük net çalışma:     [450] dk     │
│ Mola süresi:            [60] dk      │
│ FM minimum eşik:        [30] dk      │
│ FM çarpanı:             [1.5]        │
│ Günlük ücret böleni:    [30]         │
│ Eksik+1 ceza:           [  ] kapalı  │
│ Prim kesinti:           [✓] aktif    │
│ Yemek bedeli/gün:       [330] ₺      │
│ Yemek pozisyonları:     [Stajyer]    │
└──────────────────────────────────────┘
```

---

## 5. SPRINT PLANI (YENİDEN)

### Sprint 1: Veri Modeli + Import (4-5 saat)
1. `departments` tablosu + seed data (OFİS, İMALATHANE, IŞIKLAR)
2. `daily_attendance` tablosu (gün-gün puantaj)
3. `prim_rules` tablosu + seed data
4. AGL_001.txt parser (No/TMNo/EnNo/Name/INOUT/Mode/DateTime)
5. EnNo → İsim eşleştirme (Işıklar 12 personel seed)
6. PDKS import → daily_attendance otomatik doldurma
7. Gün-gün FM hesaplama (pozitif + negatif)

### Sprint 2: Puantaj Grid UI (4-5 saat)
1. 31 sütunlu puantaj grid (renk kodlu)
2. Hücre tıklama → durum değiştirme (1/0/Yİ/R/Üİ/D)
3. FM sütunu (günlük + toplam)
4. Departman sekmeleri
5. Dönem seçici (ay/yıl)
6. Personel filtreleme

### Sprint 3: Maaş Hesaplama + Prim Kesinti (3-4 saat)
1. Prim kesinti kademeli kuralları
2. Gün kesinti hesabı
3. FM tutarı hesabı (net FM × ücret × çarpan)
4. Maaş özet tablosu
5. Kişi bazlı maaş override
6. Yemek bedeli hesabı

### Sprint 4: AI + Excel Export (3-4 saat)
1. AI pattern analiz (shift plan ile karşılaştırma)
2. AI chat (puantaj verileriyle context)
3. AI uyarılar (3+ eksik gün → izin türü sor)
4. Excel export (PUANTAJ formatında — 3 sheet)
5. Shift plan import (PDF → parse)

### Sprint 5: Ayarlar + İyileştirme (2-3 saat)
1. Dönem ayarları paneli (18 parametre)
2. Prim kuralları düzenleme
3. Personel yönetimi (ekle/çıkar/pozisyon)
4. Geçmiş dönem görüntüleme
5. Onay akışı (taslak → onaylı → kilitli)

---

## 6. ENNo → İSİM EŞLEŞTİRME TABLOSU

### Işıklar Şubesi
| EnNo | Ad Soyad | Pozisyon |
|------|----------|---------|
| 50014 | BASRİ ŞEN | Supervisor Buddy |
| 13 | KEMAL HÜSEYİNOĞLU | Barista |
| 100059 | CİHAN KOLAKAN | Barista |
| 19 | ATEŞ GÜNEY YILMAZ | Barista |
| 50022 | ECE ÖZ | Trainer Coach |
| 39 | EFE | Bar Buddy |
| 40 | AHMET | Bar Buddy |
| 43 | SÜLEYMAN UYGUN | Supervisor Buddy |
| 45 | İSMAİL SİVRİ | Stajyer |
| 46/47 | HÜLYA TÜZÜN | Crosscheck |
| 22 | YAVUZ KOLAKAN | (ayrıldı) |
| 44 | MUZAFFER İLKER | (yeni, Ocak) |

---

## 7. KRİTİK FARKLAR (Eski Plan vs Yeni Plan)

| Konu | Eski Plan | Yeni Plan |
|------|-----------|-----------|
| Veri yapısı | Sadece toplam | Gün-gün grid (31 sütun) |
| FM | Sadece pozitif | Pozitif + Negatif |
| Prim kesinti | Sabit oran | Kademeli (Üİ/R bazlı) |
| Departman | Tek şube | 3 departman (OFİS/İMALAT/ŞUBE) |
| PDKS isim | Var | Yok — EnNo eşleştirme |
| Devamsızlık | 3 tip | 10 farklı kod |
| Yarım gün | Yok | 0.5 destekli |
| Çapraz şube | Yok | G (görevli) kodu |
| Shift plan | Yok | Import + karşılaştırma |
| Export | Basit tablo | Resmi puantaj formatı |
