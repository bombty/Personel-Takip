import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, CalendarDays, Pencil, UserCheck, FileText, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { useBranch } from "@/hooks/use-branch";
import type { Leave, Employee } from "@shared/schema";
import { leaveTypes } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LeavesPage() {
  const { toast } = useToast();
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formType, setFormType] = useState("annual");
  const [formStatus, setFormStatus] = useState("approved");
  const [formNotes, setFormNotes] = useState("");

  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
  const { data: leaves, isLoading: leavesLoading } = useQuery<Leave[]>({ queryKey: ["/api/leaves"] });
  const { data: employees } = useQuery<Employee[]>({ queryKey: [`/api/employees${branchParam}`] });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/leaves", {
        employeeId: parseInt(formEmployeeId),
        startDate: formStartDate,
        endDate: formEndDate,
        type: formType,
        status: formStatus,
        notes: formNotes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      setOpen(false);
      resetForm();
      toast({ title: "Eklendi", description: "Izin kaydi olusturuldu." });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingLeave) return;
      await apiRequest("PATCH", `/api/leaves/${editingLeave.id}`, {
        employeeId: parseInt(formEmployeeId),
        startDate: formStartDate,
        endDate: formEndDate,
        type: formType,
        status: formStatus,
        notes: formNotes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      setEditOpen(false);
      setEditingLeave(null);
      resetForm();
      toast({ title: "Guncellendi", description: "Izin kaydi guncellendi." });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/leaves/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "Silindi", description: "Izin kaydi silindi." });
    },
  });

  const resetForm = () => {
    setFormEmployeeId("");
    setFormStartDate("");
    setFormEndDate("");
    setFormType("annual");
    setFormStatus("approved");
    setFormNotes("");
  };

  const openEditDialog = (leave: Leave) => {
    setEditingLeave(leave);
    setFormEmployeeId(String(leave.employeeId));
    setFormStartDate(leave.startDate);
    setFormEndDate(leave.endDate);
    setFormType(leave.type);
    setFormStatus(leave.status || "approved");
    setFormNotes(leave.notes || "");
    setEditOpen(true);
  };

  const getEmployeeName = (employeeId: number): string => {
    const emp = employees?.find(e => e.id === employeeId);
    if (!emp) return `ID: ${employeeId}`;
    return emp.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  };

  const getLeaveLabel = (type: string): string => {
    return leaveTypes.find(t => t.value === type)?.label || type;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: "bg-emerald-500/10 text-emerald-500",
      pending: "bg-amber-500/10 text-amber-500",
      rejected: "bg-red-500/10 text-red-500",
    };
    const labels: Record<string, string> = {
      approved: "Onaylandi",
      pending: "Bekliyor",
      rejected: "Reddedildi",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredLeaves = useMemo(() => {
    return (leaves || []).filter(l => {
      if (filterEmployee !== "all" && String(l.employeeId) !== filterEmployee) return false;
      if (filterType !== "all" && l.type !== filterType) return false;
      return true;
    });
  }, [leaves, filterEmployee, filterType]);

  const getDayCount = (start: string, end: string): number => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const employeeSummaries = useMemo(() => {
    if (!leaves || !employees) return [];
    const approvedLeaves = leaves.filter(l => l.status === "approved");
    const empMap = new Map<number, { name: string; totalDays: number; annualDays: number; reportDays: number; unpaidDays: number; sickDays: number; otherDays: number }>();

    for (const l of approvedLeaves) {
      const days = getDayCount(l.startDate, l.endDate);
      const existing = empMap.get(l.employeeId) || {
        name: getEmployeeName(l.employeeId),
        totalDays: 0,
        annualDays: 0,
        reportDays: 0,
        unpaidDays: 0,
        sickDays: 0,
        otherDays: 0,
      };
      existing.totalDays += days;
      if (l.type === "annual") existing.annualDays += days;
      else if (l.type === "report") existing.reportDays += days;
      else if (l.type === "unpaid") existing.unpaidDays += days;
      else if (l.type === "sick") existing.sickDays += days;
      else existing.otherDays += days;
      empMap.set(l.employeeId, existing);
    }

    return Array.from(empMap.entries())
      .map(([id, data]) => ({ employeeId: id, ...data }))
      .sort((a, b) => b.totalDays - a.totalDays);
  }, [leaves, employees]);

  const sortedEmployees = useMemo(() => {
    return (employees || []).slice().sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [employees]);

  const leaveFormFields = (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Personel</Label>
        <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
          <SelectTrigger data-testid="select-employee">
            <SelectValue placeholder="Personel secin" />
          </SelectTrigger>
          <SelectContent>
            {sortedEmployees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")} ({e.enNo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Baslangic Tarihi</Label>
          <Input
            type="date"
            value={formStartDate}
            onChange={(e) => setFormStartDate(e.target.value)}
            className="font-mono"
            data-testid="input-leave-start"
          />
        </div>
        <div>
          <Label className="text-xs">Bitis Tarihi</Label>
          <Input
            type="date"
            value={formEndDate}
            onChange={(e) => setFormEndDate(e.target.value)}
            className="font-mono"
            data-testid="input-leave-end"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Izin Turu</Label>
          <Select value={formType} onValueChange={setFormType}>
            <SelectTrigger data-testid="select-leave-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leaveTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Durum</Label>
          <Select value={formStatus} onValueChange={setFormStatus}>
            <SelectTrigger data-testid="select-leave-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Onaylandi</SelectItem>
              <SelectItem value="pending">Bekliyor</SelectItem>
              <SelectItem value="rejected">Reddedildi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Notlar (opsiyonel)</Label>
        <Textarea
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          placeholder="Izin ile ilgili notlar..."
          data-testid="input-leave-notes"
        />
      </div>
    </div>
  );

  if (leavesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-leaves-title">Izin Yonetimi</h1>
          <p className="text-sm text-muted-foreground">{leaves?.length || 0} izin kaydi</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-48" data-testid="filter-employee">
              <SelectValue placeholder="Tum personel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Personel</SelectItem>
              {sortedEmployees.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44" data-testid="filter-leave-type">
              <SelectValue placeholder="Tum turler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Turler</SelectItem>
              {leaveTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-leave">
                <Plus className="h-4 w-4 mr-1" /> Izin Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Izin Kaydi</DialogTitle>
              </DialogHeader>
              {leaveFormFields}
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!formEmployeeId || !formStartDate || !formEndDate || createMutation.isPending}
                data-testid="button-submit-leave"
              >
                {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {employeeSummaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employeeSummaries.slice(0, 8).map((s) => (
            <Card key={s.employeeId} data-testid={`card-leave-summary-${s.employeeId}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate">{s.name}</CardTitle>
                <Badge variant="secondary">{s.totalDays} gun</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {s.annualDays > 0 && (
                    <span className="flex items-center gap-1" data-testid={`text-annual-days-${s.employeeId}`}>
                      <CalendarDays className="h-3 w-3" /> Yillik: {s.annualDays}
                    </span>
                  )}
                  {s.reportDays > 0 && (
                    <span className="flex items-center gap-1" data-testid={`text-report-days-${s.employeeId}`}>
                      <FileText className="h-3 w-3" /> Rapor: {s.reportDays}
                    </span>
                  )}
                  {s.sickDays > 0 && (
                    <span className="flex items-center gap-1" data-testid={`text-sick-days-${s.employeeId}`}>
                      <Clock className="h-3 w-3" /> Hastalik: {s.sickDays}
                    </span>
                  )}
                  {s.unpaidDays > 0 && (
                    <span className="flex items-center gap-1" data-testid={`text-unpaid-days-${s.employeeId}`}>
                      <UserCheck className="h-3 w-3" /> Ucretsiz: {s.unpaidDays}
                    </span>
                  )}
                  {s.otherDays > 0 && (
                    <span data-testid={`text-other-days-${s.employeeId}`}>Diger: {s.otherDays}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingLeave(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Izin Kaydini Duzenle</DialogTitle>
          </DialogHeader>
          {leaveFormFields}
          <Button
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={!formEmployeeId || !formStartDate || !formEndDate || updateMutation.isPending}
            data-testid="button-update-leave"
          >
            {updateMutation.isPending ? "Guncelleniyor..." : "Guncelle"}
          </Button>
        </DialogContent>
      </Dialog>

      {filteredLeaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-muted-foreground">
            {leaves?.length === 0
              ? "Henuz izin kaydi yok."
              : "Filtrelere uygun izin kaydi bulunamadi."}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead className="font-mono">Baslangic</TableHead>
                    <TableHead className="font-mono">Bitis</TableHead>
                    <TableHead className="font-mono">Gun</TableHead>
                    <TableHead>Tur</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Notlar</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.map((l) => (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => openEditDialog(l)}
                      data-testid={`row-leave-${l.id}`}
                    >
                      <TableCell className="font-medium">{getEmployeeName(l.employeeId)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.startDate}</TableCell>
                      <TableCell className="font-mono text-xs">{l.endDate}</TableCell>
                      <TableCell className="font-mono text-xs">{getDayCount(l.startDate, l.endDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getLeaveLabel(l.type)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(l.status || "approved")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{l.notes || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(l); }}
                            data-testid={`button-edit-leave-${l.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(l.id); }}
                            data-testid={`button-delete-leave-${l.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
