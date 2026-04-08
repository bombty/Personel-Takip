# Replit Talimatı — Sprint 1 Migration

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
- positions
- employee_aliases
- payroll_periods
- payroll_records
- payroll_adjustments
- ai_punch_corrections
- employees tablosuna full_name + position_id kolonları

## 3. Build & Test
```bash
npm run build
npm run start
```

## 4. Seed Data Kontrolü
Uygulama açıldığında `initDefaults()` otomatik çalışacak ve 5 pozisyon ekleyecek:
- Stajyer (33K), Bar Buddy (36K), Barista (41K), Supervisor Buddy (45K), Supervisor (49K)

## 5. Test Endpoint
Tarayıcıda uygulamayı aç, login ol. Hata yoksa tamamdır.

**NOT:** Kod değişikliği YAPMA, sadece migration ve test.
