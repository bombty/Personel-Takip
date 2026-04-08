# Replit Talimatı — Sprint 1+2 Migration

GitHub'dan pull yap ve aşağıdakileri çalıştır:

## 1. Pull
```bash
git pull origin main
```

## 2. DB Migration
```bash
npx drizzle-kit push
```

Bu komut şu yeni tabloları oluşturacak:
- positions (pozisyon ve maaş tanımları)
- employee_aliases (PDKS isim eşleştirme)
- payroll_periods (bordro dönemleri)
- payroll_records (personel bordro kayıtları)
- payroll_adjustments (düzeltme geçmişi)
- ai_punch_corrections (AI düzeltme kayıtları)
- employees tablosuna full_name + position_id kolonları

## 3. OpenAI Dependency
```bash
npm install openai
```
(Eğer zaten yoksa — mevcut AI analyzer kullanıyor olabilir)

## 4. Build & Test
```bash
npm run build
npm run start
```

## 5. Test Akışı
1. Tarayıcıda uygulamayı aç
2. Login ol (admin/0000)
3. Ana sayfada 2 şube kartı (Lara, Işıklar) görünmeli
4. Bir şubeye tıkla → Upload sayfası açılmalı
5. Henüz Excel yüklemeden arayüz düzgün görünüyorsa tamamdır

## 6. Seed Data Kontrolü
`initDefaults()` otomatik çalışacak ve 5 pozisyon ekleyecek:
- Stajyer (33K), Bar Buddy (36K), Barista (41K), Supervisor Buddy (45K), Supervisor (49K)

**NOT:** Kod değişikliği YAPMA, sadece migration, dependency ve test.
