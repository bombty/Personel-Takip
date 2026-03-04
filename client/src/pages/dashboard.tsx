import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { ProcessingResult, EmployeeSummary } from "@shared/schema";
import { Input } from "@/components/ui/input";
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

  const { data: uploads } = useQuery<any[]>({ queryKey: ["/api/uploads"] });

  const latestUploadId = uploads && uploads.length > 0
    ? Math.max(...uploads.map((u: any) => u.id))
    : null;

  const { data: reportData, isLoading } = useQuery<{ summaries: EmployeeSummary[] }>({
    queryKey: ["/api/report", latestUploadId],
    enabled: !!latestUploadId,
  });

  const summaries = reportData?.summaries || [];

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
    return { totalPersonnel, totalWork, avgDaily, totalOvertime, totalDeficit, totalLate, totalEarlyLeave, totalIssues };
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

  function handleSort(key: keyof EmployeeSummary) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (!latestUploadId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center max-w-md">
          <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-semibold mb-2">Henuz veri yuklemesi yok</h2>
          <p className="text-muted-foreground mb-6">
            Dashboard'u gormek icin once parmak izi verilerinizi yukleyin.
          </p>
          <Link href="/upload" data-testid="link-go-upload">
            <Badge variant="default" className="cursor-pointer text-sm px-4 py-2">
              Veri Yukle
            </Badge>
          </Link>
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
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Personel devam durumu genel gorunum</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Personel" value={stats.totalPersonnel} icon={Users} />
          <StatCard title="Ort. Gunluk" value={formatMinutes(Math.round(stats.avgDaily))} icon={Clock} />
          <StatCard title="Toplam Mesai" value={formatMinutes(stats.totalOvertime)} icon={TrendingUp} variant="success" />
          <StatCard title="Toplam Eksik" value={formatMinutes(stats.totalDeficit)} icon={TrendingDown} variant="warning" />
          <StatCard title="Gec Kalma" value={`${stats.totalLate} gun`} icon={Timer} variant="warning" />
          <StatCard title="Erken Cikis" value={`${stats.totalEarlyLeave} gun`} icon={LogOut} variant="warning" />
          <StatCard title="Sorun Sayisi" value={stats.totalIssues} icon={AlertTriangle} variant="danger" />
          <StatCard title="Toplam Calisma" value={formatMinutes(stats.totalWork)} icon={BarChart3} />
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Personel Bazli Ortalama Gunluk Calisma (saat)</CardTitle>
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
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("enNo")}>
                    Sicil
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("workDays")}>
                    Is Gunu
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("avgDailyMinutes")}>
                    Ort. Gunluk
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("totalOvertimeMinutes")}>
                    Mesai
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("totalDeficitMinutes")}>
                    Eksik
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("lateDays")}>
                    Gec
                  </TableHead>
                  <TableHead className="cursor-pointer select-none font-mono" onClick={() => handleSort("issueCount")}>
                    Sorun
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((s) => (
                  <TableRow key={s.enNo} className="hover-elevate cursor-pointer" data-testid={`row-employee-${s.enNo}`}>
                    <TableCell>
                      <Link href={`/employees/${s.enNo}`} className="font-medium">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{s.enNo}</TableCell>
                    <TableCell className="font-mono">{s.workDays}</TableCell>
                    <TableCell className="font-mono">{formatMinutes(s.avgDailyMinutes)}</TableCell>
                    <TableCell className="font-mono">
                      {s.totalOvertimeMinutes > 0 ? (
                        <span className="text-emerald-500">{formatMinutes(s.totalOvertimeMinutes)}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.totalDeficitMinutes > 0 ? (
                        <span className="text-amber-500">{formatMinutes(s.totalDeficitMinutes)}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {s.lateDays > 0 ? (
                        <span className="text-amber-500">{s.lateDays}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {s.issueCount > 0 ? (
                        <Badge variant="destructive">{s.issueCount}</Badge>
                      ) : (
                        <Badge variant="secondary">0</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
