import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Save, ChevronLeft, ChevronRight } from "lucide-react";
import type { WorkSchedule, Employee, WeeklyAssignment } from "@shared/schema";

export default function ShiftsPage() {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: "", startTime: "08:00", endTime: "16:00", breakMinutes: 60 });
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: schedules = [] } = useQuery<WorkSchedule[]>({ queryKey: ["/api/work-schedules"] });
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
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

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Vardiya Plani</h1>
          <p className="text-sm text-muted-foreground">Calisma programlari ve haftalik atamalar</p>
        </div>
      </div>

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
                  <p className="text-sm font-medium">{s.name}</p>
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
    </div>
  );
}
