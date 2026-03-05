import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Lock, Trash2, Download, Calendar, FileText } from "lucide-react";
import type { Upload } from "@shared/schema";

interface ReportPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  uploadIds: string | null;
  status: string;
  createdAt: string;
  finalizedAt: string | null;
}

export default function PeriodsPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [finalizeId, setFinalizeId] = useState<number | null>(null);
  const [newPeriod, setNewPeriod] = useState({ name: "", startDate: "", endDate: "" });

  const { data: periods = [], isLoading } = useQuery<ReportPeriod[]>({ queryKey: ["/api/report-periods"] });
  const { data: uploads = [] } = useQuery<Upload[]>({ queryKey: ["/api/uploads"] });

  const createMut = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string }) => {
      await apiRequest("POST", "/api/report-periods", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-periods"] });
      setCreateOpen(false);
      setNewPeriod({ name: "", startDate: "", endDate: "" });
      toast({ title: "Donem olusturuldu" });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/report-periods/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-periods"] });
      toast({ title: "Donem silindi" });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const finalizeMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/report-periods/${id}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-periods"] });
      setFinalizeId(null);
      toast({ title: "Donem finalize edildi" });
    },
  });

  const updateUploadIdsMut = useMutation({
    mutationFn: async ({ id, uploadIds }: { id: number; uploadIds: string }) => {
      await apiRequest("PATCH", `/api/report-periods/${id}`, { uploadIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-periods"] });
    },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      draft: { label: "Taslak", variant: "secondary" },
      final: { label: "Final", variant: "default" },
      archived: { label: "Arsiv", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
  };

  const getUploadCount = (uploadIds: string | null): number => {
    if (!uploadIds) return 0;
    return uploadIds.split(",").filter(Boolean).length;
  };

  const getUploadIdsList = (uploadIds: string | null): number[] => {
    if (!uploadIds) return [];
    return uploadIds.split(",").filter(Boolean).map(Number);
  };

  const toggleUploadInPeriod = (periodId: number, period: ReportPeriod, uploadId: number) => {
    const current = getUploadIdsList(period.uploadIds);
    let next: number[];
    if (current.includes(uploadId)) {
      next = current.filter(id => id !== uploadId);
    } else {
      next = [...current, uploadId];
    }
    updateUploadIdsMut.mutate({ id: periodId, uploadIds: next.join(",") });
  };

  const autoName = () => {
    if (newPeriod.startDate) {
      const d = new Date(newPeriod.startDate + "T00:00:00");
      const months = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    return "";
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Rapor Donemleri</h1>
          <p className="text-sm text-muted-foreground">Aylik rapor donemlerini yonetin ve finalize edin</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-period"><Plus className="h-4 w-4 mr-1" /> Yeni Donem</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Rapor Donemi</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Donem Adi</Label>
                <Input
                  value={newPeriod.name}
                  onChange={e => setNewPeriod({ ...newPeriod, name: e.target.value })}
                  placeholder={autoName() || "Orn: Subat 2026"}
                  data-testid="input-period-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Baslangic Tarihi</Label>
                  <Input
                    type="date"
                    value={newPeriod.startDate}
                    onChange={e => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                    data-testid="input-period-start"
                  />
                </div>
                <div>
                  <Label>Bitis Tarihi</Label>
                  <Input
                    type="date"
                    value={newPeriod.endDate}
                    onChange={e => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                    data-testid="input-period-end"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => createMut.mutate({
                    name: newPeriod.name || autoName(),
                    startDate: newPeriod.startDate,
                    endDate: newPeriod.endDate,
                  })}
                  disabled={!newPeriod.startDate || !newPeriod.endDate || createMut.isPending}
                  data-testid="button-save-period"
                >
                  Olustur
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Yukleniyor...</CardContent></Card>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Henuz rapor donemi olusturulmamis</p>
            <p className="text-xs mt-1">Yeni donem olusturmak icin yukardaki butonu kullanin</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {periods.map(period => (
            <Card key={period.id} data-testid={`card-period-${period.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{period.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {period.startDate} — {period.endDate}
                      </p>
                    </div>
                    {statusBadge(period.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    {period.status === "draft" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFinalizeId(period.id)}
                          data-testid={`button-finalize-${period.id}`}
                        >
                          <Lock className="h-3 w-3 mr-1" /> Finalize
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMut.mutate(period.id)}
                          data-testid={`button-delete-period-${period.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {getUploadCount(period.uploadIds) > 0 && (
                      <a href={`/api/export/period/${period.id}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" data-testid={`button-export-${period.id}`}>
                          <Download className="h-3 w-3 mr-1" /> Excel
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dahil Yuklemeler ({getUploadCount(period.uploadIds)})
                  </p>
                  {uploads.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {uploads.map(u => {
                        const included = getUploadIdsList(period.uploadIds).includes(u.id);
                        return (
                          <Button
                            key={u.id}
                            variant={included ? "default" : "outline"}
                            size="sm"
                            className="text-xs h-7"
                            disabled={period.status !== "draft"}
                            onClick={() => toggleUploadInPeriod(period.id, period, u.id)}
                            data-testid={`button-toggle-upload-${period.id}-${u.id}`}
                          >
                            #{u.id} {u.fileName?.substring(0, 20)}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Henuz yukleme yok</p>
                  )}
                  {period.finalizedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Finalize: {new Date(period.finalizedAt).toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={finalizeId !== null} onOpenChange={(open) => !open && setFinalizeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Donemi Finalize Et</AlertDialogTitle>
            <AlertDialogDescription>
              Bu donem kilitlenecek ve artik degistirilemeyecek. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-finalize">Iptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizeId && finalizeMut.mutate(finalizeId)}
              data-testid="button-confirm-finalize"
            >
              Finalize Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
