import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Users, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@shared/schema";

const emptyForm = { name: "", enNo: 0, department: "", position: "", phone: "", hireDate: "", employmentType: "full_time" as string, weeklyHours: 45 };

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees
      .filter(e => e.active !== false)
      .filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        String(e.enNo).includes(search)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [employees, search]);

  const addMut = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/employees", data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setAddOpen(false);
      setForm(emptyForm);
      toast({ title: "Personel eklendi" });
    },
    onError: () => toast({ title: "Hata", description: "Personel eklenemedi", variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { await apiRequest("PATCH", `/api/employees/${id}`, data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditOpen(false);
      toast({ title: "Personel guncellendi" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/employees/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Personel pasif yapildi" });
    },
  });

  const openEdit = (e: Employee) => {
    setEditId(e.id);
    setForm({ name: e.name, enNo: e.enNo, department: e.department || "", position: e.position || "", phone: e.phone || "", hireDate: e.hireDate || "", employmentType: e.employmentType || "full_time", weeklyHours: e.weeklyHours || 45 });
    setEditOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Ad Soyad</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-emp-name" />
        </div>
        <div>
          <Label>Sicil No</Label>
          <Input type="number" value={form.enNo || ""} onChange={e => setForm({ ...form, enNo: parseInt(e.target.value) || 0 })} data-testid="input-emp-enno" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Departman</Label>
          <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} data-testid="input-emp-dept" />
        </div>
        <div>
          <Label>Pozisyon</Label>
          <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} data-testid="input-emp-position" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-emp-phone" />
        </div>
        <div>
          <Label>Ise Baslama</Label>
          <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} data-testid="input-emp-hire" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Calisma Tipi</Label>
          <Select
            value={form.employmentType}
            onValueChange={(val) => {
              const newWeekly = val === "full_time" ? 45 : 30;
              setForm({ ...form, employmentType: val, weeklyHours: newWeekly });
            }}
          >
            <SelectTrigger data-testid="select-emp-type">
              <SelectValue placeholder="Calisma tipi secin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Haftalik Calisma Saati</Label>
          <Input
            type="number"
            value={form.weeklyHours || ""}
            onChange={e => setForm({ ...form, weeklyHours: parseInt(e.target.value) || 0 })}
            data-testid="input-emp-weekly-hours"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-employees-title">Personeller</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} aktif personel</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Personel ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            data-testid="input-search-employees"
          />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-employee"><Plus className="h-4 w-4 mr-1" /> Yeni Personel</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yeni Personel Ekle</DialogTitle></DialogHeader>
              <FormFields />
              <Button className="w-full" onClick={() => addMut.mutate({ ...form, active: true })} disabled={!form.name || !form.enNo} data-testid="button-save-employee">
                Kaydet
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Personel Duzenle</DialogTitle></DialogHeader>
          <FormFields />
          <Button className="w-full" onClick={() => editId && editMut.mutate({ id: editId, data: form })} data-testid="button-update-employee">
            Guncelle
          </Button>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-muted-foreground">
            {employees?.length === 0
              ? "Henuz personel kaydi yok. Veri yukleyerek veya manuel ekleyerek personel kayitlari olusturun."
              : "Aramaniza uygun personel bulunamadi."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((e) => {
            const capitalName = e.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
            return (
              <Card key={e.id} className="hover-elevate" data-testid={`card-employee-${e.enNo}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <Link href={`/employees/${e.enNo}`} className="flex items-center gap-3 flex-1 cursor-pointer">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{capitalName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{capitalName}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">Sicil: {e.enNo}</span>
                        <Badge variant={e.employmentType === "part_time" ? "outline" : "default"} className="text-xs" data-testid={`badge-type-${e.enNo}`}>
                          {e.employmentType === "part_time" ? "PT" : "FT"}
                        </Badge>
                        {e.department && <Badge variant="secondary" className="text-xs">{e.department}</Badge>}
                        {e.position && <span className="text-xs text-muted-foreground">{e.position}</span>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} data-testid={`button-edit-${e.enNo}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Bu personeli pasif yapmak istediginize emin misiniz?")) deleteMut.mutate(e.id); }} data-testid={`button-delete-${e.enNo}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Link href={`/employees/${e.enNo}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
