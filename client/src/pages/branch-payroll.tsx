import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Upload, FileSpreadsheet, Bot, Send, Loader2,
  AlertTriangle, CheckCircle2, Clock, Download, RefreshCw, Coffee,
  MessageCircle, X
} from "lucide-react";
import type { Branch, PayrollPeriod } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// Colors
const NAVY = "#192838";
const RED = "#c0392b";
const BEIGE = "#edeae4";

// ===== TYPES =====
interface PayrollSummary {
  employeeName: string;
  enNo: number;
  position: string;
  workedDays: number;
  offDays: number;
  deficitDays: number;
  overtimeDaysHoliday: number;
  fmMinutes: number;
  totalSalary: number;
  dayDeduction: number;
  primDeduction: number;
  fmAmount: number;
  overtimeAmount: number;
  mealAmount: number;
  netPayment: number;
  aiNotes: string | null;
  aiConfidence: number | null;
  corrections: Array<{ date: string; type: string; confidence: number; reasoning: string }>;
}

interface ProcessingResult {
  periodId: number;
  records: PayrollSummary[];
  aiAnalysis: string;
  totalEmployees: number;
  totalCorrections: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ===== MAIN =====
export default function BranchPayroll() {
  const [, params] = useRoute("/sube/:branchId");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;

  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: branch } = useQuery<Branch>({
    queryKey: [`/api/branches/${branchId}`],
    enabled: !!branchId,
  });

  const { data: periods = [] } = useQuery<PayrollPeriod[]>({
    queryKey: [`/api/payroll/periods`, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/periods?branchId=${branchId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!branchId,
  });

  // Upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("branchId", String(branchId));
      const res = await fetch("/api/payroll/process", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ProcessingResult>;
    },
    onSuccess: (data) => {
      setProcessingResult(data);
      if (data.aiAnalysis) {
        setChatMessages([{ role: "assistant", content: data.aiAnalysis }]);
        setChatOpen(true);
      }
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

  // Chat
  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch("/api/payroll/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, periodId: processingResult?.periodId, branchId }),
      });
      if (!res.ok) throw new Error("Chat hatası");
      return (await res.json()).answer as string;
    },
    onSuccess: (answer) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: answer }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
  });

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }]);
    chatMutation.mutate(chatInput);
    setChatInput("");
  };

  if (!branchId) return null;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: BEIGE }}>
      {/* Header */}
      <header className="shrink-0" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </button>
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4" style={{ color: RED }} />
              <span className="text-sm font-bold text-white">{branch?.name || "Şube"}</span>
              <span className="text-xs text-white/40">/ Puantaj</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {processingResult && (
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: chatOpen ? RED : "rgba(255,255,255,0.1)",
                  color: "white"
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                AI Asistan
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main */}
        <div className="flex-1 overflow-auto">
          {!processingResult ? (
            <UploadSection
              isProcessing={uploadMutation.isPending}
              error={uploadMutation.error?.message}
              onDrop={handleDrop}
              onFileSelect={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              periods={periods}
            />
          ) : (
            <ResultsSection
              result={processingResult}
              branchName={branch?.name || ""}
              onNewUpload={() => {
                setProcessingResult(null);
                setChatMessages([]);
              }}
            />
          )}
        </div>

        {/* Chat Panel */}
        {chatOpen && processingResult && (
          <div className="w-96 border-l flex flex-col shrink-0" style={{ backgroundColor: "white", borderColor: "#19283815" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: NAVY }}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" style={{ color: RED }} />
                <span className="text-sm font-medium text-white">AI Puantaj Asistanı</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3" style={{ backgroundColor: "#f8f6f2" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed`}
                    style={{
                      backgroundColor: msg.role === "user" ? RED : "white",
                      color: msg.role === "user" ? "white" : NAVY,
                      boxShadow: msg.role === "assistant" ? "0 1px 3px rgba(0,0,0,0.05)" : "none"
                    }}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: RED }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t" style={{ borderColor: "#19283810" }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Soru sor... (ör: Efe neden 1 gün eksik?)"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                  style={{ borderColor: "#19283820", backgroundColor: "#f8f6f2" }}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  className="p-2 rounded-lg text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: RED }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["Eksik günleri açıkla", "En çok FM yapan kim?", "Maaş özeti"].map(q => (
                  <button
                    key={q}
                    onClick={() => setChatInput(q)}
                    className="text-[11px] px-2 py-0.5 rounded-md transition-colors"
                    style={{ backgroundColor: BEIGE, color: NAVY + "88" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== UPLOAD =====
function UploadSection({
  isProcessing, error, onDrop, onFileSelect, fileInputRef, handleFileSelect, periods
}: {
  isProcessing: boolean; error?: string; onDrop: (e: React.DragEvent) => void;
  onFileSelect: () => void; fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; periods: PayrollPeriod[];
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>PDKS Verisi Yükle</h2>
        <p className="text-sm" style={{ color: NAVY + "77" }}>
          Parmak izi cihazından alınan Excel dosyasını yükleyin
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={onFileSelect}
        className="bg-white border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
                   transition-all duration-300 hover:shadow-lg"
        style={{ borderColor: isProcessing ? RED + "60" : NAVY + "20" }}
      >
        {isProcessing ? (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto" style={{ color: RED }} />
            <div>
              <p className="text-lg font-semibold" style={{ color: NAVY }}>İşleniyor...</p>
              <p className="text-sm mt-1" style={{ color: NAVY + "66" }}>
                Excel okunuyor → AI analiz yapılıyor → Puantaj hesaplanıyor
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: BEIGE }}>
              <Upload className="h-8 w-8" style={{ color: RED }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: NAVY }}>Excel dosyasını sürükle bırak</p>
              <p className="text-sm mt-1" style={{ color: NAVY + "55" }}>veya tıklayarak seç (.xlsx, .xls, .csv)</p>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Yükleme Hatası</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="mt-12 grid grid-cols-3 gap-6">
        {[
          { icon: FileSpreadsheet, title: "1. Excel Yükle", desc: "PDKS giriş-çıkış verisi" },
          { icon: Bot, title: "2. AI Analiz", desc: "Otomatik hesaplama" },
          { icon: Download, title: "3. Sonuç Al", desc: "Puantaj + maaş tablosu" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="text-center">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: NAVY + "08" }}>
              <Icon className="h-5 w-5" style={{ color: NAVY }} />
            </div>
            <p className="text-sm font-medium" style={{ color: NAVY }}>{title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: NAVY + "55" }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Past Periods */}
      {periods.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xs font-medium mb-3" style={{ color: NAVY + "66" }}>Geçmiş Dönemler</h3>
          <div className="space-y-2">
            {periods.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-lg border" style={{ borderColor: NAVY + "10" }}>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4" style={{ color: NAVY + "44" }} />
                  <span className="text-sm" style={{ color: NAVY }}>{p.month}/{p.year}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "approved" ? "bg-green-100 text-green-700" :
                  p.status === "calculated" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {p.status === "approved" ? "Onaylı" : p.status === "calculated" ? "Hesaplandı" : "Taslak"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== RESULTS =====
function ResultsSection({
  result, branchName, onNewUpload
}: {
  result: ProcessingResult; branchName: string; onNewUpload: () => void;
}) {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>
            Puantaj Sonuçları
          </h2>
          <p className="text-xs mt-0.5" style={{ color: NAVY + "66" }}>
            {branchName} · {result.totalEmployees} personel
            {result.totalCorrections > 0 && (
              <span style={{ color: RED }}> · {result.totalCorrections} AI düzeltme</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onNewUpload} className="flex items-center gap-2 px-3 py-2 text-xs border rounded-lg transition-colors" style={{ borderColor: NAVY + "20", color: NAVY }}>
            <RefreshCw className="h-3.5 w-3.5" /> Yeni Yükleme
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-xs text-white rounded-lg transition-colors" style={{ backgroundColor: RED }}>
            <Download className="h-3.5 w-3.5" /> Excel İndir
          </button>
        </div>
      </div>

      {/* AI Warning */}
      {result.records.some(r => r.deficitDays > 2) && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">AI Uyarısı — Eksik Gün Tespiti</p>
              <p className="text-xs text-amber-700 mt-1">
                {result.records.filter(r => r.deficitDays > 2).map(r =>
                  `${r.employeeName}: ${r.deficitDays} gün eksik`
                ).join(" · ")}
              </p>
              <p className="text-[11px] text-amber-600 mt-1.5">
                Bu personeller için rapor, yıllık izin veya ücretsiz izin durumunu kontrol edin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${NAVY}10` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: NAVY }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/60">#</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-white/60">Personel</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-white/60">Pozisyon</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">Çalışılan</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">Off</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">Eksik</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">Mesai G.</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">FM dk</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-white/60">Brüt</th>
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-white/60">Kesinti</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-white">Net Ödeme</th>
                <th className="text-center px-2 py-2.5 text-[11px] font-medium text-white/60">AI</th>
              </tr>
            </thead>
            <tbody>
              {result.records.map((rec, i) => {
                const hasWarning = rec.deficitDays > 2;
                const hasCorrection = rec.corrections.length > 0;
                const totalDeduction = rec.dayDeduction + rec.primDeduction;

                return (
                  <tr key={i} className="border-b transition-colors hover:bg-black/[0.02]" style={{ borderColor: NAVY + "08" }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: NAVY + "44" }}>{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-sm" style={{ color: NAVY }}>
                        {rec.employeeName}
                      </span>
                      {hasWarning && <AlertTriangle className="inline h-3 w-3 ml-1.5 text-amber-500" />}
                      {!hasWarning && rec.deficitDays === 0 && <CheckCircle2 className="inline h-3 w-3 ml-1.5 text-green-500" />}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: NAVY + "77" }}>{rec.position}</td>
                    <td className="text-center px-2 py-2.5 font-medium text-sm" style={{ color: NAVY }}>{rec.workedDays}</td>
                    <td className="text-center px-2 py-2.5 text-xs" style={{ color: NAVY + "55" }}>{rec.offDays || "-"}</td>
                    <td className="text-center px-2 py-2.5 font-medium text-sm" style={{ color: rec.deficitDays > 0 ? RED : NAVY + "33" }}>
                      {rec.deficitDays || "-"}
                    </td>
                    <td className="text-center px-2 py-2.5 text-xs" style={{ color: NAVY + "55" }}>{rec.overtimeDaysHoliday || "-"}</td>
                    <td className="text-center px-2 py-2.5 text-xs" style={{ color: NAVY + "55" }}>{rec.fmMinutes || "-"}</td>
                    <td className="text-right px-3 py-2.5 text-xs" style={{ color: NAVY + "88" }}>
                      {rec.totalSalary.toLocaleString("tr-TR")}
                    </td>
                    <td className="text-right px-3 py-2.5 text-xs" style={{ color: totalDeduction > 0 ? RED : NAVY + "33" }}>
                      {totalDeduction > 0 ? `-${Math.round(totalDeduction).toLocaleString("tr-TR")}` : "-"}
                    </td>
                    <td className="text-right px-4 py-2.5 font-bold text-sm" style={{ color: NAVY }}>
                      {Math.round(rec.netPayment).toLocaleString("tr-TR")}₺
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {hasCorrection ? (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: RED + "cc" }}>
                          {rec.corrections.length}
                        </span>
                      ) : (
                        <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ backgroundColor: NAVY + "08" }}>
                <td colSpan={3} className="px-4 py-3 text-sm" style={{ color: NAVY }}>TOPLAM</td>
                <td className="text-center px-2 py-3" style={{ color: NAVY }}>{result.records.reduce((s, r) => s + r.workedDays, 0)}</td>
                <td className="text-center px-2 py-3 text-xs" style={{ color: NAVY + "66" }}>{result.records.reduce((s, r) => s + r.offDays, 0)}</td>
                <td className="text-center px-2 py-3" style={{ color: RED }}>{result.records.reduce((s, r) => s + r.deficitDays, 0) || "-"}</td>
                <td className="text-center px-2 py-3 text-xs" style={{ color: NAVY + "66" }}>{result.records.reduce((s, r) => s + r.overtimeDaysHoliday, 0) || "-"}</td>
                <td className="text-center px-2 py-3 text-xs" style={{ color: NAVY + "66" }}>{result.records.reduce((s, r) => s + r.fmMinutes, 0) || "-"}</td>
                <td className="text-right px-3 py-3 text-xs" style={{ color: NAVY }}>
                  {result.records.reduce((s, r) => s + r.totalSalary, 0).toLocaleString("tr-TR")}
                </td>
                <td className="text-right px-3 py-3 text-xs" style={{ color: RED }}>
                  {(() => {
                    const t = result.records.reduce((s, r) => s + r.dayDeduction + r.primDeduction, 0);
                    return t > 0 ? `-${Math.round(t).toLocaleString("tr-TR")}` : "-";
                  })()}
                </td>
                <td className="text-right px-4 py-3 text-sm" style={{ color: NAVY }}>
                  {Math.round(result.records.reduce((s, r) => s + r.netPayment, 0)).toLocaleString("tr-TR")}₺
                </td>
                <td className="px-2 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
