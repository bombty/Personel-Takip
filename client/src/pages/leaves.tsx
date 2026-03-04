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
import { Plus, Trash2, CalendarDays, Search } from "lucide-react";
import { useState } from "react";
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
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formType, setFormType] = useState("annual");
  const [formStatus, setFormStatus] = useState("approved");
  const [formNotes, setFormNotes] = useState("");

  const { data: leaves, isLoading: leavesLoading } = useQuery<Leave[]>({ queryKey: ["/api/leaves"] });
  const { data: employees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

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

  const filteredLeaves = (leaves || []).filter(l => {
    const empName = getEmployeeName(l.employeeId);
    return empName.toLowerCase().includes(search.toLowerCase()) ||
      getLeaveLabel(l.type).toLowerCase().includes(search.toLowerCase());
  });

  const getDayCount = (start: string, end: string): number => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-48"
              data-testid="input-search-leaves"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-leave">
                <Plus className="h-4 w-4 mr-1" /> Izin Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Izin Kaydi</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Personel</Label>
                  <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Personel secin" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.sort((a, b) => a.name.localeCompare(b.name, "tr")).map(e => (
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
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate()}
                  disabled={!formEmployeeId || !formStartDate || !formEndDate || createMutation.isPending}
                  data-testid="button-submit-leave"
                >
                  {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredLeaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-muted-foreground">
            {leaves?.length === 0
              ? "Henuz izin kaydi yok."
              : "Aramaniza uygun izin kaydi bulunamadi."}
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
                    <TableRow key={l.id} data-testid={`row-leave-${l.id}`}>
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
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => deleteMutation.mutate(l.id)}
                          data-testid={`button-delete-leave-${l.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
