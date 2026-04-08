import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Upload, FileSpreadsheet, Bot, Send, Loader2,
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Download, RefreshCw
} from "lucide-react";
import type { Branch, PayrollPeriod, PayrollRecord } from "@shared/schema";

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
  corrections: Array<{
    date: string;
    type: string;
    confidence: number;
    reasoning: string;
  }>;
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

// ===== MAIN COMPONENT =====
export default function BranchPayroll() {
  const [, params] = useRoute("/sube/:branchId");
  const [, navigate] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;

  const [activeTab, setActiveTab] = useState<"upload" | "results">("upload");
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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

  // ===== UPLOAD & PROCESS =====
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("branchId", String(branchId));

      const res = await fetch("/api/payroll/process", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json() as Promise<ProcessingResult>;
    },
    onSuccess: (data) => {
      setProcessingResult(data);
      setActiveTab("results");
      // AI analiz varsa chat'e ekle
      if (data.aiAnalysis) {
        setChatMessages([{
          role: "assistant",
          content: data.aiAnalysis,
        }]);
        setChatOpen(true);
      }
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  // ===== AI CHAT =====
  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch("/api/payroll/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          periodId: processingResult?.periodId,
          branchId,
        }),
      });
      if (!res.ok) throw new Error("Chat hatası");
      const data = await res.json();
      return data.answer as string;
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

  // ===== RENDER =====
  if (!branchId) return null;

  return (
    <div className="h-full flex flex-col bg-stone-50 dark:bg-stone-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-stone-900 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-stone-500" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                {branch?.name || "Şube"}
              </h1>
              <p className="text-xs text-stone-500">Puantaj & Maaş Hesaplama</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {processingResult && (
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${chatOpen
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  }`}
              >
                <Bot className="h-4 w-4" />
                AI Asistan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main Area */}
        <div className={`flex-1 overflow-auto transition-all ${chatOpen ? "mr-0" : ""}`}>
          {activeTab === "upload" && !processingResult && (
            <UploadSection
              isProcessing={uploadMutation.isPending}
              error={uploadMutation.error?.message}
              onDrop={handleDrop}
              onFileSelect={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              periods={periods}
            />
          )}

          {processingResult && (
            <ResultsSection
              result={processingResult}
              branchName={branch?.name || ""}
              expandedRow={expandedRow}
              setExpandedRow={setExpandedRow}
              onNewUpload={() => {
                setProcessingResult(null);
                setActiveTab("upload");
                setChatMessages([]);
              }}
            />
          )}
        </div>

        {/* AI Chat Panel */}
        {chatOpen && processingResult && (
          <div className="w-96 border-l bg-white dark:bg-stone-900 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">AI Puantaj Asistanı</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Kapat
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-orange-600 text-white"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Soru sor... (ör: Efe neden 1 gün eksik?)"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg bg-stone-50 dark:bg-stone-800
                             focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {["Eksik günleri açıkla", "En çok mesai yapan kim?", "Maaş özeti ver"].map(q => (
                  <button
                    key={q}
                    onClick={() => { setChatInput(q); }}
                    className="text-xs px-2 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500
                               hover:bg-orange-50 hover:text-orange-600 transition-colors"
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

// ===== UPLOAD SECTION =====
function UploadSection({
  isProcessing, error, onDrop, onFileSelect, fileInputRef, handleFileSelect, periods
}: {
  isProcessing: boolean;
  error?: string;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  periods: PayrollPeriod[];
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
          PDKS Verisi Yükle
        </h2>
        <p className="text-stone-500 text-sm">
          Parmak izi cihazından alınan Excel dosyasını yükleyin.
          Sistem otomatik olarak puantaj hesaplayacak.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={onFileSelect}
        className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
                    transition-all duration-300
                    ${isProcessing
                      ? "border-orange-300 bg-orange-50/50"
                      : "border-stone-300 hover:border-orange-400 hover:bg-orange-50/30 dark:border-stone-600 dark:hover:border-orange-500"
                    }`}
      >
        {isProcessing ? (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto" />
            <div>
              <p className="text-lg font-medium text-stone-700 dark:text-stone-300">İşleniyor...</p>
              <p className="text-sm text-stone-500 mt-1">
                Excel okunuyor → Personel eşleştiriliyor → AI analiz yapılıyor
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto">
              <Upload className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-stone-700 dark:text-stone-300">
                Excel dosyasını sürükle bırak
              </p>
              <p className="text-sm text-stone-400 mt-1">
                veya tıklayarak seç (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Yükleme Hatası</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="mt-12 grid grid-cols-3 gap-6">
        {[
          { icon: FileSpreadsheet, title: "1. Excel Yükle", desc: "PDKS cihazından alınan giriş-çıkış verisi" },
          { icon: Bot, title: "2. AI Analiz", desc: "Otomatik hesaplama + anomali tespiti" },
          { icon: Download, title: "3. Sonuç Al", desc: "Puantaj tablosu + maaş hesabı" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="text-center">
            <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-3">
              <Icon className="h-5 w-5 text-stone-500" />
            </div>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{title}</p>
            <p className="text-xs text-stone-400 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* Geçmiş Dönemler */}
      {periods.length > 0 && (
        <div className="mt-12">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Geçmiş Dönemler</h3>
          <div className="space-y-2">
            {periods.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-stone-800 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-stone-400" />
                  <span className="text-sm text-stone-700 dark:text-stone-300">
                    {p.month}/{p.year}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "approved" ? "bg-green-100 text-green-700" :
                  p.status === "calculated" ? "bg-blue-100 text-blue-700" :
                  "bg-stone-100 text-stone-500"
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

// ===== RESULTS SECTION =====
function ResultsSection({
  result, branchName, expandedRow, setExpandedRow, onNewUpload
}: {
  result: ProcessingResult;
  branchName: string;
  expandedRow: number | null;
  setExpandedRow: (n: number | null) => void;
  onNewUpload: () => void;
}) {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      {/* Summary Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            Puantaj Sonuçları — {branchName}
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            {result.totalEmployees} personel · {result.totalCorrections > 0 &&
              <span className="text-orange-600">{result.totalCorrections} AI düzeltme · </span>
            }
            Kayıt edildi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNewUpload}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg
                       hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Yeni Yükleme
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
            <Download className="h-4 w-4" />
            Excel İndir
          </button>
        </div>
      </div>

      {/* AI Uyarılar */}
      {result.records.some(r => r.deficitDays > 2) && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">AI Uyarısı</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {result.records.filter(r => r.deficitDays > 2).map(r =>
                  `${r.employeeName}: ${r.deficitDays} gün eksik — rapor, yıllık izin veya ücretsiz izin olabilir.`
                ).join(" | ")}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                Bu personeller için izin durumunu kontrol edin. AI Asistan'a sorarak detay alabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-800 border-b">
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs">#</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs">Personel</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 text-xs">Pozisyon</th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">Çalışılan
                  <br /><span className="text-blue-500">🔵</span></th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">Off
                  <br /><span className="text-blue-500">🔵</span></th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">Eksik
                  <br /><span className="text-blue-500">🔵</span></th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">Mesai Gün
                  <br /><span className="text-blue-500">🔵</span></th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">FM (dk)
                  <br /><span className="text-blue-500">🔵</span></th>
                <th className="text-right px-4 py-3 font-medium text-stone-500 text-xs">Brüt Maaş</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500 text-xs">Kesinti</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500 text-xs font-semibold">Net Ödeme</th>
                <th className="text-center px-3 py-3 font-medium text-stone-500 text-xs">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {result.records.map((rec, i) => {
                const hasWarning = rec.deficitDays > 2 || (rec.aiConfidence !== null && rec.aiConfidence < 70);
                const hasCorrection = rec.corrections.length > 0;
                const isExpanded = expandedRow === i;
                const totalDeduction = rec.dayDeduction + rec.primDeduction;

                return (
                  <tr key={i} className="group">
                    <td className="px-4 py-3 text-stone-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : i)}
                        className="text-left hover:text-orange-600 transition-colors"
                      >
                        <span className="font-medium text-stone-900 dark:text-stone-100">
                          {rec.employeeName}
                        </span>
                        {hasWarning && (
                          <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1.5" />
                        )}
                        {!hasWarning && rec.deficitDays === 0 && (
                          <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500 ml-1.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{rec.position}</td>
                    <td className="text-center px-3 py-3 font-medium">{rec.workedDays}</td>
                    <td className="text-center px-3 py-3 text-stone-500">{rec.offDays || "-"}</td>
                    <td className={`text-center px-3 py-3 font-medium ${rec.deficitDays > 0 ? "text-red-600" : "text-stone-400"}`}>
                      {rec.deficitDays || "-"}
                    </td>
                    <td className="text-center px-3 py-3 text-stone-500">{rec.overtimeDaysHoliday || "-"}</td>
                    <td className="text-center px-3 py-3 text-stone-500">{rec.fmMinutes || "-"}</td>
                    <td className="text-right px-4 py-3 text-stone-700 dark:text-stone-300">
                      {rec.totalSalary.toLocaleString("tr-TR")}₺
                    </td>
                    <td className={`text-right px-4 py-3 ${totalDeduction > 0 ? "text-red-600" : "text-stone-400"}`}>
                      {totalDeduction > 0 ? `-${Math.round(totalDeduction).toLocaleString("tr-TR")}₺` : "-"}
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-stone-900 dark:text-stone-100">
                      {Math.round(rec.netPayment).toLocaleString("tr-TR")}₺
                    </td>
                    <td className="text-center px-3 py-3">
                      {hasCorrection ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          {rec.corrections.length}
                        </span>
                      ) : (
                        <span className="text-green-500">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Toplam Satırı */}
            <tfoot>
              <tr className="bg-stone-50 dark:bg-stone-800 border-t-2 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-stone-700 dark:text-stone-300">TOPLAM</td>
                <td className="text-center px-3 py-3">{result.records.reduce((s, r) => s + r.workedDays, 0)}</td>
                <td className="text-center px-3 py-3">{result.records.reduce((s, r) => s + r.offDays, 0)}</td>
                <td className="text-center px-3 py-3 text-red-600">
                  {result.records.reduce((s, r) => s + r.deficitDays, 0) || "-"}
                </td>
                <td className="text-center px-3 py-3">{result.records.reduce((s, r) => s + r.overtimeDaysHoliday, 0) || "-"}</td>
                <td className="text-center px-3 py-3">{result.records.reduce((s, r) => s + r.fmMinutes, 0) || "-"}</td>
                <td className="text-right px-4 py-3">
                  {result.records.reduce((s, r) => s + r.totalSalary, 0).toLocaleString("tr-TR")}₺
                </td>
                <td className="text-right px-4 py-3 text-red-600">
                  {(() => {
                    const total = result.records.reduce((s, r) => s + r.dayDeduction + r.primDeduction, 0);
                    return total > 0 ? `-${Math.round(total).toLocaleString("tr-TR")}₺` : "-";
                  })()}
                </td>
                <td className="text-right px-4 py-3 text-stone-900 dark:text-stone-100">
                  {Math.round(result.records.reduce((s, r) => s + r.netPayment, 0)).toLocaleString("tr-TR")}₺
                </td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
