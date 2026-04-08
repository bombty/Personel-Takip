import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Upload, FileSpreadsheet, TrendingUp, Users, ChevronRight } from "lucide-react";
import type { Branch } from "@shared/schema";

export default function DashboardNew() {
  const [, navigate] = useLocation();
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  // Sadece aktif şubeleri göster
  const activeBranches = branches.filter(b => b.active);

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-stone-50 to-orange-50/30 dark:from-stone-950 dark:to-stone-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-bold">D</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              DOSPRESSO
            </h1>
          </div>
          <p className="text-stone-500 dark:text-stone-400 text-lg">
            Personel Puantaj & Takip Sistemi
          </p>
        </div>

        {/* Şube Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {activeBranches.map(branch => (
            <button
              key={branch.id}
              onClick={() => navigate(`/sube/${branch.id}`)}
              className="group relative bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-8 text-left
                         hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-xl
                         transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-orange-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                      {branch.name}
                    </h2>
                  </div>
                  <p className="text-stone-500 dark:text-stone-400 text-sm">
                    Excel yükle, puantaj hesapla, maaş tablosu oluştur
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-orange-500 transition-colors mt-2" />
              </div>

              {/* Alt bilgi */}
              <div className="mt-6 flex gap-4">
                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  <Upload className="h-3.5 w-3.5" />
                  <span>PDKS Yükle</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Puantaj</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>AI Analiz</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Hızlı Bilgi */}
        <div className="text-center">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Şube seçin → Excel yükleyin → Otomatik puantaj hesaplanır
          </p>
        </div>
      </div>
    </div>
  );
}
