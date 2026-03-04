import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Timer, LogOut, AlertTriangle } from "lucide-react";
import type { EmployeeSummary, DailyReport } from "@shared/schema";
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
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    "Normal": "secondary",
    "Gec": "default",
    "Erken Cikis": "default",
    "Eksik Kayit": "destructive",
    "Mesai": "secondary",
    "Hafta Sonu Calisma": "secondary",
    "Tatil Calisma": "secondary",
    "Cok Kisa": "destructive",
    "Cok Uzun": "destructive",
    "Coklu Okutma": "destructive",
  };

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
    "Izinli": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
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

  const { data: uploads } = useQuery<any[]>({ queryKey: ["/api/uploads"] });
  const latestUploadId = uploads && uploads.length > 0
    ? Math.max(...uploads.map((u: any) => u.id))
    : null;

  const { data: reportData, isLoading } = useQuery<{ summaries: EmployeeSummary[] }>({
    queryKey: ["/api/report", latestUploadId],
    enabled: !!latestUploadId,
  });

  const employee = reportData?.summaries.find(s => s.enNo === enNo);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Personel bulunamadi</p>
        <Link href="/">
          <Button variant="secondary">Dashboard'a Don</Button>
        </Link>
      </div>
    );
  }

  const issues = employee.dailyReports.filter(d => d.status.some(s => s !== "Normal"));

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/">
          <Button variant="secondary" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employee-name">{employee.name}</h1>
          <p className="text-sm text-muted-foreground">Sicil No: {employee.enNo}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <Clock className="h-4 w-4 text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Toplam Calisma</p>
            <p className="text-lg font-bold font-mono">{formatMinutes(employee.totalWorkMinutes)}</p>
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
                {employee.dailyReports.map((d: DailyReport) => (
                  <TableRow key={d.date} className={d.isWeekend ? "opacity-60" : ""} data-testid={`row-day-${d.date}`}>
                    <TableCell className="font-mono text-xs">{d.date}</TableCell>
                    <TableCell className="text-xs">{d.dayName}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[0]?.in || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[0]?.out || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[1]?.in || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.pairs[1]?.out || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.totalWorkMinutes > 0 ? formatMinutes(d.totalWorkMinutes) : "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.overtimeMinutes > 0 ? (
                        <span className="text-emerald-500">{formatMinutes(d.overtimeMinutes)}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.deficitMinutes > 0 ? (
                        <span className="text-amber-500">{formatMinutes(d.deficitMinutes)}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {d.status.map((s, i) => (
                          <StatusBadge key={i} status={s} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
                    {d.status.filter(s => s !== "Normal").map((s, j) => (
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
