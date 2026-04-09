# DOSPRESSO Puantaj Sistemi — Kullanıcı Odaklı Tasarım

## KİM KULLANIYOR? NE YAPIYOR?

### 👤 İK Sorumlusu (Günlük/Haftalık)
"Ben her ay PDKS verisini alıp, kimin geldi kimin gelmedi kontrol ediyorum. 
Shift planıyla karşılaştırıyorum. Sonra muhasebe'ye gönderiyorum."

**Acı noktaları:**
- Excel'de satır satır kontrol etmek çok uzun sürüyor
- PDKS'de parmak basmayan kişiyi fark etmem zor
- Kimin rotasyonda kimin devamsız olduğunu ayırt edemiyorum
- Her ay aynı işi tekrarlıyorum

### 👤 Muhasebeci (Aylık)
"Ben İK'dan gelen puantajı alıp maaş hesaplıyorum. 
Kesinti, FM, prim — hepsini elle hesaplıyorum Excel'de."

**Acı noktaları:**
- FM dakikalarını günlük günlük toplamak çok zahmetli
- Prim kesinti kurallarını her seferinde hatırlamam lazım
- Kişi bazlı maaş farklılıkları var (Deniz'in maaşı farklı vs.)
- Formül hataları yapabiliyorum
- Son dakika değişiklikleri (izin düzeltme) her şeyi bozuyor

---

## SİSTEM NASIL ÇALIŞMALI? (3 ADIM)

### ADIM 1: YÜKLE (İK — 2 dakika)
```
İK dosyayı sürükler → Sistem her şeyi otomatik yapar:

  ✅ PDKS dosyasını okur (AGL_001.txt veya Excel)
  ✅ Personeli tanır (EnNo eşleştirme)
  ✅ Gün-gün grid'i doldurur
  ✅ Shift planıyla karşılaştırır
  ✅ AI uyarıları gösterir:
     🔄 "Ateş 24 Mart B.Park'ta — Görevli (G) olarak işaretledim"
     ❌ "Basri 14 Mart shift var ama PDKS yok — ne yapayım?"
     🏖 "Kemal 26-31 Mart Yi olarak görünüyor"
```

### ADIM 2: DÜZELT (İK — 5-10 dakika)
```
İK sadece AI'ın soruları cevaplayarak düzeltme yapar:

  AI: "Basri 14 Mart neden gelmemiş?"
  İK: [Rapor] [Ücretsiz İzin] [Yıllık İzin] [Off] [Devamsız]
      ↑ tek tıkla seç

  AI: "Ateş 8 Mart shift var ama PDKS yok"
  İK: [Başka şubede] [İzin] [Devamsız]

  AI: "Cihan 24 Mart -120dk eksik. Normal mi?"
  İK: [Evet, yarım gün] [Hayır, tam gün çalıştı]
```
→ İK tüm soruları cevapladıktan sonra → "Muhasebe'ye Gönder" butonu

### ADIM 3: HESAPLA + ONAYLA (Muhasebe — 3-5 dakika)
```
Muhasebe hazır tabloyu görür:

  Personel | Çalışılan | Eksik | FM | Maaş | Kesinti | Net
  ---------|-----------|-------|----|------|---------|----
  Basri    | 26        | 1     | 0  | 45K  | -1.5K   | 43.5K
  ...

  ✅ Tüm formüller otomatik
  ✅ Prim kesinti kuralları otomatik uygulanmış
  ✅ Bir hücreye tıklayıp düzeltebilir
  ✅ [Onayla] → Dönem kilitlenir
  ✅ [Excel İndir] → Resmi puantaj formatında
```

---

## EKRAN TASARIMLARI

### Ekran 1: Ana Sayfa (Login sonrası)
```
┌─────────────────────────────────────────────────┐
│  DOSPRESSO Puantaj                              │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ IŞIKLAR  │  │  OFİS    │  │İMALATHANE│      │
│  │ 10 kişi  │  │  7 kişi  │  │ 11 kişi  │      │
│  │ Mart ●   │  │ Mart ●   │  │ Mart ●   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                 │
│  ● Taslak  ● Hazır  ● Onaylı                   │
│                                                 │
│  Son İşlemler:                                  │
│  • Mart puantaj yüklendi (2 saat önce)         │
│  • Şubat puantaj onaylandı (5 gün önce)       │
└─────────────────────────────────────────────────┘
```

### Ekran 2: Dönem Sayfası (Departman seçildiğinde)

#### 2a. YÜKLEME DURUMU (henüz veri yok)
```
┌─────────────────────────────────────────────────┐
│  IŞIKLAR — Mart 2026                 [Ayarlar]  │
│                                                 │
│  ┌─────────────────────────────────┐            │
│  │                                 │            │
│  │   📂 PDKS Dosyası Yükle        │            │
│  │   Sürükle bırak veya seç       │            │
│  │   (.txt, .xlsx, .csv)           │            │
│  │                                 │            │
│  └─────────────────────────────────┘            │
│                                                 │
│  Geçmiş: Şubat ✅ | Ocak ✅                    │
└─────────────────────────────────────────────────┘
```

#### 2b. AI İNCELEME (veri yüklendi, sorular var)
```
┌─────────────────────────────────────────────────┐
│  IŞIKLAR — Mart 2026        Durum: ⏳ İnceleme  │
│                                                 │
│  ┌─ AI Tespit (4 soru) ─────────────────────┐  │
│  │                                           │  │
│  │  🔄 Ateş 9,24,25,27,28,29 Mart           │  │
│  │  Shift: B.Park | PDKS: kayıt yok         │  │
│  │  → [Görevli ✓] [Devamsız] [İzin]         │  │
│  │                                           │  │
│  │  ❌ Basri 14 Mart                         │  │
│  │  Shift: 16:30-01:00 | PDKS: yok          │  │
│  │  → [Off] [Rapor] [Ücretsiz İzin] [Devamsız] │
│  │                                           │  │
│  │  ⚠️ Cihan 24 Mart: -120dk eksik          │  │
│  │  → [Kabul et] [Tam gün say]              │  │
│  │                                           │  │
│  │  ⚠️ Hülya 13 Mart: -30dk eksik           │  │
│  │  → [Kabul et] [Tam gün say]              │  │
│  │                                           │  │
│  │  ────────────────────────────────         │  │
│  │  [Tümünü Onayla ve Devam Et →]            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### 2c. PUANTAJ ÖZET (sorular cevaplanmış)
```
┌─────────────────────────────────────────────────┐
│  IŞIKLAR — Mart 2026    Durum: ✅ Hesaplandı    │
│                                                 │
│  [📊 Özet] [📅 Gün Detay] [💰 Maaş] [🤖 AI]  │
│                                                 │
│  📊 5 KPI Kartı (personel, gün, eksik, FM, net)│
│                                                 │
│  ┌─ Maaş Özet Tablosu ──────────────────────┐  │
│  │ # │ Personel   │ Gün │İzin│Eksik│ FM │Net  │ │
│  │ 1 │ BASRİ ŞEN  │ 26  │ 0 │  1  │ 0  │43K  │ │
│  │ 2 │ KEMAL H.   │ 22  │6Yi│  0  │ 0  │41K  │ │
│  │ 3 │ ATEŞ G.Y.  │ 25  │1R │  0  │ 0  │41K  │ │
│  │   │    ↳ 🔄 5g görevli (B.Park)          │  │
│  │ ...                                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Muhasebe'ye Gönder]  [Excel İndir]           │
└─────────────────────────────────────────────────┘
```

#### 2d. MUHASEBE ONAYI
```
┌─────────────────────────────────────────────────┐
│  IŞIKLAR — Mart 2026    Durum: 📨 Onay Bekliyor │
│                                                 │
│  İK tarafından gönderildi: 9 Nisan 14:30       │
│                                                 │
│  ┌─ Maaş Tablosu (düzenlenebilir) ──────────┐  │
│  │ Tüm hesaplar hazır, sadece kontrol edin.  │  │
│  │                                           │  │
│  │ Toplam Brüt: 353.000₺                    │  │
│  │ Toplam Kesinti: -12.500₺                  │  │
│  │ Toplam FM: +4.200₺                       │  │
│  │ Toplam Net: 344.700₺                     │  │
│  │                                           │  │
│  │ [Her satır düzenlenebilir]                │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [❌ Reddet + Not] [✅ Onayla ve Kilitle]       │
│                                                 │
│  Onaylandıktan sonra değiştirilemez.           │
└─────────────────────────────────────────────────┘
```

---

## İŞ AKIŞI (WORKFLOW)

```
PDKS Dosyası
    │
    ▼
[1. YÜKLE] ──→ AI otomatik doldurur + uyarılar çıkarır
    │
    ▼
[2. İK İNCELE] ──→ AI sorularını cevapla (tek tıkla)
    │              ↳ Off mu? İzin mi? Rotasyon mu?
    ▼
[3. İK GÖNDER] ──→ Muhasebe'ye bildirim gider
    │
    ▼
[4. MUHASEBE KONTROL] ──→ Maaş tablosunu gör, düzelt
    │
    ▼
[5. ONAYLA] ──→ Dönem kilitlenir, Excel indirilir
```

**Dönem Durumları:**
```
⚪ Boş → ⏳ İnceleme → ✅ Hesaplandı → 📨 Gönderildi → ✅ Onaylandı → 🔒 Kilitli
```

---

## ROLLER VE YETKİLER

| İşlem | İK | Muhasebe | Yönetim |
|-------|-----|----------|---------|
| PDKS yükle | ✅ | ❌ | ✅ |
| AI sorularını cevapla | ✅ | ❌ | ✅ |
| Gün durumu değiştir | ✅ | ❌ | ✅ |
| Muhasebe'ye gönder | ✅ | ❌ | ✅ |
| Maaş düzelt | ❌ | ✅ | ✅ |
| Dönemi onayla | ❌ | ✅ | ✅ |
| Ayarları değiştir | ❌ | ❌ | ✅ |
| Excel indir | ✅ | ✅ | ✅ |

---

## AI'IN ROLÜ (Akıllı Asistan)

AI sadece yorum yapmaz — **aktif soru sorar ve önerir:**

### Yükleme Anında:
- "10 personelin PDKS verisi bulundu ✅"
- "Ateş 5 gün PDKS'de yok ama shift'te B.Park yazıyor → Görevli olarak işaretledim"
- "Basri 14 Mart PDKS yok, shift'te de off değil → Ne yapayım?"

### İnceleme Sırasında:
- "Kemal 26-31 Mart boş, shift'te Yıllık İzin yazıyor → Yi olarak işaretledim"
- "İsmail 21 ve 23 Mart gelmemiş ama shift'te çalışması gerekiyordu → Devamsız mı?"

### Maaş Hesabında:
- "Efe bu ay 263dk fazla mesai → +987₺ FM tutarı"
- "Gül'ün 4 gün eksik çalışması var → izin türü belirtilmeli"
- "Stajyerlerin yemek bedeli otomatik eklendi (330₺/gün)"

### Chat'te:
- "Ateş neden 5 gün yok?" → Detaylı rotasyon açıklaması
- "Bu ay toplam maliyet?" → Anlık hesaplama
- "Kemal'in yıllık izin bakiyesi?" → İzin takibi

---

## TEKNİK MİMARİ (Basitleştirilmiş)

### Frontend: 4 Ana Ekran
1. **Ana Sayfa** — Departman kartları + dönem durumu
2. **Dönem Sayfası** — Yükleme → İnceleme → Özet → Onay (tek sayfa, adım adım)
3. **Ayarlar** — Kurallar, toleranslar, pozisyonlar
4. **Personel** — Personel listesi, EnNo eşleştirme, maaş bilgileri

### Backend: 5 Ana Endpoint
1. `POST /api/upload` — PDKS dosyası yükle + AI işle
2. `GET /api/period/:id` — Dönem verisi (grid + özet + maaş)
3. `PUT /api/period/:id/day` — Gün durumu değiştir
4. `PUT /api/period/:id/approve` — Onayla/gönder
5. `POST /api/chat` — AI sohbet

### Veritabanı: 3 Ana Tablo
1. `daily_attendance` — Gün-gün puantaj (ANA VERİ)
2. `payroll_periods` — Dönem bilgisi + ayarlar + durum
3. `payroll_records` — Maaş hesaplama sonuçları

---

## SPRINT PLANI (Kullanıcı Odaklı)

### Sprint 1: Çekirdek Akış (1 gün)
- PDKS yükle → AI grid doldursun → Özet tablo göster
- Tek sayfa: Yükle → Gör → İndir
- Gerçek veriyle çalışan demo

### Sprint 2: AI Soru-Cevap (1 gün)
- AI uyarıları + tek tıkla cevaplama
- Shift plan karşılaştırma
- Rotasyon otomatik tespiti

### Sprint 3: Maaş Hesaplama (1 gün)
- Formüller (FM, kesinti, prim)
- Kişi bazlı maaş override
- Excel export (puantaj formatında)

### Sprint 4: Workflow + Roller (1 gün)
- İK → Muhasebe akışı
- Onay/red mekanizması
- Dönem kilitleme
- Kullanıcı rolleri

### Sprint 5: İyileştirme (1 gün)
- Geçmiş dönem karşılaştırma
- Trend grafikleri
- İzin bakiye takibi
- PDF rapor
