# DOSPRESSO Puantaj v3 — Final Plan

## AKıLLI ŞUBE TESPİTİ

### Problem
Lara personeli: EnNo 1,3,4,5,6,7,9,10,12,13,15,17,22,32,55
Işıklar personeli: EnNo 13,19,39,40,43,44,45,46,50014,50022,100059

⚠️ EnNo 13 ve 22 HER İKİ şubede var! (Lara: Gül/Eren, Işıklar: Kemal/Yavuz)

### Çözüm: 3 Katmanlı Tespit
```
1. DOSYA FORMATI → Ipucu
   - AGL_001.txt (tab-sep, Name boş) → büyük ihtimal Işıklar
   - Excel (KOD/İSİM/TARİH, isim dolu) → büyük ihtimal Lara

2. EnNo DAĞILIMI → Kesin tespit
   - 50014, 100059 gibi büyük numaralar → kesinlikle Işıklar
   - Dosyadaki tüm EnNo'ları tara
   - Her şubenin kayıtlı personel listesiyle karşılaştır
   - En çok eşleşen şube = doğru şube

3. KULLANICIYA ONAYLA
   - "Bu dosya IŞIKLAR şubesine ait görünüyor. Doğru mu?"
   - [Evet, Işıklar] [Hayır, Lara] [Hayır, başka]
```

### Çakışan EnNo Çözümü
EnNo 13: Lara'da Gül, Işıklar'da Kemal
→ Şube tespit edildikten sonra, o şubenin personeline eşleştir
→ Lara dosyası → 13 = Gül
→ Işıklar dosyası → 13 = Kemal

---

## SİSTEM AKIŞI (FİNAL)

```
┌─────────────────────────────────────────────────────────┐
│                    DOSPRESSO PUANTAJ                     │
│                                                         │
│  1. DOSYA YÜKLE                                         │
│     ↓                                                   │
│  2. OTOMATİK ŞUBE TESPİT                               │
│     "Bu dosya Işıklar şubesine ait (9/12 personel eşleşti)" │
│     ↓                                                   │
│  3. AI DOLDURMA + UYARILAR                              │
│     ✅ 9 personel tanındı                               │
│     🔄 Ateş 5g B.Park rotasyon                          │
│     ❌ Basri 14 Mart — ne yapayım?                      │
│     ↓                                                   │
│  4. İK TEK TIKLA CEVAPLA                                │
│     [Rapor] [İzin] [Off] [Devamsız]                     │
│     ↓                                                   │
│  5. MAAŞ HESAPLA (otomatik)                             │
│     ↓                                                   │
│  6. MUHASEBE ONAYLA → KİLİTLE → EXCEL İNDİR            │
└─────────────────────────────────────────────────────────┘
```

---

## VERİTABANI (Sadeleştirilmiş)

### Mevcut tablolar (korunacak)
- users, branches, employees, positions, settings, holidays

### Güncellenecek
- employees: + department_id, + full_name, + en_no (unique per branch)

### Yeni/Değişen 4 tablo

#### `departments`
id, name, branch_id
→ OFİS, İMALATHANE, IŞIKLAR

#### `daily_attendance` (ANA TABLO)
id, period_id, employee_id, day(1-31),
status (1/0/0.5/Yi/R/Ui/D/G/Mi/RT/""),
fm_minutes (+/-), source (pdks/manual/ai),
actual_start, actual_end, shift_start, shift_end, notes

#### `payroll_periods` (güncelleme)
+ period_settings (JSON), + workflow_status,
+ submitted_at, + submitted_by

#### `prim_rules`
rule_type, day_count, prim_percentage

---

## API (5 Ana Endpoint)

```
POST /api/upload
  → PDKS dosyası yükle
  → Otomatik şube tespit
  → AI grid doldurma + uyarılar
  → Response: { branchId, alerts[], grid[], summary }

GET /api/period/:id
  → Dönem verisi (grid + özet + maaş)
  
PUT /api/period/:id/day/:empId/:day
  → Tek gün durumu değiştir (İK tıklaması)
  → { status: "Yi" }

PUT /api/period/:id/workflow
  → Durum değiştir: submit/approve/reject/lock
  
POST /api/chat
  → AI sohbet (dönem context'i ile)
```

---

## SPRINT PLANI

### Sprint 1: Çekirdek (Upload → Grid → Özet)
- [ ] Akıllı şube tespiti (EnNo dağılım analizi)
- [ ] AGL_001.txt + Excel parser (her iki format)
- [ ] daily_attendance tablosu + CRUD
- [ ] Gün-gün grid otomatik doldurma
- [ ] Özet dashboard (KPI + maaş tablosu)
- [ ] Işıklar + Lara personel seed data (EnNo eşleştirmeli)

### Sprint 2: AI Soru-Cevap
- [ ] Shift plan import/karşılaştırma
- [ ] AI uyarı üretici (rotasyon, eksik okutma, anomali)
- [ ] Tek tıkla cevaplama UI (butonlar)
- [ ] Chat paneli

### Sprint 3: Maaş Hesaplama
- [ ] FM hesabı (günlük +/-)
- [ ] Prim kesinti (kademeli kurallar)
- [ ] Kişi bazlı maaş override
- [ ] Yemek bedeli (pozisyon bazlı)
- [ ] Excel export (puantaj formatı)

### Sprint 4: Workflow + Roller
- [ ] İK → Muhasebe akışı
- [ ] Onay/red/kilitleme
- [ ] Kullanıcı rolleri (ik/muhasebe/yonetim)
- [ ] Düzenleme geçmişi (kim ne değiştirdi)

### Sprint 5: İyileştirme
- [ ] Geçmiş dönem karşılaştırma
- [ ] İzin bakiye takibi
- [ ] Trend grafikleri
- [ ] PDF rapor export
- [ ] Multi-departman tek Excel (OFİS+İMALAT+ŞUBE)

---

## PERSONEL EnNo TABLOSU (Sistem Seed Data)

### LARA ŞUBESİ
| EnNo | Ad Soyad | Pozisyon |
|------|----------|---------|
| 32 | DENİZ HALİL ÇOLAK | Supervisor Buddy |
| 22 | EREN DEMİR | Barista |
| 6 | VEYSEL HÜSEYİNOĞLU | Barista |
| 5 | DİLARA JENNEFER ELMAS | Barista |
| 9 | BERKAN BOZDAĞ | Bar Buddy |
| 55 | EFE YÜKSEL | Bar Buddy |
| 13 | GÜL DEMİR | Bar Buddy |
| 15 | YAĞIZ TÖRER | Stajyer |
| 4 | AYBÜKE | Stajyer |
| 1 | BERK | Stajyer |
| 12 | BURCU | Stajyer |
| 17 | GÖKTUĞ | Stajyer |
| 7 | JASMİN | Stajyer |
| 3 | ŞEREF | Stajyer |
| 10 | TUĞBA | Stajyer |

### IŞIKLAR ŞUBESİ
| EnNo | Ad Soyad | Pozisyon |
|------|----------|---------|
| 50014 | BASRİ ŞEN | Supervisor Buddy |
| 13 | KEMAL HÜSEYİNOĞLU | Barista |
| 100059 | CİHAN KOLAKAN | Barista |
| 19 | ATEŞ GÜNEY YILMAZ | Barista |
| 39 | EFE | Bar Buddy |
| 40 | AHMET | Bar Buddy |
| 43 | SÜLEYMAN UYGUN | Supervisor Buddy |
| 45 | İSMAİL SİVRİ | Stajyer |
| 46 | HÜLYA TÜZÜN | Crosscheck |
| 44 | MUZAFFER İLKER | (Ocak'ta başladı) |
| 22 | YAVUZ KOLAKAN | (ayrıldı) |
| 50022 | ECE ÖZ | Trainer Coach |
