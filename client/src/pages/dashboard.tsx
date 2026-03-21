import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Timer,
  LogOut,
  BarChart3,
  CalendarOff,
  CalendarCheck,
  Download,
  Target,
  Calendar,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { EmployeeSummary, WeeklyBreakdown } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTHS = [
  { value: "all", label: "Tum Aylar" },
  { value: "1", label: "Ocak" },
  { value: "2", label: "Subat" },
  { value: "3", label: "Mart" },
  { value: "4", label: "Nisan" },
  { value: "5", label: "Mayis" },
  { value: "6", label: "Haziran" },
  { value: "7", label: "Temmuz" },
  { value: "8", label: "Agustos" },
  { value: "9", label: "Eylul" },
  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasim" },
  { value: "12", label: "Aralik" },
];

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}dk`;
  return `${h}s ${min}dk`;
}

function formatHours(h: number): string {
  return `${h.toFixed(1)}s`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: any;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    default: "text-primary",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold font-mono mt-1" data-testid={`text-stat-${title}`}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`${colorMap[variant]} opacity-70`}>
            <Icon className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof EmployeeSummary>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [dataSource, setDataSource] = useState<"upload" | "period">("upload");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const { isYonetim } = useAuth();
  const { selectedBranchId } = useBranch();

  useEffect(() => {
    setSelectedUploadId("");
    setSelectedPeriodId("");
  }, [selectedBranchId]);

  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
  const { data: uploads } = useQuery<any[]>({ queryKey: [`/api/uploads${branchParam}`] });
  const { data: periods } = useQuery<any[]>({ queryKey: [`/api/report-periods${branchParam}`] });

  const activeUploadId = useMemo(() => {
    if (dataSource === "period") return null;
    if (selectedUploadId) return parseInt(selectedUploadId);
    if (uploads && uploads.length > 0) return Math.max(...uploads.map((u: any) => u.id));
    return null;
  }, [uploads, selectedUploadId, dataSource]);

  const activePeriodId = useMemo(() => {
    if (dataSource !== "period") return null;
    if (selectedPeriodId) return parseInt(selectedPeriodId);
    return null;
  }, [selectedPeriodId, dataSource]);

  const { data: reportData, isLoading } = useQuery<{ summaries: EmployeeSummary[] }>({
    queryKey: activePeriodId ? ["/api/report/period", activePeriodId] : ["/api/report", activeUploadId],
    enabled: !!(activeUploadId || activePeriodId),
  });

  const allSummariesRaw = reportData?.summaries || [];
  const allSummaries = useMemo(() => {
    if (selectedBranchId === null) return allSummariesRaw;
    return allSummariesRaw.filter(s => s.branchId === selectedBranchId);
  }, [allSummariesRaw, selectedBranchId]);

  const filteredByMonth = useMemo(() => {
    if (selectedMonth === "all") return allSummaries;
    const month = parseInt(selectedMonth);
    return allSummaries.map(s => {
      const filteredReports = s.dailyReports.filter(d => {
        const m = parseInt(d.date.split("-")[1]);
        return m === month;
      });
      const workDays = filteredReports.filter(r => !r.isOffDay && !r.isOnLeave && r.punchCount >= 2).length;
      const totalWorkMinutes = filteredReports.reduce((sum, r) => sum + r.totalWorkMinutes, 0);
      const totalOvertimeMinutes = filteredReports.reduce((sum, r) => sum + r.overtimeMinutes, 0);
      const totalDeficitMinutes = filteredReports.reduce((sum, r) => sum + r.deficitMinutes, 0);
      const lateDays = filteredReports.filter(r => r.status.includes("Gec")).length;
      const earlyLeaveDays = filteredReports.filter(r => r.status.includes("Erken Cikis")).length;
      const issueCount = filteredReports.filter(r => r.status.some(st =>
        ["Tek Okutma", "Eksik Okutma", "Coklu Okutma", "Eksik Kayit", "Cok Kisa", "Cok Uzun"].includes(st)
      )).length;
      const offDays = filteredReports.filter(r => r.isOffDay).length;
      const leaveDays = filteredReports.filter(r => r.isOnLeave).length;
      const lbMap = new Map<string, { type: string; label: string; days: number }>();
      for (const r of filteredReports) {
        if (r.isOnLeave) {
          for (const st of r.status) {
            const lt = s.leaveBreakdown?.find(lb => lb.label === st);
            if (lt) {
              const existing = lbMap.get(lt.type) || { ...lt, days: 0 };
              existing.days++;
              lbMap.set(lt.type, existing);
            }
          }
        }
      }
      const leaveBreakdown = Array.from(lbMap.values());
      return {
        ...s,
        dailyReports: filteredReports,
        workDays,
        totalWorkMinutes: Math.round(totalWorkMinutes),
        avgDailyMinutes: workDays > 0 ? Math.round(totalWorkMinutes / workDays) : 0,
        totalOvertimeMinutes: Math.round(totalOvertimeMinutes),
        totalDeficitMinutes: Math.round(totalDeficitMinutes),
        lateDays,
        earlyLeaveDays,
        issueCount,
        offDays,
        leaveDays,
        leaveBreakdown,
        monthlyTotalHours: Math.round(totalWorkMinutes / 60 * 10) / 10,
      };
    });
  }, [allSummaries, selectedMonth]);

  const summaries = useMemo(() => {
    if (selectedEmployee === "all") return filteredByMonth;
    const enNo = parseInt(selectedEmployee);
    return filteredByMonth.filter(s => s.enNo === enNo);
  }, [filteredByMonth, selectedEmployee]);

  const stats = useMemo(() => {
    if (summaries.length === 0) return null;
    const totalPersonnel = summaries.length;
    const totalWork = summaries.reduce((s, e) => s + e.totalWorkMinutes, 0);
    const avgDaily = summaries.reduce((s, e) => s + e.avgDailyMinutes, 0) / totalPersonnel;
    const totalOvertime = summaries.reduce((s, e) => s + e.totalOvertimeMinutes, 0);
    const totalDeficit = summaries.reduce((s, e) => s + e.totalDeficitMinutes, 0);
    const totalLate = summaries.reduce((s, e) => s + e.lateDays, 0);
    const totalEarlyLeave = summaries.reduce((s, e) => s + e.earlyLeaveDays, 0);
    const totalIssues = summaries.reduce((s, e) => s + e.issueCount, 0);
    const totalOff = summaries.reduce((s, e) => s + e.offDays, 0);
    const totalLeave = summaries.reduce((s, e) => s + e.leaveDays, 0);
    const avgPerformance = summaries.reduce((s, e) => s + e.performancePercent, 0) / totalPersonnel;
    const totalMonthlyHours = summaries.reduce((s, e) => s + e.monthlyTotalHours, 0);
    const totalExpectedHours = summaries.reduce((s, e) => s + e.monthlyExpectedHours, 0);
    const leaveBreakdownMap = new Map<string, { label: string; days: number }>();
    for (const emp of summaries) {
      if (emp.leaveBreakdown) {
        for (const lb of emp.leaveBreakdown) {
          const existing = leaveBreakdownMap.get(lb.type) || { label: lb.label, days: 0 };
          existing.days += lb.days;
          leaveBreakdownMap.set(lb.type, existing);
        }
      }
    }
    const leaveDesc = Array.from(leaveBreakdownMap.values())
      .sort((a, b) => b.days - a.days)
      .map(l => `${l.label}: ${l.days}`)
      .join(", ");
    return { totalPersonnel, totalWork, avgDaily, totalOvertime, totalDeficit, totalLate, totalEarlyLeave, totalIssues, totalOff, totalLeave, leaveDesc, avgPerformance, totalMonthlyHours, totalExpectedHours };
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    let filtered = summaries.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      String(s.enNo).includes(search)
    );
    filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal, "tr") : bVal.localeCompare(aVal, "tr");
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return filtered;
  }, [summaries, search, sortKey, sortDir]);

  const chartData = useMemo(() => {
    return summaries.slice(0, 20).map(s => ({
      name: s.name.length > 8 ? s.name.slice(0, 8) + "..." : s.name,
      calisma: Math.round(s.avgDailyMinutes / 60 * 10) / 10,
      mesai: Math.round(s.totalOvertimeMinutes / 60 * 10) / 10,
    }));
  }, [summaries]);

  const weeklyChartData = useMemo(() => {
    if (summaries.length === 0) return [];
    const allWeeks = new Map<string, { totalMinutes: number; expectedMinutes: number; count: number }>();
    for (const s of summaries) {
      for (const w of s.weeklyBreakdown) {
        const existing = allWeeks.get(w.weekStart) || { totalMinutes: 0, expectedMinutes: 0, count: 0 };
        existing.totalMinutes += w.totalMinutes;
        existing.expectedMinutes += w.expectedMinutes;
        existing.count++;
        allWeeks.set(w.weekStart, existing);
      }
    }
    return Array.from(allWeeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week: week.slice(5),
        calisma: Math.round(data.totalMinutes / data.count / 60 * 10) / 10,
        beklenen: Math.round(data.expectedMinutes / data.count / 60 * 10) / 10,
      }));
  }, [summaries]);

  function handleSort(key: keyof EmployeeSummary) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if ((!uploads || uploads.length === 0) && (!periods || periods.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-semibold mb-2">Henuz veri yuklemesi yok</h2>
          <p className="text-muted-foreground mb-4">
            Dashboard ve Excel export icin once parmak izi verilerinizi yukleyin.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/upload" data-testid="link-go-upload">
              <Button size="sm">
                <Upload className="h-4 w-4 mr-1" /> Veri Yukle
              </Button>
            </Link>
            <Link href="/periods" data-testid="link-go-periods">
              <Button size="sm" variant="outline">
                <CalendarCheck className="h-4 w-4 mr-1" /> Donemler
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Personel devam durumu genel gorunum</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center border rounded-md overflow-hidden" data-testid="toggle-data-source">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              onClick={() => setDataSource("upload")}
            >
              Yukleme
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === "period" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              onClick={() => setDataSource("period")}
            >
              Donem
            </button>
          </div>
          {dataSource === "upload" ? (
            <Select value={selectedUploadId || String(activeUploadId || "")} onValueChange={setSelectedUploadId}>
              <SelectTrigger className="w-[220px]" data-testid="select-upload">
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
          ) : (
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger className="w-[220px]" data-testid="select-period">
                <SelectValue placeholder="Donem sec..." />
              </SelectTrigger>
              <SelectContent>
                {periods?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.status === "final" ? "Final" : "Taslak"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Ay sec..." />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-[180px]" data-testid="select-employee-filter">
              <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Personel sec..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Personel</SelectItem>
              {allSummaries.map(s => (
                <SelectItem key={s.enNo} value={String(s.enNo)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeUploadId && (
            <Button
              variant="outline"
              size="sm"
              data-testid="button-ai-report"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                setAiDialogOpen(true);
                setAiAnalysis("");
                try {
                  const res = await fetch(`/api/ai-analysis/${activeUploadId}`);
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
              AI Rapor
            </Button>
          )}
          {activeUploadId ? (
            <a href={`/api/export/${activeUploadId}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </a>
          ) : activePeriodId ? (
            <a href={`/api/export/period/${activePeriodId}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" data-testid="button-export-period">
                <Download className="h-4 w-4 mr-1" /> Excel
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard title="Personel" value={stats.totalPersonnel} icon={Users} />
            <StatCard title="Ort. Gunluk" value={formatMinutes(Math.round(stats.avgDaily))} icon={Clock} />
            <StatCard title="Toplam Mesai" value={formatMinutes(stats.totalOvertime)} icon={TrendingUp} variant="success" />
            <StatCard title="Toplam Eksik" value={formatMinutes(stats.totalDeficit)} icon={TrendingDown} variant="warning" />
            <StatCard title="Gec Kalma" value={`${stats.totalLate} gun`} icon={Timer} variant="warning" />
            <StatCard title="Erken Cikis" value={`${stats.totalEarlyLeave} gun`} icon={LogOut} variant="warning" />
            <StatCard title="Off Gunleri" value={stats.totalOff} icon={CalendarOff} />
            <StatCard title="Izin Gunleri" value={stats.totalLeave} icon={CalendarCheck} description={stats.leaveDesc || undefined} />
            <StatCard title="Sorun Sayisi" value={stats.totalIssues} icon={AlertTriangle} variant="danger" />
            <StatCard
              title="Performans"
              value={`%${Math.round(stats.avgPerformance)}`}
              icon={Target}
              variant={stats.avgPerformance >= 90 ? "success" : stats.avgPerformance >= 70 ? "warning" : "danger"}
              description={`${formatHours(stats.totalMonthlyHours)} / ${formatHours(stats.totalExpectedHours)}`}
            />
          </div>
        </>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Personel Bazli Ort. Gunluk Calisma (saat)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="calisma" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Calisma (s)" />
                    <Bar dataKey="mesai" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Mesai (s)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {weeklyChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Haftalik Calisma Performansi (saat)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="calisma" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Ort. Calisma (s)" />
                    <Bar dataKey="beklenen" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Beklenen (s)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-sm font-medium">Personel Ozet Tablosu</CardTitle>
            <Input
              placeholder="Personel ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
              data-testid="input-search-employee"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")} data-testid="th-name">
                    Personel {sortKey === "name" ? (sortDir === "asc" ? "^" : "v") : ""}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("enNo")}>Sicil</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono">Tip</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("workDays")}>Is Gunu</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("avgDailyMinutes")}>Ort. Gunluk</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("totalOvertimeMinutes")}>Mesai</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("totalDeficitMinutes")}>Eksik</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("lateDays")}>Gec</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("offDays")}>Off</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("performancePercent")}>Performans</TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("issueCount")}>Tutarsiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((s) => (
                  <TableRow key={s.enNo} className="hover-elevate cursor-pointer" data-testid={`row-employee-${s.enNo}`}>
                    <TableCell>
                      <Link href={`/employees/${s.enNo}`} className="font-medium">{s.name}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{s.enNo}</TableCell>
                    <TableCell>
                      <Badge variant={s.employmentType === "full_time" ? "default" : "secondary"} className="text-[10px]">
                        {s.employmentType === "full_time" ? "TZ" : "YZ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{s.workDays}</TableCell>
                    <TableCell className="font-mono">{formatMinutes(s.avgDailyMinutes)}</TableCell>
                    <TableCell className="font-mono">
                      {s.totalOvertimeMinutes > 0 ? <span className="text-emerald-500">{formatMinutes(s.totalOvertimeMinutes)}</span> : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.totalDeficitMinutes > 0 ? <span className="text-amber-500">{formatMinutes(s.totalDeficitMinutes)}</span> : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.lateDays > 0 ? <span className="text-amber-500">{s.lateDays}</span> : "-"}
                    </TableCell>
                    <TableCell className="font-mono">{s.offDays || "-"}</TableCell>
                    <TableCell className="font-mono">
                      <span className={`${s.performancePercent >= 90 ? "text-emerald-500" : s.performancePercent >= 70 ? "text-amber-500" : "text-red-500"} font-semibold`}>
                        %{s.performancePercent}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.issueCount > 0 ? <Badge variant="destructive">{s.issueCount}</Badge> : <Badge variant="secondary">0</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Genel Rapor Degerlendirmesi
            </DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Yapay zeka analiz yapiyor...</p>
            </div>
          ) : (
            <div data-testid="text-ai-analysis">
              <MarkdownRenderer content={aiAnalysis} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
