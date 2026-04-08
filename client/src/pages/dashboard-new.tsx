import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Upload, BarChart3, Bot, Coffee, ChevronRight, Shield } from "lucide-react";
import type { Branch } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardNew() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const activeBranches = branches.filter(b => b.active);

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: "#edeae4" }}>
      {/* Top Bar */}
      <header className="sticky top-0 z-10" style={{ backgroundColor: "#192838" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#c0392b" }}>
              <Coffee className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">DOSPRESSO</h1>
              <p className="text-[10px] text-white/50 tracking-widest uppercase">Personel Takip Sistemi</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "#c0392b" }}>
                  <span className="text-xs font-bold text-white">{user.displayName[0]}</span>
                </div>
                <span className="text-sm text-white/80">{user.displayName}</span>
              </div>
              <button
                onClick={logout}
                className="text-xs text-white/40 hover:text-white/80 transition-colors"
              >
                Çıkış
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#192838" }}>
            Puantaj & Maaş Yönetimi
          </h2>
          <p className="mt-2 text-sm" style={{ color: "#192838aa" }}>
            Şube seçin, PDKS verisini yükleyin, otomatik puantaj hesaplayın
          </p>
        </div>

        {/* Branch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
          {activeBranches.map(branch => (
            <button
              key={branch.id}
              onClick={() => navigate(`/sube/${branch.id}`)}
              className="group relative bg-white rounded-2xl overflow-hidden text-left
                         shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1
                         border border-black/5"
            >
              <div className="h-1.5" style={{ backgroundColor: "#c0392b" }} />
              <div className="p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#192838" }}>
                        <Building2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold" style={{ color: "#192838" }}>{branch.name}</h3>
                        <p className="text-xs" style={{ color: "#192838aa" }}>Şube</p>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: "#19283880" }}>
                      PDKS verisi yükle, puantaj hesapla, maaş tablosu oluştur
                    </p>
                  </div>
                  <div className="mt-1 h-8 w-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "#c0392b" }}>
                    <ChevronRight className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  {[
                    { icon: Upload, label: "Excel Yükle" },
                    { icon: BarChart3, label: "Puantaj" },
                    { icon: Bot, label: "AI Analiz" },
                  ].map(({ icon: Icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "#edeae4", color: "#192838aa" }}>
                      <Icon className="h-3 w-3" />{label}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom Info */}
        <div className="text-center space-y-6">
          <div className="flex justify-center gap-8">
            {[
              { icon: Shield, label: "Güvenli Veri", desc: "Tüm veriler şifreli" },
              { icon: Bot, label: "AI Destekli", desc: "Akıllı anomali tespiti" },
              { icon: BarChart3, label: "Otomatik", desc: "PDKS → Maaş tablosu" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="text-center">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: "#19283810" }}>
                  <Icon className="h-5 w-5" style={{ color: "#192838" }} />
                </div>
                <p className="text-xs font-medium" style={{ color: "#192838" }}>{label}</p>
                <p className="text-[11px]" style={{ color: "#19283860" }}>{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "#19283840" }}>DOSPRESSO Personel Takip Sistemi v4.0</p>
        </div>
      </div>
    </div>
  );
}
