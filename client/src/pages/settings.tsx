import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Plus, Trash2, Clock, Timer, CalendarDays, Sun, Snowflake, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Holiday, Season } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });
  const { data: holidays, isLoading: holidaysLoading } = useQuery<Holiday[]>({ queryKey: ["/api/holidays"] });
  const { data: seasons = [] } = useQuery<Season[]>({ queryKey: ["/api/seasons"] });

  const [form, setForm] = useState<Record<string, string>>({});
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayMultiplier, setNewHolidayMultiplier] = useState("2");
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
          <p className="text-sm text-muted-foreground">Sezon, mesai kurallari ve tatiller</p>
        </div>
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            Sezon Yonetimi
          </CardTitle>
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
                <div key={s.id} className="border rounded-lg p-4 space-y-2" data-testid={`card-season-${s.id}`}>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSeasonEdit(s)} data-testid={`button-edit-season-${s.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSeasonMut.mutate(s.id)} data-testid={`button-delete-season-${s.id}`}>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Genel Calisma Ayarlari
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Gunluk Calisma (dk)</Label>
                <Input type="number" value={form.dailyWorkMinutes || "540"} onChange={(e) => updateField("dailyWorkMinutes", e.target.value)} className="font-mono" data-testid="input-daily-work" />
              </div>
              <div>
                <Label className="text-xs">Mola Suresi (dk)</Label>
                <Input type="number" value={form.breakMinutes || "60"} onChange={(e) => updateField("breakMinutes", e.target.value)} className="font-mono" data-testid="input-break" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              Tolerans ve Esikler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Mesai Esigi (dk)</Label>
              <Input type="number" value={form.overtimeThreshold || "15"} onChange={(e) => updateField("overtimeThreshold", e.target.value)} className="font-mono" data-testid="input-overtime-threshold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Gec Kalma Toleransi (dk)</Label>
                <Input type="number" value={form.lateToleranceMinutes || "5"} onChange={(e) => updateField("lateToleranceMinutes", e.target.value)} className="font-mono" data-testid="input-late-tolerance" />
              </div>
              <div>
                <Label className="text-xs">Erken Cikis Toleransi (dk)</Label>
                <Input type="number" value={form.earlyLeaveToleranceMinutes || "5"} onChange={(e) => updateField("earlyLeaveToleranceMinutes", e.target.value)} className="font-mono" data-testid="input-early-tolerance" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Diger Ayarlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mola Otomatik Dusulsun mu?</Label>
              <Switch checked={form.autoDeductBreak !== "false"} onCheckedChange={(c) => updateField("autoDeductBreak", String(c))} data-testid="switch-auto-break" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Min. Gecerli Calisma (dk)</Label>
                <Input type="number" value={form.minValidWorkMinutes || "30"} onChange={(e) => updateField("minValidWorkMinutes", e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Max. Gecerli Calisma (dk)</Label>
                <Input type="number" value={form.maxValidWorkMinutes || "960"} onChange={(e) => updateField("maxValidWorkMinutes", e.target.value)} className="font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Resmi Tatiller
          </CardTitle>
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
                  <div className="flex items-center gap-3">
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
    </div>
  );
}
