import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Timer, LogOut, AlertTriangle, CalendarOff, CalendarCheck, Moon, Target, Briefcase, Sparkles, Loader2 } from "lucide-react";
import type { EmployeeSummary, DailyReport, WeeklyBreakdown } from "@shared/schema";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}dk`;
  return `${h}s ${min}dk`;
}

function formatHours(h: number): string {
  return `${h.toFixed(1)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Normal": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "Gec": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "Erken Cikis": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Eksik Kayit": "bg-red-500/10 text-red-500 border-red-500/20",
    "Mesai": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Hafta Sonu Calisma": "bg-slate-500/10 text-slate-400 border-slate-500/20",
    "Tatil Calisma": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Cok Kisa": "bg-red-500/10 text-red-500 border-red-500/20",
    "Cok Uzun": "bg-red-500/10 text-red-500 border-red-500/20",
    "Coklu Okutma": "bg-red-500/10 text-red-500 border-red-500/20",
    "Tek Okutma": "bg-red-500/10 text-red-500 border-red-500/20",
    "Eksik Okutma": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Molasiz": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    "Gece Gecisi": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    "Off Gunu Calisma": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Izinli": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    "Off": "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export default function EmployeeDetail() {
  const [, params] = useRoute("/employees/:enNo");
  const enNo = params?.enNo ? parseInt(params.enNo) : 0;
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const { data: uploads } = useQuery<any[]>({ queryKey: ["/api/uploads"] });

  const activeUploadId = useMemo(() => {
    if (selectedUploadId) return parseInt(selectedUploadId);
    if (uploads && uploads.length > 0) return Math.max(...uploads.map((u: any) => u.id));
    return null;
  }, [uploads, selectedUploadId]);

  const { data: reportData, isLoading } = useQuery<{ summaries: EmployeeSummary[] }>({
    queryKey: ["/api/report", activeUploadId],
    enabled: !!activeUploadId,
  });

  const employee = reportData?.summaries.find(s => s.enNo === enNo);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Personel bulunamadi veya bu yuklemede kaydi yok</p>
        <Link href="/">
          <Button variant="secondary">Dashboard'a Don</Button>
        </Link>
      </div>
    );
  }

  const issues = employee.dailyReports.filter(d => d.status.some(s => s !== "Normal" && s !== "Off" && s !== "Izinli"));

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="secondary" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" data-testid="text-employee-name">{employee.name}</h1>
              <Badge variant={employee.employmentType === "full_time" ? "default" : "secondary"} data-testid="badge-employment-type">
                {employee.employmentType === "full_time" ? "Tam Zamanli" : "Yari Zamanli"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Sicil No: {employee.enNo}
              {employee.department && ` | ${employee.department}`}
              {` | Haftalik: ${employee.weeklyHoursExpected} saat`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="button-ai-evaluation"
            disabled={aiLoading || !activeUploadId}
            onClick={async () => {
              if (!activeUploadId) return;
              setAiLoading(true);
              setAiDialogOpen(true);
              setAiAnalysis("");
              try {
                const res = await fetch(`/api/ai-analysis/${activeUploadId}/${enNo}`);
                if (!res.ok) {
                  const errData = await res.json().catch(() => ({}));
                  throw new Error(errData.error || `Sunucu hatasi (${res.status})`);
                }
                const data = await res.json();
                if (!data.analysis) throw new Error("Analiz sonucu bos");
                setAiAnalysis(data.analysis);
              } catch (err: any) {
                setAiAnalysis("Analiz sirasinda bir hata olustu: " + (err.message || "Bilinmeyen hata"));
              } finally {
                setAiLoading(false);
              }
            }}
          >
            {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            AI Degerlendirme
          </Button>
          <Select value={selectedUploadId || String(activeUploadId || "")} onValueChange={setSelectedUploadId}>
            <SelectTrigger className="w-[260px]" data-testid="select-upload">
              <SelectValue placeholder="Yukleme sec..." />
            </SelectTrigger>
            <SelectContent>
              {uploads?.map((u: any) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.fileName} ({u.totalRecords} kayit)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <Clock className="h-4 w-4 text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Toplam Calisma</p>
            <p className="text-lg font-bold font-mono" data-testid="text-total-work">{formatMinutes(employee.totalWorkMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <TrendingUp className="h-4 w-4 text-emerald-500 mb-1" />
            <p className="text-xs text-muted-foreground">Mesai</p>
            <p className="text-lg font-bold font-mono">{formatMinutes(employee.totalOvertimeMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <TrendingDown className="h-4 w-4 text-amber-500 mb-1" />
            <p className="text-xs text-muted-foreground">Eksik</p>
            <p className="text-lg font-bold font-mono">{formatMinutes(employee.totalDeficitMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <Timer className="h-4 w-4 text-amber-500 mb-1" />
            <p className="text-xs text-muted-foreground">Gec Kalma</p>
            <p className="text-lg font-bold font-mono">{employee.lateDays} gun</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <Target className="h-4 w-4 mb-1" style={{ color: employee.performancePercent >= 90 ? "#10b981" : employee.performancePercent >= 70 ? "#f59e0b" : "#ef4444" }} />
            <p className="text-xs text-muted-foreground">Performans</p>
            <p className="text-lg font-bold font-mono" data-testid="text-performance">%{employee.performancePercent}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Aylik Ozet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Toplam Calisma</span>
                <span className="font-mono font-semibold" data-testid="text-monthly-total">{formatHours(employee.monthlyTotalHours)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Beklenen Calisma</span>
                <span className="font-mono font-semibold" data-testid="text-monthly-expected">{formatHours(employee.monthlyExpectedHours)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${employee.performancePercent >= 90 ? "bg-emerald-500" : employee.performancePercent >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, employee.performancePercent)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Is Gunu</p>
                  <p className="font-mono font-semibold">{employee.workDays}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Off</p>
                  <p className="font-mono font-semibold" data-testid="text-off-days">{employee.offDays}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Izin</p>
                  <p className="font-mono font-semibold" data-testid="text-leave-days">{employee.leaveDays}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Detay Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ort. Gunluk</span>
                <span className="font-mono font-semibold">{formatMinutes(employee.avgDailyMinutes)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Erken Cikis</span>
                <span className="font-mono font-semibold">{employee.earlyLeaveDays} gun</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Toplam Mesai</span>
                <span className="font-mono font-semibold text-emerald-500">{formatMinutes(employee.totalOvertimeMinutes)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Toplam Eksik</span>
                <span className="font-mono font-semibold text-amber-500">{formatMinutes(employee.totalDeficitMinutes)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sorun Sayisi</span>
                <span className="font-mono font-semibold">{employee.issueCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {employee.weeklyBreakdown && employee.weeklyBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Haftalik Calisma Ozeti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hafta</TableHead>
                    <TableHead className="font-mono">Is Gunu</TableHead>
                    <TableHead className="font-mono">Calisma</TableHead>
                    <TableHead className="font-mono">Beklenen</TableHead>
                    <TableHead className="font-mono">Mesai</TableHead>
                    <TableHead className="font-mono">Eksik</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.weeklyBreakdown.map((w: WeeklyBreakdown, i: number) => {
                    const isOver = w.totalMinutes >= w.expectedMinutes;
                    return (
                      <TableRow key={i} data-testid={`row-week-${w.weekStart}`}>
                        <TableCell className="font-mono text-xs">
                          {w.weekStart.slice(5)} ~ {w.weekEnd.slice(5)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{w.workDays}</TableCell>
                        <TableCell className="font-mono text-xs">{formatMinutes(w.totalMinutes)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatMinutes(w.expectedMinutes)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {w.overtimeMinutes > 0 ? <span className="text-emerald-500">{formatMinutes(w.overtimeMinutes)}</span> : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {w.deficitMinutes > 0 ? <span className="text-amber-500">{formatMinutes(w.deficitMinutes)}</span> : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOver ? "default" : "destructive"} className="text-[10px]">
                            {isOver ? "Tamam" : "Eksik"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gunluk Detay Tablosu</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Gun</TableHead>
                  <TableHead className="font-mono">Vardiya</TableHead>
                  <TableHead className="font-mono text-center">Okutma</TableHead>
                  <TableHead className="font-mono">1. Giris</TableHead>
                  <TableHead className="font-mono">1. Cikis</TableHead>
                  <TableHead className="font-mono">2. Giris</TableHead>
                  <TableHead className="font-mono">2. Cikis</TableHead>
                  <TableHead className="font-mono">Toplam</TableHead>
                  <TableHead className="font-mono">Mesai</TableHead>
                  <TableHead className="font-mono">Eksik</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.dailyReports.map((d: DailyReport) => {
                  const hasIssue = d.status.some(s => ["Tek Okutma", "Eksik Okutma", "Coklu Okutma", "Eksik Kayit", "Cok Kisa", "Cok Uzun"].includes(s));
                  return (
                  <TableRow
                    key={d.date}
                    className={`${d.isOffDay ? "opacity-40" : d.isOnLeave ? "bg-cyan-500/5" : hasIssue ? "bg-red-500/5" : ""}`}
                    data-testid={`row-day-${d.date}`}
                  >
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-1">
                        {d.date}
                        {d.nightCrossing && <Moon className="h-3 w-3 text-indigo-400" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{d.dayName}</TableCell>
                    <TableCell className="text-xs">
                      {d.scheduleName ? (
                        <Badge variant="outline" className="text-[10px]">{d.scheduleName}</Badge>
                      ) : d.isOffDay ? (
                        <Badge variant="secondary" className="text-[10px]">OFF</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-center" data-testid={`text-punch-count-${d.date}`}>
                      <span className={`${d.punchCount === 4 ? "text-emerald-500" : d.punchCount === 1 || d.punchCount === 3 || d.punchCount >= 5 ? "text-red-500 font-bold" : ""}`}>
                        {d.punchCount}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[0]?.in || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[0]?.out || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[1]?.in || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[1]?.out || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.totalWorkMinutes > 0 ? formatMinutes(d.totalWorkMinutes) : "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.overtimeMinutes > 0 ? <span className="text-emerald-500">{formatMinutes(d.overtimeMinutes)}</span> : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.deficitMinutes > 0 ? <span className="text-amber-500">{formatMinutes(d.deficitMinutes)}</span> : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {d.status.map((s, i) => <StatusBadge key={i} status={s} />)}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Uyarilar ve Tutarsizliklar ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issues.map((d, i) => (
                <div key={i} className="flex items-center gap-3 text-sm border-b border-border pb-2 last:border-0">
                  <span className="font-mono text-xs text-muted-foreground min-w-[80px]">{d.date}</span>
                  <span className="text-xs min-w-[60px]">{d.dayName}</span>
                  <div className="flex gap-1 flex-wrap">
                    {d.status.filter(s => s !== "Normal" && s !== "Off" && s !== "Izinli").map((s, j) => (
                      <StatusBadge key={j} status={s} />
                    ))}
                  </div>
                  {d.lateMinutes > 0 && <span className="text-xs text-muted-foreground">({d.lateMinutes}dk gec)</span>}
                  {d.earlyLeaveMinutes > 0 && <span className="text-xs text-muted-foreground">({d.earlyLeaveMinutes}dk erken)</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Personel Degerlendirmesi - {employee?.name}
            </DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Yapay zeka analiz yapiyor...</p>
            </div>
          ) : (
            <div data-testid="text-ai-employee-analysis">
              <MarkdownRenderer content={aiAnalysis} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
