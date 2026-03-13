import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Plus, Trash2, Clock, Timer, CalendarDays, Sun, Snowflake, Pencil, Briefcase, Shield, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Holiday, Season, Branch } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: holidays, isLoading: holidaysLoading } = useQuery<Holiday[]>({ queryKey: ["/api/holidays"] });
  const { data: seasons = [] } = useQuery<Season[]>({ queryKey: ["/api/seasons"] });
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const [form, setForm] = useState<Record<string, string>>({});
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayMultiplier, setNewHolidayMultiplier] = useState("2");
  const [newBranchName, setNewBranchName] = useState("");
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonForm, setSeasonForm] = useState({
    name: "", startMonth: 1, endMonth: 3,
    weekdayOpen: "08:00", weekdayClose: "00:00",
    weekendOpen: "08:00", weekendClose: "02:00",
    weekendDays: "5,6",
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => { await apiRequest("POST", "/api/settings", data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Kaydedildi", description: "Ayarlar basariyla guncellendi." });
    },
    onError: (err: any) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const addHolidayMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/holidays", { date: newHolidayDate, name: newHolidayName, salaryMultiplier: parseFloat(newHolidayMultiplier) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setNewHolidayDate(""); setNewHolidayName(""); setNewHolidayMultiplier("2");
      toast({ title: "Eklendi", description: "Resmi tatil eklendi." });
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/holidays/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); },
  });

  const addBranchMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/branches", { name: newBranchName }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setNewBranchName("");
      toast({ title: "Sube eklendi" });
    },
    onError: () => toast({ title: "Hata", description: "Sube eklenemedi", variant: "destructive" }),
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/branches/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "Sube silindi" });
    },
    onError: () => toast({ title: "Hata", description: "Sube silinemedi (bagli personel olabilir)", variant: "destructive" }),
  });

  const saveSeasonMut = useMutation({
    mutationFn: async (data: any) => {
      if (editingSeason) {
        await apiRequest("PATCH", `/api/seasons/${editingSeason.id}`, data);
      } else {
        await apiRequest("POST", "/api/seasons", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setSeasonDialogOpen(false);
      setEditingSeason(null);
      toast({ title: editingSeason ? "Sezon guncellendi" : "Sezon eklendi" });
    },
  });

  const deleteSeasonMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/seasons/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({ title: "Sezon silindi" });
    },
  });

  const openSeasonEdit = (s: Season) => {
    setEditingSeason(s);
    setSeasonForm({
      name: s.name, startMonth: s.startMonth, endMonth: s.endMonth,
      weekdayOpen: s.weekdayOpen, weekdayClose: s.weekdayClose,
      weekendOpen: s.weekendOpen, weekendClose: s.weekendClose,
      weekendDays: s.weekendDays || "5,6",
    });
    setSeasonDialogOpen(true);
  };

  const openSeasonAdd = () => {
    setEditingSeason(null);
    setSeasonForm({ name: "", startMonth: 1, endMonth: 3, weekdayOpen: "08:00", weekdayClose: "00:00", weekendOpen: "08:00", weekendClose: "02:00", weekendDays: "5,6" });
    setSeasonDialogOpen(true);
  };

  const monthNames = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];

  const updateField = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  if (settingsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Ayarlar</h1>
          <p className="text-sm text-muted-foreground">Is kurallari, zaman ayarlari, toleranslar ve tatil yonetimi</p>
        </div>
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Temel Is Kurallari
          </CardTitle>
          <CardDescription className="text-xs">
            Turk is hukukuna uygun haftalik calisma saatleri ve maas donemi ayarlari
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="fullTimeWeeklyHours">Full-time Haftalik Calisma Saati</Label>
              <Input
                id="fullTimeWeeklyHours"
                type="number"
                value={form.fullTimeWeeklyHours || "45"}
                onChange={(e) => updateField("fullTimeWeeklyHours", e.target.value)}
                className="font-mono"
                data-testid="input-fulltime-weekly-hours"
              />
              <p className="text-xs text-muted-foreground">Tam zamanli personel icin haftalik beklenen calisma saati (varsayilan: 45)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="partTimeWeeklyHours">Part-time Haftalik Calisma Saati</Label>
              <Input
                id="partTimeWeeklyHours"
                type="number"
                value={form.partTimeWeeklyHours || "30"}
                onChange={(e) => updateField("partTimeWeeklyHours", e.target.value)}
                className="font-mono"
                data-testid="input-parttime-weekly-hours"
              />
              <p className="text-xs text-muted-foreground">Yari zamanli personel icin haftalik beklenen calisma saati (varsayilan: 30)</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="monthlyPayPeriodStart">Maas Donemi Baslangic Gunu</Label>
              <Input
                id="monthlyPayPeriodStart"
                type="number"
                min={1}
                max={28}
                value={form.monthlyPayPeriodStart || "1"}
                onChange={(e) => updateField("monthlyPayPeriodStart", e.target.value)}
                className="font-mono"
                data-testid="input-pay-period-start"
              />
              <p className="text-xs text-muted-foreground">Aylik maas doneminin basladigi gun (varsayilan: ayin 1'i)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="dailyOvertimeThresholdMinutes">Gunluk Mesai Esigi (dk)</Label>
              <Input
                id="dailyOvertimeThresholdMinutes"
                type="number"
                value={form.dailyOvertimeThresholdMinutes || "660"}
                onChange={(e) => updateField("dailyOvertimeThresholdMinutes", e.target.value)}
                className="font-mono"
                data-testid="input-daily-overtime-threshold"
              />
              <p className="text-xs text-muted-foreground">Gunluk bu esigi asan calisma mesai sayilir. 660 dk = 11 saat (varsayilan: 660)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Zaman Ayarlari
            </CardTitle>
            <CardDescription className="text-xs">
              Gunluk calisma suresi ve mola ayarlari
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Gunluk Calisma (dk)</Label>
              <Input type="number" value={form.dailyWorkMinutes || "540"} onChange={(e) => updateField("dailyWorkMinutes", e.target.value)} className="font-mono" data-testid="input-daily-work" />
              <p className="text-xs text-muted-foreground">Gunluk beklenen net calisma suresi, dakika cinsinden (varsayilan: 540 = 9 saat)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mola Suresi (dk)</Label>
              <Input type="number" value={form.breakMinutes || "60"} onChange={(e) => updateField("breakMinutes", e.target.value)} className="font-mono" data-testid="input-break" />
              <p className="text-xs text-muted-foreground">Gunluk mola suresi, dakika cinsinden (varsayilan: 60)</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Mola Otomatik Dusulsun mu?</Label>
                <p className="text-xs text-muted-foreground">Acildiginda mola suresi otomatik olarak calisma suresinden dusulur</p>
              </div>
              <Switch checked={form.autoDeductBreak !== "false"} onCheckedChange={(c) => updateField("autoDeductBreak", String(c))} data-testid="switch-auto-break" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Toleranslar
            </CardTitle>
            <CardDescription className="text-xs">
              Gec kalma, erken cikis ve mesai toleranslari
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Gec Kalma Toleransi (dk)</Label>
              <Input type="number" value={form.lateToleranceMinutes || "5"} onChange={(e) => updateField("lateToleranceMinutes", e.target.value)} className="font-mono" data-testid="input-late-tolerance" />
              <p className="text-xs text-muted-foreground">Bu sure icinde yapilan girislerde gec kalma sayilmaz (varsayilan: 5 dk)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Erken Cikis Toleransi (dk)</Label>
              <Input type="number" value={form.earlyLeaveToleranceMinutes || "5"} onChange={(e) => updateField("earlyLeaveToleranceMinutes", e.target.value)} className="font-mono" data-testid="input-early-tolerance" />
              <p className="text-xs text-muted-foreground">Bu sure icinde yapilan cikislarda erken cikis sayilmaz (varsayilan: 5 dk)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mesai Esigi (dk)</Label>
              <Input type="number" value={form.overtimeThreshold || "15"} onChange={(e) => updateField("overtimeThreshold", e.target.value)} className="font-mono" data-testid="input-overtime-threshold" />
              <p className="text-xs text-muted-foreground">Gunluk beklenen sureyi bu kadar asan calisma mesai sayilir (varsayilan: 15 dk)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Diger Zaman Ayarlari
          </CardTitle>
          <CardDescription className="text-xs">
            Gecerli calisma suresi sinirlari
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Min. Gecerli Calisma (dk)</Label>
              <Input type="number" value={form.minValidWorkMinutes || "30"} onChange={(e) => updateField("minValidWorkMinutes", e.target.value)} className="font-mono" data-testid="input-min-valid-work" />
              <p className="text-xs text-muted-foreground">Bunun altindaki calisma suresi gecersiz sayilir (varsayilan: 30 dk)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max. Gecerli Calisma (dk)</Label>
              <Input type="number" value={form.maxValidWorkMinutes || "960"} onChange={(e) => updateField("maxValidWorkMinutes", e.target.value)} className="font-mono" data-testid="input-max-valid-work" />
              <p className="text-xs text-muted-foreground">Bunun ustundeki calisma suresi gecersiz sayilir (varsayilan: 960 dk = 16 saat)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              Sezon Yonetimi
            </CardTitle>
            <CardDescription className="text-xs">
              Yaz/Kis sezonlarina gore calisma saatlerini belirleyin
            </CardDescription>
          </div>
          <Button size="sm" onClick={openSeasonAdd} data-testid="button-add-season">
            <Plus className="h-4 w-4 mr-1" /> Yeni Sezon
          </Button>
        </CardHeader>
        <CardContent>
          {seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Henuz sezon tanimlanmamis</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {seasons.map(s => (
                <div key={s.id} className="border rounded-md p-4 space-y-2" data-testid={`card-season-${s.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {s.name.toLowerCase().includes("kis") || s.name.toLowerCase().includes("kış") ? (
                        <Snowflake className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Sun className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openSeasonEdit(s)} data-testid={`button-edit-season-${s.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSeasonMut.mutate(s.id)} data-testid={`button-delete-season-${s.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Donem: {monthNames[s.startMonth - 1]} - {monthNames[s.endMonth - 1]}</p>
                    <p>Hafta ici: {s.weekdayOpen} - {s.weekdayClose}</p>
                    <p>Hafta sonu: {s.weekendOpen} - {s.weekendClose}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSeason ? "Sezon Duzenle" : "Yeni Sezon Ekle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sezon Adi</Label>
              <Input value={seasonForm.name} onChange={e => setSeasonForm({ ...seasonForm, name: e.target.value })} data-testid="input-season-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Baslangic Ayi</Label>
                <Input type="number" min={1} max={12} value={seasonForm.startMonth} onChange={e => setSeasonForm({ ...seasonForm, startMonth: parseInt(e.target.value) || 1 })} data-testid="input-season-start" />
              </div>
              <div>
                <Label>Bitis Ayi</Label>
                <Input type="number" min={1} max={12} value={seasonForm.endMonth} onChange={e => setSeasonForm({ ...seasonForm, endMonth: parseInt(e.target.value) || 12 })} data-testid="input-season-end" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hafta ici Acilis</Label>
                <Input type="time" value={seasonForm.weekdayOpen} onChange={e => setSeasonForm({ ...seasonForm, weekdayOpen: e.target.value })} data-testid="input-weekday-open" />
              </div>
              <div>
                <Label>Hafta ici Kapanis</Label>
                <Input type="time" value={seasonForm.weekdayClose} onChange={e => setSeasonForm({ ...seasonForm, weekdayClose: e.target.value })} data-testid="input-weekday-close" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hafta sonu Acilis</Label>
                <Input type="time" value={seasonForm.weekendOpen} onChange={e => setSeasonForm({ ...seasonForm, weekendOpen: e.target.value })} data-testid="input-weekend-open" />
              </div>
              <div>
                <Label>Hafta sonu Kapanis</Label>
                <Input type="time" value={seasonForm.weekendClose} onChange={e => setSeasonForm({ ...seasonForm, weekendClose: e.target.value })} data-testid="input-weekend-close" />
              </div>
            </div>
            <div>
              <Label>Hafta sonu Gunleri (5=Cuma, 6=Cumartesi)</Label>
              <Input value={seasonForm.weekendDays} onChange={e => setSeasonForm({ ...seasonForm, weekendDays: e.target.value })} data-testid="input-weekend-days" />
            </div>
            <Button className="w-full" onClick={() => saveSeasonMut.mutate(seasonForm)} disabled={!seasonForm.name} data-testid="button-save-season">
              {editingSeason ? "Guncelle" : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Resmi Tatiller
          </CardTitle>
          <CardDescription className="text-xs">
            Resmi tatil gunlerini ekleyin, tatil gunlerinde calisma icin maas carpani belirleyin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Tarih</Label>
              <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="font-mono" data-testid="input-holiday-date" />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs">Tatil Adi</Label>
              <Input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="Ornek: Cumhuriyet Bayrami" data-testid="input-holiday-name" />
            </div>
            <div className="w-24">
              <Label className="text-xs">Carpan</Label>
              <Input type="number" step="0.5" value={newHolidayMultiplier} onChange={(e) => setNewHolidayMultiplier(e.target.value)} className="font-mono" data-testid="input-holiday-multiplier" />
            </div>
            <Button onClick={() => addHolidayMutation.mutate()} disabled={!newHolidayDate || !newHolidayName || addHolidayMutation.isPending} data-testid="button-add-holiday">
              <Plus className="h-4 w-4 mr-1" /> Ekle
            </Button>
          </div>

          {holidaysLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : holidays && holidays.length > 0 ? (
            <div className="space-y-2">
              {holidays.sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{h.date}</span>
                    <span className="text-sm">{h.name}</span>
                    <Badge variant="secondary">{h.salaryMultiplier}x maas</Badge>
                  </div>
                  <Button variant="secondary" size="icon" onClick={() => deleteHolidayMutation.mutate(h.id)} data-testid={`button-delete-holiday-${h.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Resmi tatil eklenmemis</p>
          )}
        </CardContent>
      </Card>

      {/* Branch Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Sube Yonetimi
          </CardTitle>
          <CardDescription>Cafe subelerini ekle, duzenle veya sil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">Sube Adi</Label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Ornek: Merkez"
                data-testid="input-branch-name"
                onKeyDown={(e) => e.key === "Enter" && newBranchName.trim() && addBranchMutation.mutate()}
              />
            </div>
            <Button
              onClick={() => addBranchMutation.mutate()}
              disabled={!newBranchName.trim() || addBranchMutation.isPending}
              data-testid="button-add-branch"
            >
              <Plus className="h-4 w-4 mr-1" /> Ekle
            </Button>
          </div>

          {branches.length > 0 ? (
            <div className="space-y-2">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{branch.name}</span>
                    {!branch.active && <Badge variant="outline" className="text-xs">Pasif</Badge>}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => deleteBranchMutation.mutate(branch.id)}
                    disabled={deleteBranchMutation.isPending}
                    data-testid={`button-delete-branch-${branch.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Henuz sube eklenmemis</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
