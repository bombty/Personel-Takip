import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Timer, LogOut, AlertTriangle, CalendarOff, CalendarCheck, Moon } from "lucide-react";
import type { EmployeeSummary, DailyReport } from "@shared/schema";
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
            <h1 className="text-2xl font-bold" data-testid="text-employee-name">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">Sicil No: {employee.enNo} {employee.department && `| ${employee.department}`}</p>
          </div>
        </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
            <LogOut className="h-4 w-4 text-orange-500 mb-1" />
            <p className="text-xs text-muted-foreground">Erken Cikis</p>
            <p className="text-lg font-bold font-mono">{employee.earlyLeaveDays} gun</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <Clock className="h-4 w-4 text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Ort. Gunluk</p>
            <p className="text-lg font-bold font-mono">{formatMinutes(employee.avgDailyMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <CalendarOff className="h-4 w-4 text-gray-400 mb-1" />
            <p className="text-xs text-muted-foreground">Off Gunleri</p>
            <p className="text-lg font-bold font-mono" data-testid="text-off-days">{employee.offDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <CalendarCheck className="h-4 w-4 text-cyan-500 mb-1" />
            <p className="text-xs text-muted-foreground">Izin Gunleri</p>
            <p className="text-lg font-bold font-mono" data-testid="text-leave-days">{employee.leaveDays}</p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
