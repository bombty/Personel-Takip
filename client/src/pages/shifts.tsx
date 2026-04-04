import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBranch } from "@/hooks/use-branch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Clock, ChevronLeft, ChevronRight, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import type { WorkSchedule, Employee, WeeklyAssignment } from "@shared/schema";

interface ScheduleUploadResult {
  success: boolean;
  applied: number;
  warnings: string[];
  conflicts: { employeeName: string; weekStartDate: string; existingId: number }[];
}

export default function ShiftsPage() {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: "", startTime: "08:00", endTime: "16:00", breakMinutes: 60 });
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState("program");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadWeek, setUploadWeek] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  });
  const [uploadResult, setUploadResult] = useState<ScheduleUploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";

  const { data: schedules = [] } = useQuery<WorkSchedule[]>({ queryKey: ["/api/work-schedules"] });
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: [`/api/employees${branchParam}`] });
  const { data: assignments = [] } = useQuery<WeeklyAssignment[]>({ queryKey: ["/api/weekly-assignments"] });

  const activeEmployees = employees.filter(e => e.active);

  const getMonday = (offset: number) => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + offset * 7);
    return d.toISOString().split("T")[0];
  };

  const monday = getMonday(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + "T00:00:00");
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().split("T")[0], label: ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"][i] };
  });

  const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  const createScheduleMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/work-schedules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      setScheduleOpen(false);
      setNewSchedule({ name: "", startTime: "08:00", endTime: "16:00", breakMinutes: 60 });
      toast({ title: "Program eklendi" });
    },
  });

  const deleteScheduleMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/work-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      toast({ title: "Program silindi" });
    },
  });

  const saveAssignmentMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/weekly-assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-assignments"] });
    },
  });

  const uploadScheduleMut = useMutation({
    mutationFn: async ({ file, weekStartDate, overwrite }: { file: File; weekStartDate: string; overwrite?: boolean }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("weekStartDate", weekStartDate);
      if (overwrite) formData.append("overwrite", "true");
      const res = await fetch("/api/upload-schedule", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Yukleme hatasi");
      }
      return res.json() as Promise<ScheduleUploadResult>;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-assignments"] });
      toast({ title: `${data.applied} atama uygulandı` });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const getAssignment = (empId: number) => {
    return assignments.find(a => a.employeeId === empId && a.weekStartDate === monday);
  };

  const getDayValue = (empId: number, dayKey: string) => {
    const a = getAssignment(empId);
    if (!a) return "";
    return (a as any)[dayKey] || "";
  };

  const handleDayChange = (empId: number, dayKey: string, value: string) => {
    const existing = getAssignment(empId);
    const data: any = {
      employeeId: empId,
      weekStartDate: monday,
      ...(existing ? {} : { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null }),
      [dayKey]: value || null,
    };
    if (existing) {
      data.id = existing.id;
    }
    saveAssignmentMut.mutate(data);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      setUploadFile(file);
      setUploadResult(null);
    } else {
      toast({ title: "Gecersiz dosya", description: "Lutfen Excel (.xlsx) veya CSV dosyasi secin", variant: "destructive" });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Vardiya Plani</h1>
          <p className="text-sm text-muted-foreground">Calisma programlari, haftalik atamalar ve sift plani yukleme</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="program" data-testid="tab-program">Programlar</TabsTrigger>
          <TabsTrigger value="haftalik" data-testid="tab-haftalik">Haftalik Atama</TabsTrigger>
          <TabsTrigger value="yukle" data-testid="tab-yukle">Sift Plani Yukle</TabsTrigger>
          <TabsTrigger value="bosluklar" data-testid="tab-bosluklar">
            Atama Bosluklari
            {(() => {
              const missing = activeEmployees.filter(e => !assignments.find(a => a.employeeId === e.id && a.weekStartDate === monday));
              return missing.length > 0 ? (
                <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{missing.length}</Badge>
              ) : null;
            })()}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="program" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Calisma Programlari</CardTitle>
              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-schedule"><Plus className="h-4 w-4 mr-1" /> Yeni Program</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Yeni Calisma Programi</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Program Adi</Label>
                      <Input value={newSchedule.name} onChange={e => setNewSchedule({ ...newSchedule, name: e.target.value })} data-testid="input-schedule-name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Baslangic</Label>
                        <Input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({ ...newSchedule, startTime: e.target.value })} data-testid="input-schedule-start" />
                      </div>
                      <div>
                        <Label>Bitis</Label>
                        <Input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({ ...newSchedule, endTime: e.target.value })} data-testid="input-schedule-end" />
                      </div>
                    </div>
                    <div>
                      <Label>Mola (dk)</Label>
                      <Input type="number" value={newSchedule.breakMinutes} onChange={e => setNewSchedule({ ...newSchedule, breakMinutes: parseInt(e.target.value) || 0 })} data-testid="input-schedule-break" />
                    </div>
                    <Button className="w-full" onClick={() => createScheduleMut.mutate(newSchedule)} disabled={!newSchedule.name} data-testid="button-save-schedule">
                      Kaydet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {schedules.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2" data-testid={`card-schedule-${s.id}`}>
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{s.name} {s.shortCode && <Badge variant="outline" className="ml-1 text-[10px]">{s.shortCode}</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{s.startTime} - {s.endTime} ({s.breakMinutes}dk mola)</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={() => deleteScheduleMut.mutate(s.id)} data-testid={`button-delete-schedule-${s.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {schedules.length === 0 && <p className="text-sm text-muted-foreground">Henuz program eklenmemis</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="haftalik" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Haftalik Program</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} data-testid="button-prev-week">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-mono min-w-[180px] text-center">
                    {weekDays[0].date} - {weekDays[6].date}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} data-testid="button-next-week">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Bu Hafta</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 min-w-[140px]">Personel</th>
                      {weekDays.map((d, i) => (
                        <th key={i} className="text-center p-2 min-w-[100px]">
                          <div>{d.label}</div>
                          <div className="text-xs text-muted-foreground font-normal">{d.date.slice(5)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-muted/30" data-testid={`row-employee-${emp.id}`}>
                        <td className="p-2">
                          <div className="font-medium text-xs">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">#{emp.enNo}</div>
                        </td>
                        {dayKeys.map((dayKey, i) => {
                          const val = getDayValue(emp.id, dayKey);
                          return (
                            <td key={dayKey} className="p-1">
                              <Select value={val || "unset"} onValueChange={v => handleDayChange(emp.id, dayKey, v === "unset" ? "" : v)}>
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-${emp.id}-${dayKey}`}>
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unset">-</SelectItem>
                                  <SelectItem value="OFF">OFF</SelectItem>
                                  {schedules.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yukle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sift Plani Yukle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Hafta Baslangici (Pazartesi)</Label>
                  <Input
                    type="date"
                    value={uploadWeek}
                    onChange={e => setUploadWeek(e.target.value)}
                    data-testid="input-upload-week"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Format A icin zorunlu; Format B dosyalar kendi tarihini icerir</p>
                </div>
                <div className="flex items-end">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Kisa Kodlar:</strong> A=Acilis, K=Kapanis, T=Tam Gun, Y=Yarim, OFF=Tatil</p>
                    <p><strong>Format A:</strong> Isim/Sicil | Pzt | Sal | ... | Paz</p>
                    <p><strong>Format B:</strong> Tarih | Isim/Sicil | Pzt | ... | Paz</p>
                  </div>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                  ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-schedule"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-schedule-file"
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <Badge variant="outline">{(uploadFile.size / 1024).toFixed(0)} KB</Badge>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Sift plani dosyasini surukleyin veya secin</p>
                    <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) veya CSV desteklenir</p>
                  </div>
                )}
              </div>

              {uploadFile && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => uploadScheduleMut.mutate({ file: uploadFile, weekStartDate: uploadWeek })}
                    disabled={uploadScheduleMut.isPending}
                    data-testid="button-upload-schedule"
                  >
                    {uploadScheduleMut.isPending ? "Yukleniyor..." : "Yukle ve Uygula"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setUploadFile(null); setUploadResult(null); }}
                    data-testid="button-clear-upload"
                  >
                    Temizle
                  </Button>
                </div>
              )}

              {uploadResult && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                    <span className="font-medium">{uploadResult.applied} atama basariyla uygulandı</span>
                  </div>

                  {uploadResult.warnings.length > 0 && (
                    <div className="space-y-1">
                      {uploadResult.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadResult.conflicts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-600">Cakisma Tespit Edildi:</p>
                      {uploadResult.conflicts.map((c, i) => (
                        <div key={i} className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                          {c.employeeName} — hafta {c.weekStartDate} icin mevcut atama var
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => uploadFile && uploadScheduleMut.mutate({ file: uploadFile, weekStartDate: uploadWeek, overwrite: true })}
                        data-testid="button-overwrite-schedule"
                      >
                        Uzerine Yaz
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bosluklar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Bu Hafta Atamasi Olmayan Personel
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Hafta: {monday} — {weekDays[6]?.date}
              </p>
            </CardHeader>
            <CardContent>
              {(() => {
                const missing = activeEmployees.filter(e => !assignments.find(a => a.employeeId === e.id && a.weekStartDate === monday));
                const hasAssignment = activeEmployees.filter(e => assignments.find(a => a.employeeId === e.id && a.weekStartDate === monday));
                if (missing.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
                      <p className="font-medium text-emerald-600">Tum personel atamali</p>
                      <p className="text-sm text-muted-foreground">{hasAssignment.length} personelin bu hafta atamasi var</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-red-500 font-medium">
                        <AlertTriangle className="h-4 w-4" /> {missing.length} atama eksik
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="h-4 w-4" /> {hasAssignment.length} atamali
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Personel</TableHead>
                          <TableHead>Sicil No</TableHead>
                          <TableHead>Departman</TableHead>
                          <TableHead className="text-right">Islem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missing.map(e => (
                          <TableRow key={e.id} data-testid={`row-missing-${e.enNo}`}>
                            <TableCell className="font-medium">
                              {e.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{e.enNo}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{e.department || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setActiveTab("haftalik"); }}
                                data-testid={`button-go-assign-${e.enNo}`}
                              >
                                Atama Yap
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
